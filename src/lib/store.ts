import type {
  AchievementDef, DB, DisplayCfg, Notice, RebuyKind, ResultEntry, Role, ScoringConfig, Season,
  SeatAlgo, Template, Tournament, User,
} from "../types";
import { buildSeed } from "./seed";
import {
  computeBoard, DEFAULT_ACHIEVEMENTS, emptyStats, freshAchievements, isLateRegOpen, itmCutoff,
  levelDurationMs, levelRemainingMs, provisionalResults, remainingCount, scoreForPlace, totalSeats, uid,
} from "./formulas";

/* ============================================================
   Центральная БД клуба (демо-аналог Firebase RTDB + Firestore).
   Состояние живёт в localStorage, мутации мгновенно разносятся
   по всем вкладкам через BroadcastChannel (onValue-синхронность).
   Точка подмены на реальный Firebase — mutate()/load().
   ============================================================ */

const LS_KEY = "goldentuz_db_v6";
const SS_KEY = "goldentuz_uid";
const BC_NAME = "goldentuz_sync_v5";

function isValid(db: unknown): db is DB {
  const d = db as DB | null;
  return !!d && d.v === 5
    && Array.isArray(d.users) && d.users.length > 0
    && typeof d.users[0].firstName === "string" // защита от старых схем
    && Array.isArray(d.tournaments) && Array.isArray(d.seasons)
    && !!d.settings && !!d.presence;
}

/** Достраивает поля, появившиеся в новых версиях схемы (без потери данных). */
function normalize(d: DB): DB {
  if (!Array.isArray(d.achievements) || d.achievements.length === 0) {
    d.achievements = JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS));
  }
  const s = d.settings as Partial<DB["settings"]>;
  if (!s.background) s.background = "#0a0a12";
  if (s.soundsEnabled === undefined) s.soundsEnabled = true;
  if (s.soundVolume === undefined) s.soundVolume = 70;
  for (const u of d.users) {
    if (u.cover === undefined || u.cover === null) u.cover = 0;
    if (u.photoURL === undefined) u.photoURL = null;
  }
  for (const t of d.tournaments) {
    if ((t as unknown as Record<string, unknown>).finalTableAt === undefined) t.finalTableAt = 9;
  }
  return d;
}

function load(): DB {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isValid(parsed)) return normalize(parsed);
    }
  } catch { /* повреждённые данные — пересоздаём */ }
  const seed = buildSeed();
  try { localStorage.setItem(LS_KEY, JSON.stringify(seed)); } catch { /* quota */ }
  return seed;
}

let state: DB = load();
let sessionUid: string | null = null;
try { sessionUid = sessionStorage.getItem(SS_KEY); } catch { sessionUid = null; }

let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  listeners.forEach((fn) => fn());
}

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* quota */ }
  try { channel?.postMessage("sync"); } catch { /* channel closed */ }
}

let channel: BroadcastChannel | null = null;
try {
  channel = new BroadcastChannel(BC_NAME);
  channel.onmessage = (e) => {
    if (e.data === "sync") {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (isValid(parsed)) state = normalize(parsed);
        }
      } catch { /* ignore */ }
      emit();
    }
  };
} catch { channel = null; }

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as unknown;
        if (isValid(parsed)) { state = normalize(parsed); emit(); }
      } catch { /* ignore */ }
    }
  });
}

function mutate(fn: (db: DB) => void) {
  fn(state);
  persist();
  emit();
}

/* ---------------- подписка ---------------- */

export function subscribeStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function getVersion(): number { return version; }
export function getState(): DB { return state; }
export function getSessionUid(): string | null { return sessionUid; }

function setSession(uidv: string | null) {
  sessionUid = uidv;
  try {
    if (uidv) sessionStorage.setItem(SS_KEY, uidv);
    else sessionStorage.removeItem(SS_KEY);
  } catch { /* ignore */ }
  emit();
}

/* ---------------- помощники ---------------- */

function notice(db: DB, userId: string, text: string, kind: Notice["kind"] = "info") {
  db.notices.unshift({ id: uid("n"), userId, text, at: Date.now(), kind });
  if (db.notices.length > 80) db.notices.length = 80;
}

function findUser(db: DB, id: string): User | undefined {
  return db.users.find((u) => u.id === id);
}

function nicknameOf(db: DB, id: string): string {
  return findUser(db, id)?.nickname ?? "—";
}

