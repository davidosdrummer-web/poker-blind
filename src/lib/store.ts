// src/lib/store.ts
import { auth } from './firebase/config';
import {
  login as firebaseLogin,
  register as firebaseRegister,
  logout as firebaseLogout,
  onAuthState,
  waitForAuth,
  getCurrentUser,
} from './firebase/auth';
import * as realtime from './firebase/realtime';
import * as firestore from './firebase/firestore';
import type {
  User, DB, Tournament, Season, Template, Result, Rating,
  AchievementDef, ClubSettings, DisplayCfg, Notice, RebuyKind, SeatAlgo,
} from '../types';
import {
  computeBoard,
  emptyStats,
  freshAchievements,
  isLateRegOpen,
  itmCutoff,
  levelDurationMs,
  levelRemainingMs,
  provisionalResults,
  remainingCount,
  scoreForPlace,
  totalSeats,
} from './formulas';
import { uid, DEFAULT_ACHIEVEMENTS, defaultScoring, REBUY_LABELS } from './constants';

// Re-экспорты для совместимости
export { uid, DEFAULT_ACHIEVEMENTS, defaultScoring, REBUY_LABELS };

// ============================================================
//  ЛОКАЛЬНОЕ СОСТОЯНИЕ (кэш)
// ============================================================

let state: DB = getEmptyDB();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  listeners.forEach((fn) => fn());
}

function getEmptyDB(): DB {
  return {
    v: 7,
    users: [],
    seasons: [],
    templates: [],
    achievements: JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS)),
    tournaments: [],
    displays: [],
    notices: [],
    settings: {
      clubName: 'Золотой Туз',
      tagline: 'Спортивный покер-клуб · турниры, рейтинги, сезоны',
      language: 'ru',
      primary: '#d4a017',
      background: '#0a0a12',
      soundsEnabled: true,
      soundVolume: 70,
      defaultScoring: defaultScoring(),
    },
    presence: {},
    readMarkers: {},
  };
}

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ ПОДПИСОК НА FIREBASE
// ============================================================

let initialized = false;

function initSubscriptions() {
  if (initialized) return;
  initialized = true;

  firestore.users.subscribe((users) => {
    state.users = users;
    emit();
  });

  firestore.seasons.subscribe((seasons) => {
    state.seasons = seasons;
    emit();
  });

  firestore.templates.subscribe((templates) => {
    state.templates = templates;
    emit();
  });

  firestore.tournamentsMeta.subscribe((tournaments) => {
    state.tournaments = tournaments;
    emit();
  });

  firestore.achievements.subscribe((achievements) => {
    state.achievements = achievements;
    emit();
  });

  firestore.settings.subscribe((settings) => {
    state.settings = settings;
    emit();
  });

  firestore.displays.subscribe((displays) => {
    state.displays = displays;
    emit();
  });

  realtime.subscribePresence((presence) => {
    state.presence = presence;
    emit();
  });
}

initSubscriptions();

// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function findUser(db: DB, id: string): User | undefined {
  return db.users.find((u) => u.id === id);
}

function nicknameOf(db: DB, id: string): string {
  return findUser(db, id)?.nickname ?? '—';
}

function findTournament(db: DB, id: string): Tournament | undefined {
  return db.tournaments.find((t) => t.id === id);
}

