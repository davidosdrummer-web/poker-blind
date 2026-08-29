import type {
  AchievementDef, BlindLevel, BoardRow, BreakRule, DB, RebuyKind, ScoringConfig, Tournament,
  TournamentType, User, UserStats,
} from "../types";

/* ---------------- утилиты ---------------- */

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter}`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function fullName(u: Pick<User, "firstName" | "lastName">): string {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "—";
}

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

export function fmtChips(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} млн`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}К`;
  return fmtNum(n);
}

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ru-RU");
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "только что";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} мин назад`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} ч назад`;
  return `${Math.floor(d / 86_400_000)} дн назад`;
}

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

/* ---------------- таймеры и состояние турнира ---------------- */

export function levelDurationMs(t: Tournament): number {
  const lvl = t.levels[Math.min(t.currentLevel, t.levels.length - 1)];
  return (lvl?.duration ?? 12) * 60_000;
}

export function levelRemainingMs(t: Tournament, now: number): number {
  if (t.status === "paused" && t.pausedRemaining != null) return t.pausedRemaining;
  if (t.status !== "active" || t.levelStartedAt == null) return levelDurationMs(t);
  return Math.max(0, levelDurationMs(t) - (now - t.levelStartedAt));
}

export function breakRemainingMs(t: Tournament, now: number): number {
  if (t.breakEndsAt == null) return 0;
  return Math.max(0, t.breakEndsAt - now);
}

export function isLateRegOpen(t: Tournament, now: number): boolean {
  return t.status !== "finished" && t.lateRegUntil != null && t.lateRegUntil > now;
}

export function lateRegRemainingMs(t: Tournament, now: number): number {
  if (t.lateRegUntil == null) return 0;
  return Math.max(0, t.lateRegUntil - now);
}

export function seatedPlayers(t: Tournament): string[] {
  const out: string[] = [];
  for (const tb of t.tables) for (const s of tb.seats) if (s) out.push(s);
  return out;
}

export function remainingCount(t: Tournament): number {
  return seatedPlayers(t).length;
}

export function structureMinutes(levels: BlindLevel[], breaks: BreakRule[]): number {
  return levels.reduce((s, l) => s + l.duration, 0) + breaks.reduce((s, b) => s + b.duration, 0);
}

export function totalSeats(t: Tournament): number {
  return t.tables.reduce((s, tb) => s + tb.seats.length, 0);
}

/* ---------------- банк фишек ---------------- */

/** Сколько фишек вносит в банк действие */
export function injectionChips(t: Tournament, kind: RebuyKind): number {
  if (kind === "rebuy") return t.rebuyCostChips || t.startingChips;
  if (kind === "addon") return Math.round(t.startingChips * 0.5);
  if (kind === "reentry") return t.startingChips;
  return Math.round(t.startingChips * 0.75); // lastchance
}

export interface ChipBreakdown {
  entries: number;
  entryChips: number;
  rebuys: number;
  addons: number;
  reentries: number;
  lastchances: number;
  bonusChips: number;
  total: number;
}

/**
 * Банк турнира: входы + все возвраты + бонусы.
 * Фишки выбывших НЕ вычитаются — стеки по ходу игры не отслеживаются.
 */
export function chipBreakdown(t: Tournament): ChipBreakdown {
  const entries = t.registrations.filter((r) => r.status !== "refunded").length;
  const entryChips = entries * t.startingChips;
  const rebuys = t.rebuys.filter((r) => r.kind === "rebuy").length;
  const addons = t.rebuys.filter((r) => r.kind === "addon").length;
  const reentries = t.rebuys.filter((r) => r.kind === "reentry").length;
  const lastchances = t.rebuys.filter((r) => r.kind === "lastchance").length;
  const bonusChips = t.bonuses.reduce((s, b) => s + b.chips, 0);
  const total = entryChips
    + rebuys * injectionChips(t, "rebuy")
    + addons * injectionChips(t, "addon")
    + reentries * injectionChips(t, "reentry")
    + lastchances * injectionChips(t, "lastchance")
    + bonusChips;
  return { entries, entryChips, rebuys, addons, reentries, lastchances, bonusChips, total };
}

export function averageStack(t: Tournament): number {
  const n = remainingCount(t);
  if (!n) return 0;
  return Math.round(chipBreakdown(t).total / n);
}

/* ---------------- очки ---------------- */

export function defaultGrid(): Array<{ place: number; points: number }> {
  const pts = [100, 70, 55, 45, 38, 32, 27, 23, 20, 18];
  return pts.map((points, i) => ({ place: i + 1, points }));
}

export function defaultScoring(): ScoringConfig {
  return { grid: defaultGrid(), participation: 10, knockoutPoints: 5, knockoutEnabled: true };
}

export function scoreForPlace(s: ScoringConfig, place: number, knockouts: number): number {
  const row = s.grid.find((g) => g.place === place);
  const ko = s.knockoutEnabled ? knockouts * s.knockoutPoints : 0;
  return s.participation + (row?.points ?? 0) + ko;
}

export function scoringText(s: ScoringConfig): string {
  const top = [...s.grid].sort((a, b) => a.place - b.place).slice(0, 3)
    .map((g) => `#${g.place}→${g.points}`).join(" ");
  const ko = s.knockoutEnabled ? ` · нокаут +${s.knockoutPoints}` : " · нокауты выкл.";
  return `участие +${s.participation} · ${top} …${ko}`;
}