function touchPresence(db: DB, userId: string, tournamentId: string | null = null) {
  db.presence[userId] = {
    status: "online",
    lastSeen: Date.now(),
    tournamentId: tournamentId ?? db.presence[userId]?.tournamentId ?? null,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isLive(t: Tournament | undefined): boolean {
  return !!t && ["active", "break", "paused"].includes(t.status);
}

function isEliminated(t: Tournament, userId: string): boolean {
  return t.knockouts.some((k) => k.userId === userId);
}

function findFreeSeat(t: Tournament): { table: number; seat: number } | null {
  for (const tb of t.tables) {
    const i = tb.seats.indexOf(null);
    if (i >= 0) return { table: tb.number, seat: i };
  }
  return null;
}

/**
 * Общий финальный стол: когда за столами остаётся <= finalTableAt игроков,
 * все они сводятся за один стол (isFinal) — именно его показывает ТВ-экран «Финал».
 */
function formFinalTableIfNeeded(db: DB, t: Tournament) {
  if (t.finalTableAt <= 0) return;
  if (t.tables.some((tb) => tb.isFinal)) return; // уже сформирован
  const rem: string[] = [];
  for (const tb of t.tables) for (const s of tb.seats) if (s) rem.push(s);
  if (rem.length === 0 || rem.length > t.finalTableAt) return;
  const seats: (string | null)[] = Array(t.finalTableAt).fill(null);
  rem.forEach((u, i) => { seats[i] = u; });
  t.tables = [{ number: 1, isFinal: true, capacity: t.finalTableAt, seats }];
  notice(db, "all", `«${t.name}»: сформирован финальный стол — ${rem.length} ${rem.length === 1 ? "игрок" : "игроков"}`, "win");
}

function seasonPoints(db: DB, seasonId: string): Map<string, number> {
  const pts = new Map<string, number>();
  for (const tt of db.tournaments) {
    if (tt.seasonId !== seasonId || !tt.results) continue;
    for (const r of tt.results) pts.set(r.userId, (pts.get(r.userId) ?? 0) + r.points);
  }
  return pts;
}

export const REBUY_LABELS: Record<RebuyKind, string> = {
  rebuy: "Рабай", addon: "Аддон", reentry: "Ре-ентри", lastchance: "Ласт шанс",
};

/* ============================================================
   ДЕЙСТВИЯ
   ============================================================ */

export const actions = {
  /* ---------- аутентификация и профили ---------- */

  login(email: string, password: string): string | null {
    const u = state.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) return "Пользователь с таким email не найден";
    if (u.password !== password) return "Неверный пароль";
    if (u.isBlocked) return "Аккаунт заблокирован администратором";
    setSession(u.id);
    mutate((db) => touchPresence(db, u.id, null));
    return null;
  },

  /** Самостоятельная регистрация игрока (страница входа). */
  register(opts: { email: string; password: string; firstName: string; lastName: string; nickname: string; phone: string }): string | null {
    const em = opts.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return "Некорректный email";
    if (opts.password.length < 6) return "Пароль — минимум 6 символов";
    if (!opts.firstName.trim() || !opts.lastName.trim() || !opts.nickname.trim()) return "Заполните имя, фамилию и никнейм";
    if (state.users.some((x) => x.email.toLowerCase() === em)) return "Этот email уже зарегистрирован";
    const id = uid("u");
    mutate((db) => {
      db.users.push({
        id, email: em, password: opts.password,
        firstName: opts.firstName.trim(), lastName: opts.lastName.trim(),
        nickname: opts.nickname.trim(), phone: opts.phone.trim(),
        role: "player", hue: Math.floor(Math.random() * 360), photoURL: null,
        cover: Math.floor(Math.random() * 6),
        registeredAt: Date.now(), isBlocked: false, archived: false, manualPoints: 0,
        stats: emptyStats(), achievements: [],
      });
      touchPresence(db, id);
      notice(db, "all", `В клубе новый игрок — ${opts.nickname.trim()}!`, "info");
    });
    setSession(id);
    return null;
  },

  /** Создание учётной записи администратором — попадает в общую базу клуба. */
  createPlayer(opts: {
    email: string; password: string; firstName: string; lastName: string; nickname: string;
    phone: string; hue: number; registeredAt: number; manualPoints: number; photoURL?: string | null;
  }): string | null {
    const em = opts.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return "Некорректный email";
    if (opts.password.length < 6) return "Пароль — минимум 6 символов";
    if (!opts.firstName.trim() || !opts.lastName.trim() || !opts.nickname.trim()) return "Заполните имя, фамилию и никнейм";
    if (state.users.some((x) => x.email.toLowerCase() === em)) return "Этот email уже занят";
    const id = uid("u");
    mutate((db) => {
      db.users.push({
        id, email: em, password: opts.password,
        firstName: opts.firstName.trim(), lastName: opts.lastName.trim(),
        nickname: opts.nickname.trim(), phone: opts.phone.trim(),
        role: "player", hue: opts.hue, photoURL: opts.photoURL ?? null,
        cover: Math.floor(Math.random() * 6),
        registeredAt: opts.registeredAt || Date.now(),
        isBlocked: false, archived: false,
        manualPoints: Math.max(0, Math.round(opts.manualPoints || 0)),
        stats: emptyStats(), achievements: [],
      });
    });
    return null;
  },

  logout() {
    const cur = sessionUid;
    if (cur) {
      mutate((db) => {
        if (db.presence[cur]) db.presence[cur] = { ...db.presence[cur], status: "offline", lastSeen: Date.now() };
      });
    }
    setSession(null);
  },

  resetPassword(email: string): string | null {
    const u = state.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) return "Пользователь не найден";
    return null;
  },

  heartbeat(userId: string, tournamentId: string | null = null) {
    mutate((db) => touchPresence(db, userId, tournamentId));
  },

  updateProfile(userId: string, patch: Partial<Pick<User, "firstName" | "lastName" | "nickname" | "phone" | "hue" | "photoURL" | "cover">>): string | null {
    if (patch.nickname !== undefined && !patch.nickname.trim()) return "Никнейм не может быть пустым";
    mutate((db) => {
      const u = findUser(db, userId);
      if (u) Object.assign(u, patch);
    });
    return null;
  },

  setRole(userId: string, role: Role) {
    mutate((db) => { const u = findUser(db, userId); if (u) u.role = role; });
  },

  setBlocked(userId: string, blocked: boolean) {
    mutate((db) => { const u = findUser(db, userId); if (u) u.isBlocked = blocked; });
  },

  setArchived(userId: string, archived: boolean) {
    mutate((db) => { const u = findUser(db, userId); if (u) u.archived = archived; });
  },

  setManualPoints(userId: string, points: number) {
    mutate((db) => {
      const u = findUser(db, userId);
      if (u) {
        u.manualPoints = Math.max(0, Math.round(points));
        if (u.manualPoints > 0) notice(db, userId, `Администратор начислил вам ${u.manualPoints} очков`, "win");
      }
    });
  },

  /* ---------- сезоны ---------- */

  saveSeason(season: Season) {
    mutate((db) => {
      if (season.isActive) db.seasons.forEach((x) => { if (x.id !== season.id) x.isActive = false; });
      const i = db.seasons.findIndex((x) => x.id === season.id);
      if (i >= 0) db.seasons[i] = season; else db.seasons.push(season);
    });
  },

  archiveSeason(id: string) {
    mutate((db) => {
      const x = db.seasons.find((q) => q.id === id);
      if (x) { x.archived = true; x.isActive = false; }
    });
  },

  deleteSeason(id: string): string | null {
    if (state.tournaments.some((t) => t.seasonId === id)) return "В сезоне есть турниры — сначала перенесите их";
    mutate((db) => { db.seasons = db.seasons.filter((x) => x.id !== id); });
    return null;
  },

  /* ---------- шаблоны ---------- */

  saveTemplate(tpl: Template) {
    mutate((db) => {
      const i = db.templates.findIndex((x) => x.id === tpl.id);
      if (i >= 0) db.templates[i] = tpl; else db.templates.push(tpl);
    });
  },

  duplicateTemplate(id: string): string | null {
    const src = state.templates.find((t) => t.id === id);
    if (!src) return "Шаблон не найден";
    const copy: Template = { ...JSON.parse(JSON.stringify(src)), id: uid("tpl"), name: `${src.name} (копия)` };
    mutate((db) => db.templates.push(copy));
    return null;
  },

  deleteTemplate(id: string) {
    mutate((db) => { db.templates = db.templates.filter((t) => t.id !== id); });
  },

  /* ---------- турниры ---------- */

  /** Создание из черновика конструктора. Возвращает id. */
  createTournament(draft: Tournament): string {
    const id = uid("tr");
    mutate((db) => {
      db.tournaments.unshift({ ...draft, id, status: "registration", createdBy: sessionUid ?? "u_admin", createdAt: Date.now() });
      notice(db, "all", `Открыта регистрация: «${draft.name}»`, "info");
    });
    return id;
  },

  updateTournament(t: Tournament) {
    mutate((db) => {
      const i = db.tournaments.findIndex((x) => x.id === t.id);
      if (i >= 0) db.tournaments[i] = t;
    });
  },

  deleteTournament(id: string): string | null {
    const t = state.tournaments.find((x) => x.id === id);
    if (!t) return "Турнир не найден";
    if (isLive(t)) return "Нельзя удалить идущий турнир";
    mutate((db) => { db.tournaments = db.tournaments.filter((x) => x.id !== id); });
    return null;
  },

  setRegOpen(id: string, open: boolean) {
    mutate((db) => {
      const t = db.tournaments.find((x) => x.id === id);
      if (t && t.status !== "finished") t.regOpen = open;
    });
  },

  addRegistration(tId: string, userId: string): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t) return "Турнир не найден";
    if (t.status === "finished") return "Турнир завершён";
    if (!t.regOpen && t.status !== "registration") return "Регистрация закрыта";
    if (t.registrations.some((r) => r.userId === userId && r.status !== "refunded")) return "Игрок уже в списке";
    const active = t.registrations.filter((r) => r.status !== "refunded").length;
    if (active >= t.maxPlayers) return "Турнир заполнен";
    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      tt.registrations.push({ userId, status: "registered", registeredAt: Date.now(), checkedInAt: null });
    });
    return null;
  },

  removeRegistration(tId: string, userId: string) {
    mutate((db) => {
      const t = db.tournaments.find((x) => x.id === tId);
      if (!t) return;
      t.registrations = t.registrations.filter((r) => r.userId !== userId);
      for (const tb of t.tables) {
        const i = tb.seats.indexOf(userId);
        if (i >= 0) tb.seats[i] = null;
      }
    });
  },

  toggleCheckIn(tId: string, userId: string) {
    mutate((db) => {
      const t = db.tournaments.find((x) => x.id === tId);
      const r = t?.registrations.find((q) => q.userId === userId);
      if (!r) return;
      if (r.status === "checked-in") { r.status = "registered"; r.checkedInAt = null; }
      else { r.status = "checked-in"; r.checkedInAt = Date.now(); }
    });
  },

  /* ---------- рассадка ---------- */

  autoSeat(tId: string, algo: SeatAlgo): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t) return "Турнир не найден";
    if (t.status !== "registration") return "Рассадка возможна до старта";
    if (!t.tables.length) return "Сначала добавьте столы в разделе «Столы»";
    const regs = t.registrations.filter((r) => r.status !== "refunded");
    let pool = regs.map((r) => r.userId);
    const checked = regs.filter((r) => r.status === "checked-in").map((r) => r.userId);
    if (checked.length >= 2) pool = checked;
    if (pool.length < 2) return "Нужно минимум 2 участника с чекином";
    if (totalSeats(t) < pool.length) return "Не хватает мест: добавьте столы или места";
    if (algo === "rating") {
      const pts = seasonPoints(state, t.seasonId);
      pool = [...pool].sort((a, b) => (pts.get(b) ?? 0) - (pts.get(a) ?? 0));
    } else {
      pool = shuffle(pool);
    }
    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      for (const tb of tt.tables) tb.seats = tb.seats.map((): string | null => null);
      pool.forEach((userId, i) => {
        let tableIdx: number;
        if (algo === "rating") {
          const n = tt.tables.length;
          const round = Math.floor(i / n);
          const pos = i % n;
          tableIdx = round % 2 === 0 ? pos : n - 1 - pos;
        } else {
          const counts = tt.tables.map((tb) => tb.seats.filter(Boolean).length);
          tableIdx = counts.indexOf(Math.min(...counts));
        }
        const tb = tt.tables[tableIdx];
        const seatIdx = tb.seats.indexOf(null);
        if (seatIdx >= 0) tb.seats[seatIdx] = userId;
      });
    });
    return null;
  },

  moveSeat(tId: string, fromT: number, fromS: number, toT: number, toS: number) {
    mutate((db) => {
      const t = db.tournaments.find((x) => x.id === tId);
      if (!t) return;
      const a = t.tables.find((x) => x.number === fromT);
      const b = t.tables.find((x) => x.number === toT);
      if (!a || !b) return;
      const tmp = a.seats[fromS];
      a.seats[fromS] = b.seats[toS];
      b.seats[toS] = tmp;
    });
  },

  balanceTables(tId: string): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t || !t.tables.length) return "Нет столов";
    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      for (let guard = 0; guard < 100; guard += 1) {
        const counts = tt.tables.map((tb) => tb.seats.filter(Boolean).length);
        const maxI = counts.indexOf(Math.max(...counts));
        const minI = counts.indexOf(Math.min(...counts));
        if (counts[maxI] - counts[minI] <= 1) break;
        const from = tt.tables[maxI];
        const to = tt.tables[minI];
        const sIdx = from.seats.findIndex(Boolean);
        const tIdx = to.seats.findIndex((s) => s === null);
        if (sIdx < 0 || tIdx < 0) break;
        to.seats[tIdx] = from.seats[sIdx];
        from.seats[sIdx] = null;
      }
    });
    return null;
  },

  /* ---------- ход игры (одновременно идёт ОДИН турнир) ---------- */

  startTournament(tId: string): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t) return "Турнир не найден";
    if (t.status !== "registration") return "Турнир уже запущен";
    const other = state.tournaments.find((x) => x.id !== tId && isLive(x));
    if (other) return `Сейчас идёт «${other.name}» — одновременно возможен только один турнир`;
    if (!t.tables.length) {
      const err = actions.autoSeat(tId, "balanced");
      if (err) return err;
    }
    const now = Date.now();
    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      tt.status = "active";
      tt.currentLevel = 0;
      tt.levelStartedAt = now;
      tt.lateRegUntil = tt.lateRegMinutes > 0 ? now + tt.lateRegMinutes * 60_000 : null;
      notice(db, "all", `Турнир «${tt.name}» стартовал — фишки в игре`, "alert");
      if (tt.lateRegMinutes > 0) notice(db, "all", `Поздняя регистрация на «${tt.name}» открыта ${tt.lateRegMinutes} мин`, "info");
    });
    return null;
  },

  pauseTournament(tId: string) {
    mutate((db) => {
      const t = db.tournaments.find((x) => x.id === tId);
      if (!t || t.status !== "active") return;
      t.pausedRemaining = levelRemainingMs(t, Date.now());
      t.levelStartedAt = null;
      t.status = "paused";
    });
  },

  resumeTournament(tId: string) {
    mutate((db) => {
      const t = db.tournaments.find((x) => x.id === tId);
      if (!t || t.status !== "paused") return;
      const dur = levelDurationMs(t);
      const rem = t.pausedRemaining ?? dur;
      t.levelStartedAt = Date.now() - (dur - rem);
      t.pausedRemaining = null;
      t.status = "active";
    });
  },

  adjustTimer(tId: string, deltaSec: number): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t) return "Турнир не найден";
    if (!isLive(t)) return "Таймер идёт только во время игры";
    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      const now = Date.now();
      const dur = levelDurationMs(tt);
      if (tt.status === "break" && tt.breakEndsAt != null) {
        tt.breakEndsAt = Math.max(now, tt.breakEndsAt + deltaSec * 1000);
      } else if (tt.status === "paused" && tt.pausedRemaining != null) {
        tt.pausedRemaining = Math.min(dur, Math.max(0, tt.pausedRemaining + deltaSec * 1000));
      } else if (tt.status === "active" && tt.levelStartedAt != null) {
        const rem = Math.max(0, dur - (now - tt.levelStartedAt));
        const newRem = Math.min(dur, Math.max(0, rem + deltaSec * 1000));
        tt.levelStartedAt = now - (dur - newRem);
      }
    });
    return null;
  },

  adjustLateReg(tId: string, deltaMin: number) {
    mutate((db) => {
      const t = db.tournaments.find((x) => x.id === tId);
      if (!t || !isLive(t)) return;
      const now = Date.now();
      const base = t.lateRegUntil != null && t.lateRegUntil > now ? t.lateRegUntil : now;
      t.lateRegUntil = Math.max(0, base + deltaMin * 60_000);
      if (t.lateRegUntil < now) notice(db, "all", `«${t.name}»: поздняя регистрация закрыта`, "info");
    });
  },

  nextLevel(tId: string): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t) return "Турнир не найден";
    if (t.currentLevel >= t.levels.length - 1) return "Это последний уровень структуры";
    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      tt.currentLevel += 1;
      tt.levelStartedAt = Date.now();
      tt.pausedRemaining = null;
      if (tt.status === "break" || tt.status === "paused") {
        tt.status = "active";
        tt.breakEndsAt = null;
      }
      const br = tt.breaks.find((b) => b.afterLevel === tt.currentLevel);
      if (br && tt.status === "active") {
        tt.pausedRemaining = levelDurationMs(tt);
        tt.status = "break";
        tt.breakEndsAt = Date.now() + br.duration * 60_000;
        tt.levelStartedAt = null;
        notice(db, "all", `«${tt.name}»: перерыв ${br.duration} мин`, "info");
      }
    });
    return null;
  },

  prevLevel(tId: string) {
    mutate((db) => {
      const t = db.tournaments.find((x) => x.id === tId);
      if (!t || t.currentLevel === 0) return;
      t.currentLevel -= 1;
      if (t.status !== "registration" && t.status !== "finished") {
        t.status = "active";
        t.levelStartedAt = Date.now();
        t.breakEndsAt = null;
        t.pausedRemaining = null;
      }
    });
  },

  startBreak(tId: string, minutes = 15) {
    mutate((db) => {
      const t = db.tournaments.find((x) => x.id === tId);
      if (!t || (t.status !== "active" && t.status !== "paused")) return;
      t.pausedRemaining = t.status === "active" ? levelRemainingMs(t, Date.now()) : (t.pausedRemaining ?? levelDurationMs(t));
      t.status = "break";
      t.breakEndsAt = Date.now() + minutes * 60_000;
      t.levelStartedAt = null;
      notice(db, "all", `«${t.name}»: перерыв ${minutes} мин`, "info");
    });
  },

  endBreak(tId: string) {
    mutate((db) => {
      const t = db.tournaments.find((x) => x.id === tId);
      if (!t || t.status !== "break") return;
      const dur = levelDurationMs(t);
      const rem = t.pausedRemaining ?? dur;
      t.status = "active";
      t.breakEndsAt = null;
      t.levelStartedAt = Date.now() - (dur - rem);
      t.pausedRemaining = null;
    });
  },

  /* ---------- выбывшие и возвраты ---------- */

  eliminate(tId: string, userId: string, killerId: string | null): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t) return "Турнир не найден";
    if (t.status === "finished") return "Турнир завершён";
    if (isEliminated(t, userId)) return "Игрок уже выбыл";
    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      for (const tb of tt.tables) {
        const i = tb.seats.indexOf(userId);
        if (i >= 0) tb.seats[i] = null;
      }
      tt.knockouts.push({ userId, killerId, level: tt.currentLevel, at: Date.now() });
      const name = nicknameOf(db, userId);
      if (killerId) notice(db, "all", `Нокаут! ${nicknameOf(db, killerId)} выбивает ${name}`, "alert");
      else notice(db, "all", `${name} покидает турнир (блайнды)`, "info");
      formFinalTableIfNeeded(db, tt);
      if (remainingCount(tt) === 1) notice(db, "all", `«${tt.name}»: остался один игрок — фиксируйте результат`, "win");
    });
    return null;
  },

  addRebuy(tId: string, userId: string, kind: RebuyKind): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t) return "Турнир не найден";
    if (!isLive(t)) return "Действие доступно только во время игры";
    if (!t.registrations.some((r) => r.userId === userId && r.status !== "refunded")) return "Игрок не участвует в турнире";
    const eliminated = isEliminated(t, userId);
    const now = Date.now();

    if (eliminated) {
      if (!isLateRegOpen(t, now)) return "Поздняя регистрация закрыта — вернуть игрока нельзя";
      if (!findFreeSeat(t)) return "Нет свободных мест за столами";
    } else {
      if (kind === "reentry" || kind === "lastchance") return "Игрок ещё в игре — ре-ентри недоступно";
      if (!t.rebuyAllowed) return "В этом турнире ребаи запрещены";
      if (t.currentLevel > t.rebuyUntilLevel) return `Ребаи закрыты после уровня ${t.rebuyUntilLevel + 1}`;
      if (kind === "rebuy") {
        const cnt = t.rebuys.filter((r) => r.userId === userId && r.kind === "rebuy").length;
        if (cnt >= t.maxRebuys) return `Лимит ребаев (${t.maxRebuys}) исчерпан`;
      } else if (t.rebuys.some((r) => r.userId === userId && r.kind === "addon")) {
        return "Аддон уже куплен";
      }
    }

    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      const name = nicknameOf(db, userId);
      if (eliminated) {
        for (let i = tt.knockouts.length - 1; i >= 0; i -= 1) {
          if (tt.knockouts[i].userId === userId) { tt.knockouts.splice(i, 1); break; }
        }
        const slot = findFreeSeat(tt);
        if (slot) {
          const tb = tt.tables.find((x) => x.number === slot.table);
          if (tb) tb.seats[slot.seat] = userId;
        }
        notice(db, "all", `${name} возвращается в игру — ${REBUY_LABELS[kind].toLowerCase()}, фишки добавлены в банк`, "alert");
      } else {
        notice(db, "all", `${name} — ${REBUY_LABELS[kind].toLowerCase()}, фишки добавлены в банк`, "info");
      }
      tt.rebuys.push({ userId, kind, at: Date.now() });
    });
    return null;
  },

  addBonus(tId: string, userId: string, name: string, chips: number): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t) return "Турнир не найден";
    if (!isLive(t)) return "Бонусы раздаются только во время игры";
    const label = name.trim();
    if (!label) return "Укажите название бонуса";
    if (!chips || chips <= 0) return "Укажите количество фишек";
    if (isEliminated(t, userId)) return "Игрок уже выбыл — бонус недоступен";
    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      tt.bonuses.push({ id: uid("bn"), userId, name: label, chips: Math.round(chips), at: Date.now() });
      notice(db, "all", `${nicknameOf(db, userId)} получает бонус «${label}»: +${Math.round(chips).toLocaleString("ru-RU")} фишек в банк`, "win");
    });
    return null;
  },

  /* ---------- завершение и очки ---------- */

  finishTournament(tId: string): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t) return "Турнир не найден";
    if (t.results) return "Результаты уже опубликованы";
    if (t.status === "registration") return "Турнир ещё не стартовал";
    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      const order = provisionalResults(tt);
      const n = order.length;
      const results: ResultEntry[] = order.map(({ userId, place }) => {
        const ko = tt.knockouts.filter((k) => k.killerId === userId).length;
        const rb = tt.rebuys.filter((r) => r.userId === userId && r.kind !== "addon").length;
        const ad = tt.rebuys.filter((r) => r.userId === userId && r.kind === "addon").length;
        const ret = tt.rebuys.filter((r) => r.userId === userId && (r.kind === "reentry" || r.kind === "lastchance")).length;
        const pts = tt.nonScoring ? 0 : scoreForPlace(tt.scoring, place, ko);
        return { userId, place, points: pts, knockouts: ko, rebuys: rb, addons: ad, returns: ret };
      });
      tt.results = results;
      tt.status = "finished";
      tt.regOpen = false;
      tt.breakEndsAt = null;
      tt.levelStartedAt = null;
      tt.lateRegUntil = null;

      for (const r of results) {
        const u = findUser(db, r.userId);
        if (!u) continue;
        u.stats.tournamentsPlayed += 1;
        if (r.place === 1) u.stats.wins += 1;
        if (r.place <= 3) u.stats.top3 += 1;
        if (r.place <= 9) u.stats.finalTables += 1;
        u.stats.knockouts += r.knockouts;
        u.stats.rebuys += r.rebuys + r.addons;
        u.stats.returns += r.returns;
        if (r.place <= itmCutoff(n)) u.stats.inMoney += 1;
        u.stats.totalPlace += r.place;
        u.stats.bestPlace = u.stats.bestPlace === 0 ? r.place : Math.min(u.stats.bestPlace, r.place);
        if (r.points > u.stats.bestPoints) u.stats.bestPoints = r.points;
        const fresh = freshAchievements(u.stats, u.achievements, db.achievements);
        if (fresh.length) {
          u.achievements.push(...fresh.map((f) => f.id));
          fresh.forEach((f) => notice(db, u.id, `Новое достижение: «${f.name}»`, "win"));
        }
      }
      const winner = results.find((r) => r.place === 1);
      notice(db, "all", `«${tt.name}» завершён — побеждает ${winner ? nicknameOf(db, winner.userId) : "—"}!`, "win");
    });
    return null;
  },

  /* ---------- финал сезона: топ-18, очки не начисляются ---------- */

  createSeasonFinal(seasonId: string): string | null {
    const season = state.seasons.find((x) => x.id === seasonId);
    if (!season) return "Сезон не найден";
    if (state.tournaments.some((t) => t.nonScoring && t.seasonId === seasonId)) return "Финальный турнир сезона уже создан";
    const board = computeBoard(state, seasonId);
    const top = board.slice(0, 18).map((b) => b.userId);
    if (top.length < 2) return "В зачёте сезона меньше двух игроков — финал невозможен";

    const id = uid("tr");
    const date = new Date(Date.now() + 7 * 86400_000);
    date.setHours(19, 0, 0, 0);

    // столы: по 9 мест, «змейка» по рейтингу
    const nTables = Math.max(1, Math.ceil(top.length / 9));
    const tables = Array.from({ length: nTables }, (_, i) => ({
      number: i + 1, isFinal: nTables === 1, capacity: 9, seats: Array(9).fill(null) as (string | null)[],
    }));
    top.forEach((userId, i) => {
      const round = Math.floor(i / nTables);
      const pos = i % nTables;
      const tableIdx = round % 2 === 0 ? pos : nTables - 1 - pos;
      const tb = tables[tableIdx];
      const seatIdx = tb.seats.indexOf(null);
      if (seatIdx >= 0) tb.seats[seatIdx] = userId;
    });

    mutate((db) => {
      db.tournaments.unshift({
        id,
        name: `Финал сезона · ${season.name}`,
        templateId: null, seasonId,
        date: date.toISOString(),
        description: "Финальный турнир сезона для топ-18 рейтинга. Очки не начисляются, в зачёт рейтингов не входит.",
        type: "freezeout", maxPlayers: 18, startingChips: 30000,
        levels: [
          { sb: 50, bb: 100, ante: 0, duration: 15 }, { sb: 100, bb: 200, ante: 0, duration: 15 },
          { sb: 150, bb: 300, ante: 0, duration: 15 }, { sb: 200, bb: 400, ante: 50, duration: 15 },
          { sb: 300, bb: 600, ante: 75, duration: 15 }, { sb: 400, bb: 800, ante: 100, duration: 15 },
          { sb: 600, bb: 1200, ante: 150, duration: 15 }, { sb: 800, bb: 1600, ante: 200, duration: 15 },
          { sb: 1200, bb: 2400, ante: 300, duration: 15 }, { sb: 2000, bb: 4000, ante: 500, duration: 15 },
        ],
        breaks: [{ afterLevel: 3, duration: 20 }, { afterLevel: 6, duration: 20 }],
        rebuyAllowed: false, maxRebuys: 0, rebuyCostChips: 0, rebuyUntilLevel: 0,
        lateRegMinutes: 30, lateRegUntil: null,
        bonusDefs: [{ name: "Чип-бонус", chips: 10000 }],
        scoring: { grid: [], participation: 0, knockoutPoints: 0, knockoutEnabled: false },
        nonScoring: true, finalTableAt: 9,
        status: "registration", regOpen: false,
        currentLevel: 0, levelStartedAt: null, pausedRemaining: null, breakEndsAt: null,
        registrations: top.map((userId) => ({ userId, status: "checked-in" as const, registeredAt: Date.now(), checkedInAt: Date.now() })),
        tables, knockouts: [], rebuys: [], bonuses: [], results: null,
        createdBy: sessionUid ?? "u_admin", createdAt: Date.now(),
      });
      notice(db, "all", `Сформирован финал сезона «${season.name}» — топ-18 в списке`, "win");
    });
    return id;
  },

  /**
   * Дозаполнение финала сезона резервом: если кто-то из топ-18 не прошёл
   * регистрацию (его убрали из списка), свободные места занимают игроки
   * с 19-го места и ниже — строго по убыванию рейтинга.
   */
  fillSeasonFinalReserves(tId: string): string | null {
    const t = state.tournaments.find((x) => x.id === tId);
    if (!t || !t.nonScoring) return "Это не финальный турнир сезона";
    if (t.status === "finished") return "Турнир завершён";
    const board = computeBoard(state, t.seasonId);
    const top18 = new Set(board.slice(0, 18).map((b) => b.userId));
    let added = 0;
    mutate((db) => {
      const tt = db.tournaments.find((x) => x.id === tId)!;
      const registered = new Set(tt.registrations.map((r) => r.userId));
      for (const row of board) {
        if (tt.registrations.length >= tt.maxPlayers) break;
        if (top18.has(row.userId)) continue;      // резерв — только ниже топ-18
        if (registered.has(row.userId)) continue;
        tt.registrations.push({ userId: row.userId, status: "registered", registeredAt: Date.now(), checkedInAt: null });
        registered.add(row.userId);
        added += 1;
      }
      if (added > 0) notice(db, "all", `Финал сезона: из резерва добавлено игроков — ${added}`, "info");
    });
    return null;
  },

  /* ---------- экраны, настройки, уведомления ---------- */

  saveDisplay(d: DisplayCfg) {
    mutate((db) => {
      const i = db.displays.findIndex((x) => x.id === d.id);
      if (i >= 0) db.displays[i] = d; else db.displays.push(d);
    });
  },

  deleteDisplay(id: string) {
    mutate((db) => { db.displays = db.displays.filter((x) => x.id !== id); });
  },

  saveSettings(patch: Partial<DB["settings"]>) {
    mutate((db) => { Object.assign(db.settings, patch); });
  },

  /* ---------- достижения (коллекция achievements) ---------- */

  saveAchievement(def: AchievementDef): string | null {
    if (!def.name.trim()) return "Укажите название достижения";
    if (!def.condition || def.condition.min < 0) return "Укажите порог условия";
    mutate((db) => {
      const i = db.achievements.findIndex((a) => a.id === def.id);
      if (i >= 0) db.achievements[i] = def;
      else db.achievements.push(def);
    });
    return null;
  },

  deleteAchievement(id: string) {
    mutate((db) => { db.achievements = db.achievements.filter((a) => a.id !== id); });
  },

  markNoticesRead(userId: string) {
    mutate((db) => { db.readMarkers[userId] = Date.now(); });
  },

  pushNotice(userId: string, text: string, kind: Notice["kind"] = "info") {
    mutate((db) => notice(db, userId, text, kind));
  },

  reseedAll() {
    state = buildSeed();
    persist();
    emit();
  },
};

export function noticesFor(db: DB, userId: string): Notice[] {
  return db.notices.filter((n) => n.userId === userId || n.userId === "all");
}

export function unreadCount(db: DB, userId: string): number {
  const marker = db.readMarkers[userId] ?? 0;
  return noticesFor(db, userId).filter((n) => n.at > marker).length;
}

/** Турнир, который сейчас идёт (в клубе одновременно возможен только один). */
export function liveTournament(db: DB): Tournament | undefined {
  return db.tournaments.find((t) => isLive(t));
}