function isLive(t: Tournament | undefined): boolean {
  return !!t && ['active', 'break', 'paused'].includes(t.status);
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seasonPoints(db: DB, seasonId: string): Map<string, number> {
  const pts = new Map<string, number>();
  for (const t of db.tournaments) {
    if (t.seasonId !== seasonId || !t.results) continue;
    for (const r of t.results) {
      pts.set(r.userId, (pts.get(r.userId) ?? 0) + r.points);
    }
  }
  return pts;
}

function formFinalTableIfNeeded(db: DB, t: Tournament) {
  if (t.finalTableAt <= 0) return;
  if (t.tables.some((tb) => tb.isFinal)) return;
  const rem: string[] = [];
  for (const tb of t.tables) {
    for (const s of tb.seats) {
      if (s) rem.push(s);
    }
  }
  if (rem.length === 0 || rem.length > t.finalTableAt) return;
  const seats: (string | null)[] = Array(t.finalTableAt).fill(null);
  rem.forEach((u, i) => {
    seats[i] = u;
  });
  t.tables = [{ number: 1, isFinal: true, capacity: t.finalTableAt, seats }];
  actions.pushNotice('all', `«${t.name}»: сформирован финальный стол — ${rem.length} ${rem.length === 1 ? 'игрок' : 'игроков'}`, 'win');
}

function notice(db: DB, userId: string, text: string, kind: Notice['kind'] = 'info') {
  firestore.notices.add({
    userId,
    text,
    at: Date.now(),
    kind,
  });
  db.notices.unshift({ id: uid('n'), userId, text, at: Date.now(), kind });
  if (db.notices.length > 80) db.notices.length = 80;
}

// ============================================================
//  АУТЕНТИФИКАЦИЯ
// ============================================================

let sessionUid: string | null = null;
let authInitialized = false;

// Инициализация при загрузке
onAuthState(async (user) => {
  authInitialized = true;
  if (user) {
    sessionUid = user.uid;
    try {
      sessionStorage.setItem('gt_uid', user.uid);
    } catch {}
    realtime.setPresence(user.uid, null);
    emit();
  } else {
    sessionUid = null;
    try {
      sessionStorage.removeItem('gt_uid');
    } catch {}
    emit();
  }
});

// ============================================================
//  ACTIONS
// ============================================================

export const actions = {
  // ---------- Аутентификация ----------
  async login(email: string, password: string): Promise<string | null> {
    const { user, error } = await firebaseLogin(email, password);
    if (error) return error;
    if (!user) return 'Ошибка входа';

    const profile = await firestore.users.get(user.uid);
    if (!profile) return 'Пользователь не найден в базе клуба';
    if (profile.isBlocked) return 'Аккаунт заблокирован администратором';

    sessionUid = user.uid;
    try {
      sessionStorage.setItem('gt_uid', user.uid);
    } catch {}

    realtime.setPresence(user.uid, null);
    return null;
  },

  async register(opts: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    nickname: string;
    phone: string;
  }): Promise<string | null> {
    const { user, error } = await firebaseRegister(opts.email, opts.password);
    if (error) return error;
    if (!user) return 'Ошибка регистрации';

    const existingUsers = await firestore.users.query([]);
    const isFirst = existingUsers.length === 0;

    const userData: Omit<User, 'id'> = {
      email: opts.email.trim().toLowerCase(),
      password: opts.password,
      firstName: opts.firstName.trim(),
      lastName: opts.lastName.trim(),
      nickname: opts.nickname.trim(),
      phone: opts.phone.trim(),
      role: isFirst ? 'admin' : 'player',
      hue: Math.floor(Math.random() * 360),
      photoURL: null,
      cover: Math.floor(Math.random() * 6),
      registeredAt: Date.now(),
      isBlocked: false,
      archived: false,
      manualPoints: 0,
      stats: emptyStats(),
      achievements: [],
    };

    await firestore.users.set(user.uid, userData);

    sessionUid = user.uid;
    try {
      sessionStorage.setItem('gt_uid', user.uid);
    } catch {}

    realtime.setPresence(user.uid, null);

    if (isFirst) {
      notice(state, 'all', `Клуб основан: ${opts.nickname.trim()} — администратор платформы`, 'win');
    } else {
      notice(state, 'all', `В клубе новый игрок — ${opts.nickname.trim()}!`, 'info');
    }

    return null;
  },

  async createPlayer(opts: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    nickname: string;
    phone: string;
    hue: number;
    registeredAt: number;
    manualPoints: number;
    photoURL?: string | null;
  }): Promise<string | null> {
    const { user, error } = await firebaseRegister(opts.email, opts.password);
    if (error) return error;
    if (!user) return 'Ошибка создания пользователя';

    const userData: Omit<User, 'id'> = {
      email: opts.email.trim().toLowerCase(),
      password: opts.password,
      firstName: opts.firstName.trim(),
      lastName: opts.lastName.trim(),
      nickname: opts.nickname.trim(),
      phone: opts.phone.trim(),
      role: 'player',
      hue: opts.hue,
      photoURL: opts.photoURL ?? null,
      cover: Math.floor(Math.random() * 6),
      registeredAt: opts.registeredAt || Date.now(),
      isBlocked: false,
      archived: false,
      manualPoints: Math.max(0, Math.round(opts.manualPoints || 0)),
      stats: emptyStats(),
      achievements: [],
    };

    await firestore.users.set(user.uid, userData);
    return null;
  },

  async logout() {
    await firebaseLogout();
    sessionUid = null;
    try {
      sessionStorage.removeItem('gt_uid');
    } catch {}
  },

  resetPassword(email: string): string | null {
    return null;
  },

  heartbeat(userId: string, tournamentId: string | null = null) {
    realtime.updatePresence(userId, tournamentId);
  },

  async updateProfile(userId: string, patch: Partial<Pick<User, 'firstName' | 'lastName' | 'nickname' | 'phone' | 'hue' | 'photoURL' | 'cover'>>): Promise<string | null> {
    if (patch.nickname !== undefined && !patch.nickname.trim()) {
      return 'Никнейм не может быть пустым';
    }
    await firestore.users.update(userId, patch);
    return null;
  },

  async setRole(userId: string, role: User['role']) {
    await firestore.users.update(userId, { role });
  },

  async setBlocked(userId: string, blocked: boolean) {
    await firestore.users.update(userId, { isBlocked: blocked });
  },

  async setArchived(userId: string, archived: boolean) {
    await firestore.users.update(userId, { archived });
  },

  async setManualPoints(userId: string, points: number) {
    const pts = Math.max(0, Math.round(points));
    await firestore.users.update(userId, { manualPoints: pts });
    if (pts > 0) {
      const user = state.users.find((u) => u.id === userId);
      if (user) {
        notice(state, userId, `Администратор начислил вам ${pts} очков`, 'win');
      }
    }
  },

  // ---------- Сезоны ----------
  async saveSeason(season: Season) {
    if (season.isActive) {
      for (const s of state.seasons) {
        if (s.id !== season.id && s.isActive) {
          await firestore.seasons.set(s.id, { ...s, isActive: false });
        }
      }
    }
    await firestore.seasons.set(season.id, season);
  },

  async archiveSeason(id: string) {
    const season = state.seasons.find((s) => s.id === id);
    if (season) {
      await firestore.seasons.set(id, { ...season, archived: true, isActive: false });
    }
  },

  async deleteSeason(id: string): Promise<string | null> {
    if (state.tournaments.some((t) => t.seasonId === id)) {
      return 'В сезоне есть турниры — сначала перенесите их';
    }
    await firestore.seasons.delete(id);
    return null;
  },

  // ---------- Шаблоны ----------
  async saveTemplate(tpl: Template) {
    await firestore.templates.set(tpl.id, tpl);
  },

  async duplicateTemplate(id: string): Promise<string | null> {
    const src = state.templates.find((t) => t.id === id);
    if (!src) return 'Шаблон не найден';
    const copy: Template = {
      ...JSON.parse(JSON.stringify(src)),
      id: uid('tpl'),
      name: `${src.name} (копия)`,
    };
    await firestore.templates.set(copy.id, copy);
    return null;
  },

  async deleteTemplate(id: string) {
    await firestore.templates.delete(id);
  },

  // ---------- Турниры ----------
  async createTournament(draft: Omit<Tournament, 'id' | 'createdBy' | 'createdAt' | 'status'>): Promise<string> {
    const id = uid('tr');
    const tournament: Tournament = {
      ...draft,
      id,
      status: 'registration',
      createdBy: sessionUid ?? 'u_admin',
      createdAt: Date.now(),
    };

    await firestore.tournamentsMeta.set(id, tournament);

    await realtime.initTournamentState(id, {
      status: 'registration',
      currentLevel: 0,
      levelStartedAt: null,
      pausedRemaining: null,
      breakEndsAt: null,
      lateRegUntil: null,
      tables: draft.tables || [],
      knockouts: [],
      rebuys: [],
      bonuses: [],
      playersCount: 0,
      averageStack: 0,
    });

    notice(state, 'all', `Открыта регистрация: «${draft.name}»`, 'info');
    return id;
  },

  async updateTournament(t: Tournament) {
    await firestore.tournamentsMeta.set(t.id, t);
  },

  async deleteTournament(id: string): Promise<string | null> {
    const t = findTournament(state, id);
    if (!t) return 'Турнир не найден';
    if (isLive(t)) return 'Нельзя удалить идущий турнир';

    await firestore.tournamentsMeta.delete(id);
    await realtime.deleteTournamentState(id);
    return null;
  },

  async setRegOpen(id: string, open: boolean) {
    const t = findTournament(state, id);
    if (t && t.status !== 'finished') {
      await firestore.tournamentsMeta.update(id, { regOpen: open });
    }
  },

  async addRegistration(tId: string, userId: string): Promise<string | null> {
    const t = findTournament(state, tId);
    if (!t) return 'Турнир не найден';
    if (t.status === 'finished') return 'Турнир завершён';
    if (!t.regOpen && t.status !== 'registration') return 'Регистрация закрыта';
    if (t.registrations.some((r) => r.userId === userId && r.status !== 'refunded')) {
      return 'Игрок уже в списке';
    }
    const active = t.registrations.filter((r) => r.status !== 'refunded').length;
    if (active >= t.maxPlayers) return 'Турнир заполнен';

    const registrations = [
      ...t.registrations,
      { userId, status: 'registered' as const, registeredAt: Date.now(), checkedInAt: null },
    ];
    await firestore.tournamentsMeta.update(tId, { registrations });
    return null;
  },

  async removeRegistration(tId: string, userId: string) {
    const t = findTournament(state, tId);
    if (!t) return;
    const registrations = t.registrations.filter((r) => r.userId !== userId);
    await firestore.tournamentsMeta.update(tId, { registrations });

    const stateData = await realtime.getTournamentState(tId);
    if (stateData?.tables) {
      const tables = stateData.tables.map((tb: any) => ({
        ...tb,
        seats: tb.seats.map((s: string | null) => (s === userId ? null : s)),
      }));
      await realtime.updateTournamentState(tId, { tables });
    }
  },

  async toggleCheckIn(tId: string, userId: string) {
    const t = findTournament(state, tId);
    if (!t) return;
    const registrations = t.registrations.map((r) => {
      if (r.userId === userId) {
        return {
          ...r,
          status: r.status === 'checked-in' ? 'registered' : 'checked-in',
          checkedInAt: r.status === 'checked-in' ? null : Date.now(),
        };
      }
      return r;
    });
    await firestore.tournamentsMeta.update(tId, { registrations });
  },

  // ---------- Рассадка ----------
  async autoSeat(tId: string, algo: SeatAlgo): Promise<string | null> {
    const t = findTournament(state, tId);
    if (!t) return 'Турнир не найден';
    if (t.status !== 'registration') return 'Рассадка возможна до старта';
    if (!t.tables.length) return 'Сначала добавьте столы в разделе «Столы»';

    const regs = t.registrations.filter((r) => r.status !== 'refunded');
    let pool = regs.map((r) => r.userId);
    const checked = regs.filter((r) => r.status === 'checked-in').map((r) => r.userId);
    if (checked.length >= 2) pool = checked;
    if (pool.length < 2) return 'Нужно минимум 2 участника с чекином';
    if (totalSeats(t) < pool.length) return 'Не хватает мест: добавьте столы или места';

    if (algo === 'rating') {
      const pts = seasonPoints(state, t.seasonId);
      pool = [...pool].sort((a, b) => (pts.get(b) ?? 0) - (pts.get(a) ?? 0));
    } else {
      pool = shuffle(pool);
    }

    const tables = t.tables.map((tb) => ({
      ...tb,
      seats: tb.seats.map(() => null as string | null),
    }));

    pool.forEach((userId, i) => {
      let tableIdx: number;
      if (algo === 'rating') {
        const n = tables.length;
        const round = Math.floor(i / n);
        const pos = i % n;
        tableIdx = round % 2 === 0 ? pos : n - 1 - pos;
      } else {
        const counts = tables.map((tb) => tb.seats.filter(Boolean).length);
        tableIdx = counts.indexOf(Math.min(...counts));
      }
      const tb = tables[tableIdx];
      const seatIdx = tb.seats.indexOf(null);
      if (seatIdx >= 0) tb.seats[seatIdx] = userId;
    });

    await realtime.updateTournamentState(tId, { tables });
    return null;
  },

  async moveSeat(tId: string, fromT: number, fromS: number, toT: number, toS: number) {
    const stateData = await realtime.getTournamentState(tId);
    if (!stateData?.tables) return;

    const tables = stateData.tables.map((tb: any) => ({ ...tb }));
    const a = tables.find((tb: any) => tb.number === fromT);
    const b = tables.find((tb: any) => tb.number === toT);
    if (!a || !b) return;

    const tmp = a.seats[fromS];
    a.seats[fromS] = b.seats[toS];
    b.seats[toS] = tmp;

    await realtime.updateTournamentState(tId, { tables });
  },

  async balanceTables(tId: string): Promise<string | null> {
    const stateData = await realtime.getTournamentState(tId);
    if (!stateData?.tables) return 'Нет столов';

    const tables = stateData.tables.map((tb: any) => ({ ...tb }));

    for (let guard = 0; guard < 100; guard++) {
      const counts = tables.map((tb: any) => tb.seats.filter(Boolean).length);
      const maxI = counts.indexOf(Math.max(...counts));
      const minI = counts.indexOf(Math.min(...counts));
      if (counts[maxI] - counts[minI] <= 1) break;

      const from = tables[maxI];
      const to = tables[minI];
      const sIdx = from.seats.findIndex(Boolean);
      const tIdx = to.seats.findIndex((s: string | null) => s === null);
      if (sIdx < 0 || tIdx < 0) break;

      to.seats[tIdx] = from.seats[sIdx];
      from.seats[sIdx] = null;
    }

    await realtime.updateTournamentState(tId, { tables });
    return null;
  },

  // ---------- Ход игры ----------
  async startTournament(tId: string): Promise<string | null> {
    console.log('🔵 startTournament() вызвана для', tId);
    
    const t = findTournament(state, tId);
    if (!t) {
      console.error('❌ Турнир не найден');
      return 'Турнир не найден';
    }
    
    if (t.status !== 'registration') {
      console.error('❌ Турнир уже запущен, статус:', t.status);
      return 'Турнир уже запущен';
    }

    const other = state.tournaments.find((x) => x.id !== tId && isLive(x));
    if (other) {
      console.error('❌ Активный турнир уже есть:', other.name);
      return `Сейчас идёт «${other.name}» — одновременно возможен только один турнир`;
    }

    const checkedIn = t.registrations.filter(r => r.status === 'checked-in');
    if (checkedIn.length < 2) {
      console.error('❌ Недостаточно игроков с чекином:', checkedIn.length);
      return `Нужно минимум 2 игрока с чекином. Сейчас: ${checkedIn.length}`;
    }

    if (!t.tables || t.tables.length === 0) {
      console.log('🔵 Столов нет, создаём...');
      const err = await actions.autoSeat(tId, 'balanced');
      if (err) {
        console.error('❌ Ошибка авторассадки:', err);
        return err;
      }
      console.log('✅ Авторассадка выполнена');
    }

    const updatedT = findTournament(state, tId);
    const seated = updatedT?.tables?.reduce((sum, tb) => sum + tb.seats.filter(Boolean).length, 0) || 0;
    if (seated < 2) {
      console.error('❌ Игроки не рассажены, за столами:', seated);
      return 'Игроки не рассажены. Сделайте авторассадку.';
    }

    const now = Date.now();
    const lateRegUntil = t.lateRegMinutes > 0 ? now + t.lateRegMinutes * 60000 : null;

    console.log('🔵 Запускаем турнир...');
    
    try {
      await realtime.updateTournamentState(tId, {
        status: 'active',
        currentLevel: 0,
        levelStartedAt: now,
        lateRegUntil,
        pausedRemaining: null,
        breakEndsAt: null,
      });
      console.log('✅ Состояние обновлено в Realtime DB');
    } catch (error) {
      console.error('❌ Ошибка обновления Realtime DB:', error);
      return 'Ошибка при запуске турнира';
    }

    try {
      await firestore.tournamentsMeta.update(tId, { 
        status: 'active',
        currentLevel: 0,
        levelStartedAt: now,
      });
      console.log('✅ Метаданные обновлены в Firestore');
    } catch (error) {
      console.error('❌ Ошибка обновления Firestore:', error);
      return 'Ошибка при обновлении метаданных';
    }

    notice(state, 'all', `Турнир «${t.name}» стартовал — фишки в игре`, 'alert');
    if (t.lateRegMinutes > 0) {
      notice(state, 'all', `Поздняя регистрация на «${t.name}» открыта ${t.lateRegMinutes} мин`, 'info');
    }

    console.log('✅ Турнир успешно запущен!');
    return null;
  },

  async pauseTournament(tId: string) {
    const t = findTournament(state, tId);
    if (!t || t.status !== 'active') return;

    const now = Date.now();
    const rem = levelRemainingMs(t, now);

    await realtime.updateTournamentState(tId, {
      status: 'paused',
      pausedRemaining: rem,
      levelStartedAt: null,
    });

    await firestore.tournamentsMeta.update(tId, { status: 'paused' });
  },

  async resumeTournament(tId: string) {
    const t = findTournament(state, tId);
    if (!t || t.status !== 'paused') return;

    const dur = levelDurationMs(t);
    const rem = t.pausedRemaining ?? dur;
    const now = Date.now();

    await realtime.updateTournamentState(tId, {
      status: 'active',
      levelStartedAt: now - (dur - rem),
      pausedRemaining: null,
    });

    await firestore.tournamentsMeta.update(tId, { status: 'active' });
  },

  async adjustTimer(tId: string, deltaSec: number): Promise<string | null> {
    const t = findTournament(state, tId);
    if (!t) return 'Турнир не найден';
    if (!isLive(t)) return 'Таймер идёт только во время игры';

    const stateData = await realtime.getTournamentState(tId);
    if (!stateData) return 'Состояние не найдено';

    const now = Date.now();
    const dur = levelDurationMs(t);

    if (t.status === 'break' && t.breakEndsAt != null) {
      await realtime.updateTournamentState(tId, {
        breakEndsAt: Math.max(now, t.breakEndsAt + deltaSec * 1000),
      });
    } else if (t.status === 'paused' && t.pausedRemaining != null) {
      const newRem = Math.min(dur, Math.max(0, t.pausedRemaining + deltaSec * 1000));
      await realtime.updateTournamentState(tId, { pausedRemaining: newRem });
    } else if (t.status === 'active' && t.levelStartedAt != null) {
      const rem = Math.max(0, dur - (now - t.levelStartedAt));
      const newRem = Math.min(dur, Math.max(0, rem + deltaSec * 1000));
      await realtime.updateTournamentState(tId, {
        levelStartedAt: now - (dur - newRem),
      });
    }

    return null;
  },

  async adjustLateReg(tId: string, deltaMin: number) {
    const t = findTournament(state, tId);
    if (!t || !isLive(t)) return;

    const now = Date.now();
    const current = t.lateRegUntil != null && t.lateRegUntil > now ? t.lateRegUntil : now;
    const newUntil = Math.max(0, current + deltaMin * 60000);

    await realtime.updateTournamentState(tId, { lateRegUntil: newUntil });

    if (newUntil < now) {
      notice(state, 'all', `«${t.name}»: поздняя регистрация закрыта`, 'info');
    }
  },

  async nextLevel(tId: string): Promise<string | null> {
    const t = findTournament(state, tId);
    if (!t) return 'Турнир не найден';
    if (t.currentLevel >= t.levels.length - 1) return 'Это последний уровень структуры';

    const newLevel = t.currentLevel + 1;
    const now = Date.now();

    const br = t.breaks.find((b) => b.afterLevel === newLevel);

    const updateData: any = {
      currentLevel: newLevel,
      levelStartedAt: now,
      pausedRemaining: null,
    };

    if (br) {
      updateData.status = 'break';
      updateData.breakEndsAt = now + br.duration * 60000;
      updateData.levelStartedAt = null;
      await firestore.tournamentsMeta.update(tId, { status: 'break' });
      notice(state, 'all', `«${t.name}»: перерыв ${br.duration} мин`, 'info');
    } else {
      updateData.status = 'active';
      updateData.breakEndsAt = null;
      await firestore.tournamentsMeta.update(tId, { status: 'active' });
    }

    await realtime.updateTournamentState(tId, updateData);
    return null;
  },

  async prevLevel(tId: string) {
    const t = findTournament(state, tId);
    if (!t || t.currentLevel === 0) return;

    const newLevel = t.currentLevel - 1;
    const now = Date.now();

    await realtime.updateTournamentState(tId, {
      currentLevel: newLevel,
      levelStartedAt: now,
      status: 'active',
      breakEndsAt: null,
      pausedRemaining: null,
    });

    await firestore.tournamentsMeta.update(tId, { status: 'active' });
  },

  async startBreak(tId: string, minutes = 15) {
    const t = findTournament(state, tId);
    if (!t || (t.status !== 'active' && t.status !== 'paused')) return;

    const now = Date.now();
    const rem = t.status === 'active' ? levelRemainingMs(t, now) : (t.pausedRemaining ?? levelDurationMs(t));

    await realtime.updateTournamentState(tId, {
      status: 'break',
      breakEndsAt: now + minutes * 60000,
      pausedRemaining: rem,
      levelStartedAt: null,
    });

    await firestore.tournamentsMeta.update(tId, { status: 'break' });
    notice(state, 'all', `«${t.name}»: перерыв ${minutes} мин`, 'info');
  },

  async endBreak(tId: string) {
    const t = findTournament(state, tId);
    if (!t || t.status !== 'break') return;

    const dur = levelDurationMs(t);
    const rem = t.pausedRemaining ?? dur;
    const now = Date.now();

    await realtime.updateTournamentState(tId, {
      status: 'active',
      levelStartedAt: now - (dur - rem),
      breakEndsAt: null,
      pausedRemaining: null,
    });

    await firestore.tournamentsMeta.update(tId, { status: 'active' });
  },

  // ---------- Выбывшие и возвраты ----------
  async eliminate(tId: string, userId: string, killerId: string | null): Promise<string | null> {
    console.log('🔵 eliminate() вызвана');
    
    const t = findTournament(state, tId);
    if (!t) {
      console.error('❌ Турнир не найден');
      return 'Турнир не найден';
    }
    
    if (t.status === 'finished') {
      console.error('❌ Турнир завершён');
      return 'Турнир завершён';
    }
    
    if (isEliminated(t, userId)) {
      console.error('❌ Игрок уже выбыл');
      return 'Игрок уже выбыл';
    }

    const now = Date.now();

    console.log('🔵 Получаем состояние из Realtime DB...');
    const stateData = await realtime.getTournamentState(tId);
    if (!stateData) {
      console.error('❌ Состояние не найдено');
      return 'Состояние не найдено';
    }

    const tables = (stateData.tables || []).map((tb: any) => ({
      ...tb,
      seats: (tb.seats || []).map((s: string | null) => (s === userId ? null : s)),
    }));

    const knockouts = [...(stateData.knockouts || []), { 
      userId, 
      killerId, 
      level: t.currentLevel || 0, 
      at: now 
    }];

    console.log('🔵 Сохраняем в Realtime DB...');
    await realtime.updateTournamentState(tId, { tables, knockouts });

    const name = nicknameOf(state, userId);
    if (killerId) {
      notice(state, 'all', `Нокаут! ${nicknameOf(state, killerId)} выбивает ${name}`, 'alert');
    } else {
      notice(state, 'all', `${name} покидает турнир (блайнды)`, 'info');
    }

    const updatedT = findTournament(state, tId);
    if (updatedT) {
      formFinalTableIfNeeded(state, updatedT);
      if (remainingCount(updatedT) === 1) {
        notice(state, 'all', `«${updatedT.name}»: остался один игрок — фиксируйте результат`, 'win');
      }
    }

    console.log('✅ eliminate() завершена');
    return null;
  },

  async addRebuy(tId: string, userId: string, kind: RebuyKind): Promise<string | null> {
    const t = findTournament(state, tId);
    if (!t) return 'Турнир не найден';
    if (!isLive(t)) return 'Действие доступно только во время игры';
    if (!t.registrations.some((r) => r.userId === userId && r.status !== 'refunded')) {
      return 'Игрок не участвует в турнире';
    }

    const eliminated = isEliminated(t, userId);
    const now = Date.now();

    if (eliminated) {
      if (!isLateRegOpen(t, now)) return 'Поздняя регистрация закрыта — вернуть игрока нельзя';
      if (!findFreeSeat(t)) return 'Нет свободных мест за столами';
    } else {
      if (kind === 'reentry' || kind === 'lastchance') return 'Игрок ещё в игре — ре-ентри недоступно';
      if (!t.rebuyAllowed) return 'В этом турнире ребаи запрещены';
      if (t.currentLevel > t.rebuyUntilLevel) {
        return `Ребаи закрыты после уровня ${t.rebuyUntilLevel + 1}`;
      }
      if (kind === 'rebuy') {
        const cnt = t.rebuys.filter((r) => r.userId === userId && r.kind === 'rebuy').length;
        if (cnt >= t.maxRebuys) return `Лимит ребаев (${t.maxRebuys}) исчерпан`;
      } else if (t.rebuys.some((r) => r.userId === userId && r.kind === 'addon')) {
        return 'Аддон уже куплен';
      }
    }

    const stateData = await realtime.getTournamentState(tId);
    if (!stateData) return 'Состояние не найдено';

    const rebuys = [...(stateData.rebuys || []), { userId, kind, at: now }];

    if (eliminated) {
      const knockouts = stateData.knockouts.filter((k: any) => k.userId !== userId);
      const tables = stateData.tables.map((tb: any) => ({ ...tb }));

      for (const tb of tables) {
        const idx = tb.seats.indexOf(null);
        if (idx >= 0) {
          tb.seats[idx] = userId;
          break;
        }
      }

      await realtime.updateTournamentState(tId, { rebuys, knockouts, tables });
      notice(state, 'all', `${nicknameOf(state, userId)} возвращается в игру`, 'alert');
    } else {
      await realtime.updateTournamentState(tId, { rebuys });
      notice(state, 'all', `${nicknameOf(state, userId)} — ${REBUY_LABELS[kind] || kind}`, 'info');
    }

    return null;
  },

  async addBonus(tId: string, userId: string, name: string, chips: number): Promise<string | null> {
    const t = findTournament(state, tId);
    if (!t) return 'Турнир не найден';
    if (!isLive(t)) return 'Бонусы раздаются только во время игры';
    if (!name.trim()) return 'Укажите название бонуса';
    if (!chips || chips <= 0) return 'Укажите количество фишек';
    if (isEliminated(t, userId)) return 'Игрок уже выбыл — бонус недоступен';

    const stateData = await realtime.getTournamentState(tId);
    if (!stateData) return 'Состояние не найдено';

    const bonuses = [...(stateData.bonuses || []), { 
      id: uid('bn'), 
      userId, 
      name: name.trim(), 
      chips: Math.round(chips), 
      at: Date.now() 
    }];

    await realtime.updateTournamentState(tId, { bonuses });
    
    // Обновляем локальное состояние
    const updatedT = findTournament(state, tId);
    if (updatedT) {
      updatedT.bonuses = bonuses;
    }
    
    notice(state, 'all', `${nicknameOf(state, userId)} получает бонус «${name}»: +${chips.toLocaleString('ru-RU')} фишек в банк`, 'win');

    return null;
  },

  // ---------- Завершение ----------
  async finishTournament(tId: string): Promise<string | null> {
    console.log('🔵 finishTournament() вызвана для', tId);
    
    const t = findTournament(state, tId);
    if (!t) {
      console.error('❌ Турнир не найден');
      return 'Турнир не найден';
    }
    
    if (t.results) {
      console.log('ℹ️ Результаты уже опубликованы');
      return 'Результаты уже опубликованы';
    }
    
    if (t.status === 'registration') {
      console.error('❌ Турнир ещё не стартовал');
      return 'Турнир ещё не стартовал';
    }

    console.log('🔵 Получаем состояние из Realtime DB...');
    const stateData = await realtime.getTournamentState(tId);
    if (!stateData) {
      console.error('❌ Состояние не найдено в Realtime DB');
      return 'Состояние не найдено';
    }
    
    console.log('🔵 Состояние получено');

    console.log('🔵 Вычисляем provisionalResults...');
    const order = provisionalResults(t);
    const n = order.length;
    console.log('🔵 Порядок мест:', order);

    const results: Result[] = order.map(({ userId, place }) => {
      const ko = t.knockouts?.filter((k) => k.killerId === userId).length || 0;
      const rb = t.rebuys?.filter((r) => r.userId === userId && r.kind !== 'addon').length || 0;
      const ad = t.rebuys?.filter((r) => r.userId === userId && r.kind === 'addon').length || 0;
      const ret = t.rebuys?.filter((r) => r.userId === userId && (r.kind === 'reentry' || r.kind === 'lastchance')).length || 0;
      const pts = t.nonScoring ? 0 : scoreForPlace(t.scoring, place, ko);
      return { userId, place, points: pts, knockouts: ko, rebuys: rb, addons: ad, returns: ret };
    });

    console.log('🔵 Результаты:', results);

    try {
      console.log('🔵 Сохраняем результаты в Firestore...');
      await firestore.results.batchCreate(tId, results);
      console.log('✅ Результаты сохранены в Firestore');
    } catch (error) {
      console.error('❌ Ошибка сохранения результатов:', error);
      return 'Ошибка сохранения результатов';
    }

    try {
      console.log('🔵 Обновляем метаданные турнира...');
      await firestore.tournamentsMeta.update(tId, {
        status: 'finished',
        regOpen: false,
        results: results.map((r) => ({ 
          userId: r.userId, 
          place: r.place, 
          points: r.points, 
          knockouts: r.knockouts, 
          rebuys: r.rebuys, 
          addons: r.addons, 
          returns: r.returns 
        })),
      });
      console.log('✅ Метаданные обновлены');
    } catch (error) {
      console.error('❌ Ошибка обновления метаданных:', error);
      return 'Ошибка обновления метаданных';
    }

    try {
      console.log('🔵 Обновляем состояние в Realtime DB...');
      await realtime.updateTournamentState(tId, {
        status: 'finished',
        breakEndsAt: null,
        levelStartedAt: null,
        lateRegUntil: null,
      });
      console.log('✅ Состояние обновлено в Realtime DB');
    } catch (error) {
      console.error('❌ Ошибка обновления состояния:', error);
      return 'Ошибка обновления состояния';
    }

    // Обновляем локальное состояние
    const updatedTournament = findTournament(state, tId);
    if (updatedTournament) {
      updatedTournament.status = 'finished';
      updatedTournament.results = results;
      updatedTournament.regOpen = false;
    }
    emit();

    console.log('🔵 Обновляем статистику игроков...');
    const seasonId = t.seasonId;
    const ratingUpdates: Array<{
      userId: string;
      points: number;
      events: number;
      wins: number;
      top3: number;
      finalTables: number;
      knockouts: number;
      returns: number;
      bestPoints: number;
    }> = [];

    for (const r of results) {
      const u = findUser(state, r.userId);
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

      try {
        await firestore.users.update(u.id, { stats: u.stats });
      } catch (error) {
        console.error(`❌ Ошибка обновления статистики для ${u.id}:`, error);
      }

      const fresh = freshAchievements(u.stats, u.achievements, state.achievements);
      if (fresh.length) {
        u.achievements.push(...fresh.map((f) => f.id));
        try {
          await firestore.users.update(u.id, { achievements: u.achievements });
        } catch (error) {
          console.error(`❌ Ошибка обновления достижений для ${u.id}:`, error);
        }
        fresh.forEach((f) => {
          notice(state, u.id, `Новое достижение: «${f.name}»`, 'win');
        });
      }

      ratingUpdates.push({
        userId: r.userId,
        points: r.points,
        events: 1,
        wins: r.place === 1 ? 1 : 0,
        top3: r.place <= 3 ? 1 : 0,
        finalTables: r.place <= 9 ? 1 : 0,
        knockouts: r.knockouts,
        returns: r.returns,
        bestPoints: r.points,
      });
    }

    try {
      if (seasonId) {
        console.log('🔵 Обновляем рейтинг сезона...');
        await firestore.ratings.updateBatch(seasonId, ratingUpdates);
      }
      console.log('🔵 Обновляем глобальный рейтинг...');
      await firestore.ratings.updateBatch('global', ratingUpdates);
      console.log('✅ Рейтинги обновлены');
    } catch (error) {
      console.error('❌ Ошибка обновления рейтингов:', error);
    }

    const winner = results.find((r) => r.place === 1);
    notice(state, 'all', `«${t.name}» завершён — побеждает ${winner ? nicknameOf(state, winner.userId) : '—'}!`, 'win');
    
    console.log('✅ Турнир успешно завершён!');
    return null;
  },

  // ---------- Финал сезона ----------
  async createSeasonFinal(seasonId: string): Promise<string | null> {
    const season = state.seasons.find((s) => s.id === seasonId);
    if (!season) return 'Сезон не найден';
    if (state.tournaments.some((t) => t.nonScoring && t.seasonId === seasonId)) {
      return 'Финальный турнир сезона уже создан';
    }

    const board = computeBoard(state, seasonId);
    const top = board.slice(0, 18).map((b) => b.userId);
    if (top.length < 2) return 'В зачёте сезона меньше двух игроков — финал невозможен';

    const id = uid('tr');
    const date = new Date(Date.now() + 7 * 86400000);
    date.setHours(19, 0, 0, 0);

    const nTables = Math.max(1, Math.ceil(top.length / 9));
    const tables = Array.from({ length: nTables }, (_, i) => ({
      number: i + 1,
      isFinal: nTables === 1,
      capacity: 9,
      seats: Array(9).fill(null) as (string | null)[],
    }));

    top.forEach((userId, i) => {
      const round = Math.floor(i / nTables);
      const pos = i % nTables;
      const tableIdx = round % 2 === 0 ? pos : nTables - 1 - pos;
      const tb = tables[tableIdx];
      const seatIdx = tb.seats.indexOf(null);
      if (seatIdx >= 0) tb.seats[seatIdx] = userId;
    });

    const tournament: Tournament = {
      id,
      name: `Финал сезона · ${season.name}`,
      templateId: null,
      seasonId,
      date: date.toISOString(),
      description: 'Финальный турнир сезона для топ-18 рейтинга. Очки не начисляются, в зачёт рейтингов не входит.',
      type: 'freezeout',
      maxPlayers: 18,
      startingChips: 30000,
      levels: [
        { sb: 50, bb: 100, ante: 0, duration: 15 },
        { sb: 100, bb: 200, ante: 0, duration: 15 },
        { sb: 150, bb: 300, ante: 0, duration: 15 },
        { sb: 200, bb: 400, ante: 50, duration: 15 },
        { sb: 300, bb: 600, ante: 75, duration: 15 },
        { sb: 400, bb: 800, ante: 100, duration: 15 },
        { sb: 600, bb: 1200, ante: 150, duration: 15 },
        { sb: 800, bb: 1600, ante: 200, duration: 15 },
        { sb: 1200, bb: 2400, ante: 300, duration: 15 },
        { sb: 2000, bb: 4000, ante: 500, duration: 15 },
      ],
      breaks: [
        { afterLevel: 3, duration: 20 },
        { afterLevel: 6, duration: 20 },
      ],
      rebuyAllowed: false,
      maxRebuys: 0,
      rebuyCostChips: 0,
      rebuyUntilLevel: 0,
      lateRegMinutes: 30,
      lateRegUntil: null,
      bonusDefs: [{ name: 'Чип-бонус', chips: 10000 }],
      scoring: { grid: [], participation: 0, knockoutPoints: 0, knockoutEnabled: false },
      nonScoring: true,
      finalTableAt: 9,
      status: 'registration',
      regOpen: false,
      currentLevel: 0,
      levelStartedAt: null,
      pausedRemaining: null,
      breakEndsAt: null,
      registrations: top.map((userId) => ({
        userId,
        status: 'checked-in' as const,
        registeredAt: Date.now(),
        checkedInAt: Date.now(),
      })),
      tables,
      knockouts: [],
      rebuys: [],
      bonuses: [],
      results: null,
      createdBy: sessionUid ?? 'u_admin',
      createdAt: Date.now(),
    };

    await firestore.tournamentsMeta.set(id, tournament);
    await realtime.initTournamentState(id, {
      status: 'registration',
      currentLevel: 0,
      levelStartedAt: null,
      pausedRemaining: null,
      breakEndsAt: null,
      lateRegUntil: null,
      tables,
      knockouts: [],
      rebuys: [],
      bonuses: [],
      playersCount: 0,
      averageStack: 0,
    });

    notice(state, 'all', `Сформирован финал сезона «${season.name}» — топ-18 в списке`, 'win');
    return id;
  },

  async fillSeasonFinalReserves(tId: string): Promise<string | null> {
    const t = findTournament(state, tId);
    if (!t || !t.nonScoring) return 'Это не финальный турнир сезона';
    if (t.status === 'finished') return 'Турнир завершён';

    const board = computeBoard(state, t.seasonId);
    const top18 = new Set(board.slice(0, 18).map((b) => b.userId));
    const registered = new Set(t.registrations.map((r) => r.userId));
    let added = 0;

    const registrations = [...t.registrations];
    for (const row of board) {
      if (registrations.length >= t.maxPlayers) break;
      if (top18.has(row.userId)) continue;
      if (registered.has(row.userId)) continue;
      registrations.push({
        userId: row.userId,
        status: 'registered' as const,
        registeredAt: Date.now(),
        checkedInAt: null,
      });
      registered.add(row.userId);
      added += 1;
    }

    if (added > 0) {
      await firestore.tournamentsMeta.update(tId, { registrations });
      notice(state, 'all', `Финал сезона: из резерва добавлено игроков — ${added}`, 'info');
    }

    return null;
  },

  // ---------- ТВ-экраны ----------
  async saveDisplay(d: DisplayCfg) {
    await firestore.displays.set(d.id, d);
  },

  async deleteDisplay(id: string) {
    await firestore.displays.delete(id);
  },

  // ---------- Настройки ----------
  async saveSettings(patch: Partial<ClubSettings>) {
    await firestore.settings.update(patch);
  },

  // ---------- Достижения ----------
  async saveAchievement(def: AchievementDef): Promise<string | null> {
    if (!def.name.trim()) return 'Укажите название достижения';
    if (!def.condition || def.condition.min < 0) return 'Укажите порог условия';
    await firestore.achievements.set(def.id, def);
    return null;
  },

  async deleteAchievement(id: string) {
    await firestore.achievements.delete(id);
  },

  // ---------- Уведомления ----------
  markNoticesRead(userId: string) {
    firestore.notices.markRead(userId);
  },

  pushNotice(userId: string, text: string, kind: Notice['kind'] = 'info') {
    notice(state, userId, text, kind);
  },
};

