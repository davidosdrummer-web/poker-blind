/* ============================================================
   Доменная модель клуба «Золотой Туз».
   Центральная БД (src/lib/store.ts): localStorage + BroadcastChannel,
   прямой аналог Firebase RTDB + Firestore из ТЗ.
   ============================================================ */

export type Role = "admin" | "operator" | "player";
export type TournamentStatus = "registration" | "active" | "break" | "paused" | "finished";
export type TournamentType = "freezeout" | "rebuy" | "addon" | "bounty";
export type RegStatus = "registered" | "checked-in" | "refunded";
export type DisplayMode = "main" | "final" | "results";
export type SeatAlgo = "random" | "rating" | "balanced";
export type RebuyKind = "rebuy" | "addon" | "reentry" | "lastchance";

export interface BlindLevel { sb: number; bb: number; ante: number; duration: number; }
export interface BreakRule { afterLevel: number; duration: number; }

export interface ScoringGridRow { place: number; points: number; }
export interface ScoringConfig {
  grid: ScoringGridRow[];
  /** очки за участие — каждому игроку в зачёте */
  participation: number;
  knockoutPoints: number;
  knockoutEnabled: boolean;
}

export interface BonusDef { name: string; chips: number; }

export interface UserStats {
  tournamentsPlayed: number;
  wins: number;
  top3: number;
  finalTables: number;
  knockouts: number;
  rebuys: number;
  /** возвращения в турниры (ре-ентри, ласт шанс) */
  returns: number;
  inMoney: number;
  totalPlace: number;
  bestPlace: number;
  /** лучший результат очков за один турнир */
  bestPoints: number;
}

export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  role: Role;
  /** оттенок аватара, 0–360 */
  hue: number;
  /** загруженный аватар (dataURL) */
  photoURL: string | null;
  registeredAt: number;
  isBlocked: boolean;
  archived: boolean;
  /** очки, начисленные администратором вручную (попадают в глобальный рейтинг) */
  manualPoints: number;
  stats: UserStats;
  achievements: string[];
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  archived: boolean;
}

export interface Template {
  id: string;
  name: string;
  type: TournamentType;
  description: string;
  startingChips: number;
  maxPlayers: number;
  levels: BlindLevel[];
  breaks: BreakRule[];
  rebuyAllowed: boolean;
  maxRebuys: number;
  rebuyCostChips: number;
  rebuyUntilLevel: number;
  /** время поздней регистрации после старта, минуты (0 — выключено) */
  lateRegMinutes: number;
  bonusDefs: BonusDef[];
  scoring: ScoringConfig;
  /** конфигурация столов по умолчанию */
  tables: TableState[];
}

export interface Registration {
  userId: string;
  status: RegStatus;
  registeredAt: number;
  checkedInAt: number | null;
}

export interface TableState {
  number: number;
  isFinal: boolean;
  capacity: number;
  seats: (string | null)[];
}

export interface Knockout { userId: string; killerId: string | null; level: number; at: number; }
export interface RebuyRecord { userId: string; kind: RebuyKind; at: number; }
export interface BonusRecord { id: string; userId: string; name: string; chips: number; at: number; }

export interface ResultEntry {
  userId: string;
  place: number;
  points: number;
  knockouts: number;
  rebuys: number;
  addons: number;
  returns: number;
}

export interface Tournament {
  id: string;
  name: string;
  templateId: string | null;
  seasonId: string;
  date: string;
  description: string;
  type: TournamentType;
  maxPlayers: number;
  startingChips: number;
  levels: BlindLevel[];
  breaks: BreakRule[];
  rebuyAllowed: boolean;
  maxRebuys: number;
  rebuyCostChips: number;
  rebuyUntilLevel: number;
  lateRegMinutes: number;
  /** дедлайн поздней регистрации (ts), null — закрыта */
  lateRegUntil: number | null;
  bonusDefs: BonusDef[];
  scoring: ScoringConfig;
  /** финал сезона: очки не начисляются и не попадают в рейтинги */
  nonScoring: boolean;
  /** при каком количестве оставшихся игроков формируется общий финальный стол (0 — выключено) */
  finalTableAt: number;
  status: TournamentStatus;
  regOpen: boolean;
  currentLevel: number;
  levelStartedAt: number | null;
  pausedRemaining: number | null;
  breakEndsAt: number | null;
  registrations: Registration[];
  tables: TableState[];
  knockouts: Knockout[];
  rebuys: RebuyRecord[];
  bonuses: BonusRecord[];
  results: ResultEntry[] | null;
  /** финал сезона: топ-18, очки не начисляются, вне зачёта рейтингов */
  seasonFinal?: boolean;
  createdBy: string;
  createdAt: number;
}

export interface DisplayCfg { id: string; name: string; mode: DisplayMode; tournamentId: string | null; }
export interface Notice { id: string; userId: string; text: string; at: number; kind: "info" | "win" | "alert"; }

export interface ClubSettings {
  clubName: string;
  tagline: string;
  language: "ru" | "en";
  primary: string;
  defaultScoring: ScoringConfig;
}

export interface PresenceInfo { status: "online" | "offline"; lastSeen: number; tournamentId: string | null; }

export interface DB {
  v: number;
  users: User[];
  seasons: Season[];
  templates: Template[];
  tournaments: Tournament[];
  displays: DisplayCfg[];
  notices: Notice[];
  settings: ClubSettings;
  presence: Record<string, PresenceInfo>;
  readMarkers: Record<string, number>;
}

export interface BoardRow {
  userId: string;
  points: number;
  events: number;
  wins: number;
  top3: number;
  finalTables: number;
  knockouts: number;
  returns: number;
  bestPoints: number;
  manualPoints: number;
  rank: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: "cards" | "trophy" | "table" | "crosshair" | "shield" | "flame" | "crown" | "gem";
  check: (s: UserStats) => boolean;
}