export function itmCutoff(n: number): number {
  return Math.max(1, Math.ceil(n * 0.15));
}

export const TYPE_LABELS: Record<TournamentType, string> = {
  freezeout: "Фризаут", rebuy: "Ребай", addon: "Аддон", bounty: "Баунти",
};

/* ---------------- статистика и достижения ---------------- */

export function emptyStats(): UserStats {
  return { tournamentsPlayed: 0, wins: 0, top3: 0, finalTables: 0, knockouts: 0, rebuys: 0, returns: 0, inMoney: 0, totalPlace: 0, bestPlace: 0, bestPoints: 0 };
}

export function avgPlace(s: UserStats): number {
  return s.tournamentsPlayed ? s.totalPlace / s.tournamentsPlayed : 0;
}

export function itmRate(s: UserStats): number {
  return s.tournamentsPlayed ? Math.round((s.inMoney / s.tournamentsPlayed) * 100) : 0;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "ach_first", name: "Первая раздача", description: "Сыграть первый турнир клуба", icon: "cards", check: (s) => s.tournamentsPlayed >= 1 },
  { id: "ach_win", name: "Первая победа", description: "Занять 1-е место", icon: "trophy", check: (s) => s.wins >= 1 },
  { id: "ach_win3", name: "Хет-трик", description: "Три победы в турнирах", icon: "crown", check: (s) => s.wins >= 3 },
  { id: "ach_ft", name: "Финальный стол", description: "Войти в финальный стол", icon: "table", check: (s) => s.finalTables >= 1 },
  { id: "ach_ft5", name: "Завсегдатай финалок", description: "5 финальных столов", icon: "table", check: (s) => s.finalTables >= 5 },
  { id: "ach_ko10", name: "Охотник", description: "10 выбитых игроков", icon: "crosshair", check: (s) => s.knockouts >= 10 },
  { id: "ach_ko25", name: "Гроза столов", description: "25 выбитых игроков", icon: "crosshair", check: (s) => s.knockouts >= 25 },
  { id: "ach_marathon", name: "Марафонец", description: "10 сыгранных турниров", icon: "shield", check: (s) => s.tournamentsPlayed >= 10 },
  { id: "ach_grinder", name: "Гриндер", description: "25 сыгранных турниров", icon: "flame", check: (s) => s.tournamentsPlayed >= 25 },
  { id: "ach_itm", name: "Стабильность", description: "ITM 40% и выше (мин. 5 турниров)", icon: "gem", check: (s) => s.tournamentsPlayed >= 5 && itmRate(s) >= 40 },
  { id: "ach_comeback", name: "Феникс", description: "Вернуться в игру после вылета", icon: "flame", check: (s) => s.returns >= 1 },
  { id: "ach_big", name: "Крупный улов", description: "100+ очков за один турнир", icon: "gem", check: (s) => s.bestPoints >= 100 },
];

export function freshAchievements(s: UserStats, owned: string[]): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !owned.includes(a.id) && a.check(s));
}

/* ---------------- рейтинги ---------------- */

/**
 * Накопительный рейтинг по прошедшим турнирам.
 * seasonId = null → глобальный зачёт (плюс ручные начисления администратора).
 */
export function computeBoard(db: DB, seasonId: string | null): BoardRow[] {
  const acc = new Map<string, BoardRow>();
  const blank = (userId: string): BoardRow => ({
    userId, points: 0, events: 0, wins: 0, top3: 0, finalTables: 0,
    knockouts: 0, returns: 0, bestPoints: 0, manualPoints: 0, rank: 0,
  });
  for (const t of db.tournaments) {
    if (!t.results) continue;
    if (seasonId && t.seasonId !== seasonId) continue;
    for (const r of t.results) {
      let row = acc.get(r.userId);
      if (!row) { row = blank(r.userId); acc.set(r.userId, row); }
      row.points += r.points;
      row.events += 1;
      if (r.place === 1) row.wins += 1;
      if (r.place <= 3) row.top3 += 1;
      if (r.place <= 9) row.finalTables += 1;
      row.knockouts += r.knockouts;
      row.returns += r.returns;
      if (r.points > row.bestPoints) row.bestPoints = r.points;
    }
  }
  if (!seasonId) {
    for (const u of db.users) {
      if (!u.manualPoints) continue;
      let row = acc.get(u.id);
      if (!row) { row = blank(u.id); acc.set(u.id, row); }
      row.manualPoints = u.manualPoints;
      row.points += u.manualPoints;
    }
  }
  const rows = [...acc.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.top3 - a.top3);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

/** Предварительный порядок мест: оставшиеся — по времени чекина, выбывшие — в обратном порядке вылета. */
export function provisionalResults(t: Tournament): Array<{ userId: string; place: number }> {
  const regAt = new Map<string, number>();
  for (const r of t.registrations) regAt.set(r.userId, r.checkedInAt ?? r.registeredAt);
  const remaining = seatedPlayers(t).sort((a, b) => (regAt.get(a) ?? 0) - (regAt.get(b) ?? 0));
  const out = [...t.knockouts].reverse().map((k) => k.userId);
  return [...remaining, ...out].map((userId, i) => ({ userId, place: i + 1 }));
}