// ============================================================
//  ЭКСПОРТЫ (ТОЛЬКО ОДИН РАЗ)
// ============================================================

export function subscribeStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState(): DB {
  return state;
}

export function getVersion(): number {
  return version;
}

// Единая функция для получения sessionUid (асинхронная)
export async function getSessionUid(): Promise<string | null> {
  if (!authInitialized) {
    const user = await waitForAuth();
    authInitialized = true;
    if (user) {
      sessionUid = user.uid;
      try {
        sessionStorage.setItem('gt_uid', user.uid);
      } catch {}
    } else {
      sessionUid = null;
      try {
        sessionStorage.removeItem('gt_uid');
      } catch {}
    }
  }
  return sessionUid;
}

// Синхронная версия для быстрого доступа — ЭТО ЕДИНСТВЕННОЕ ОБЪЯВЛЕНИЕ
export function getSessionUidSync(): string | null {
  return sessionUid;
}

export function noticesFor(db: DB, userId: string): Notice[] {
  return db.notices.filter((n) => n.userId === userId || n.userId === 'all');
}

export function unreadCount(db: DB, userId: string): number {
  const marker = db.readMarkers[userId] ?? 0;
  return noticesFor(db, userId).filter((n) => n.at > marker).length;
}

export function liveTournament(db: DB): Tournament | undefined {
  return db.tournaments.find((t) => isLive(t));
}

export default actions;