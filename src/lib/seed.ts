import type {
  BlindLevel, DB, ResultEntry, ScoringConfig, Season, TableState, Template, Tournament, User, UserStats,
} from "../types";
import { DEFAULT_ACHIEVEMENTS, defaultGrid, defaultScoring, scoreForPlace } from "./formulas";

/** конфигурация столов по умолчанию: по 9 мест */
function defaultTables(maxPlayers: number): TableState[] {
  const n = Math.max(2, Math.ceil(maxPlayers / 9));
  return Array.from({ length: n }, (_, i) => ({
    number: i + 1, isFinal: false, capacity: 9, seats: Array(9).fill(null) as (string | null)[],
  }));
}

/* Детерминированный ГПСЧ — демо-данные одинаковы при каждом пересоздании. */
let s = 20260212;
function rnd(): number {
  s = (s * 9301 + 49297) % 233280;
  return s / 233280;
}

const day = 86_400_000;
function iso(offsetDays: number, hour = 19, minute = 0): string {
  const d = new Date(Date.now() + offsetDays * day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function levels(duration: number, anteFrom = 6): BlindLevel[] {
  const rows: Array<[number, number]> = [
    [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400],
    [300, 600], [400, 800], [600, 1200], [800, 1600], [1000, 2000],
    [1500, 3000], [2000, 4000], [3000, 6000],
  ];
  return rows.map(([sb, bb], i) => ({ sb, bb, ante: i >= anteFrom ? Math.round(bb / 8) : 0, duration }));
}

const NAMES: Array<[string, string, string]> = [
  ["Даниил Крылов", "RiverKing", "u01"], ["Артём Волков", "Штиль", "u02"],
  ["Сергей Лебедев", "Механик", "u03"], ["Игорь Стрелецкий", "Барон", "u04"],
  ["Никита Морозов", "Спутник", "u05"], ["Егор Савельев", "Кэш", "u06"],
  ["Тимур Алиев", "Восток", "u07"], ["Павел Зимин", "Профессор", "u08"],
  ["Глеб Ушаков", "Тихоня", "u09"], ["Роман Дементьев", "Флеш", "u10"],
  ["Степан Козлов", "Баттон", "u11"], ["Кирилл Мельник", "Олл-ин", "u12"],
  ["Анна Ветрова", "Королева", "u13"], ["Лев Штейн", "Гамбит", "u14"],
  ["Олег Белов", "Тайм", "u15"], ["Марк Фридман", "Сэндвич", "u16"],
  ["Вадим Громов", "Север", "u17"], ["Илья Соловьёв", "Чиплидер", "u18"],
  ["Денис Царёв", "Ривермен", "u19"], ["Антон Черкасов", "Блеф", "u20"],
  ["Максим Юдин", "Джек", "u21"], ["Владимир Ким", "Азия", "u22"],
  ["Пётр Сомов", "Сет", "u23"], ["Григорий Ланской", "Туз", "u24"],
  ["Эдуард Валеев", "Бродвей", "u25"], ["Семён Рожков", "Панда", "u26"],
  ["Артур Багиров", "Кавказ", "u27"],
];

function genStats(i: number): UserStats {
  const tp = 4 + ((i * 7) % 26);
  const wins = i % 9 === 0 ? 2 : i % 5 === 0 ? 1 : 0;
  const ft = wins + ((i * 3) % 6);
  const ko = (i * 11) % 24;
  const itm = Math.min(tp, Math.round(tp * (0.2 + (i % 4) * 0.08)) + wins);
  const totalPlace = tp * (4 + (i % 6));
  return {
    tournamentsPlayed: tp, wins, top3: wins + (i % 4), finalTables: ft, knockouts: ko,
    rebuys: (i * 2) % 7, returns: i % 6 === 0 ? 1 + (i % 3) : i % 3 === 0 ? 1 : 0,
    inMoney: itm, totalPlace,
    bestPlace: wins ? 1 : 2 + (i % 8),
    bestPoints: (wins ? 118 : 62) + (i % 9) * 4,
  };
}

function buildUsers(): User[] {
  const now = Date.now();
  const users: User[] = [
    {
      id: "u_admin", email: "admin@tuz.club", password: "poker123",
      firstName: "Виктор", lastName: "Орлов", nickname: "Директор", phone: "+7 916 000-00-01",
      role: "admin", hue: 43, photoURL: null, cover: 1, registeredAt: now - 400 * day, isBlocked: false, archived: false, manualPoints: 0,
      stats: genStats(3), achievements: ["ach_first"],
    },
    {
      id: "u_op", email: "op@tuz.club", password: "poker123",
      firstName: "Марина", lastName: "Соколова", nickname: "Крупье", phone: "+7 916 000-00-02",
      role: "operator", hue: 160, photoURL: null, cover: 3, registeredAt: now - 350 * day, isBlocked: false, archived: false, manualPoints: 0,
      stats: genStats(6), achievements: ["ach_first"],
    },
  ];
  for (let i = 0; i < NAMES.length; i += 1) {
    const [full, nickname, id] = NAMES[i];
    const [firstName, ...rest] = full.split(" ");
    const stats: UserStats = i === 0
      ? { tournamentsPlayed: 27, wins: 3, top3: 8, finalTables: 9, knockouts: 31, rebuys: 5, returns: 2, inMoney: 13, totalPlace: 148, bestPlace: 1, bestPoints: 134 }
      : genStats(i);
    const user: User = {
      id,
      email: id === "u01" ? "player@tuz.club" : `${nickname.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "")}@tuz.club`,
      password: "poker123",
      firstName, lastName: rest.join(" "), nickname,
      phone: `+7 9${(10 + i).toString().padStart(2, "0")} ${100 + i * 3}-${String(10 + i).padStart(2, "0")}-${String(20 + i).padStart(2, "0")}`,
      role: "player",
      hue: (i * 47 + 12) % 360,
      photoURL: null,
      cover: i % 6,
      registeredAt: now - (300 - i * 6) * day,
      isBlocked: i === 20,
      archived: i === 25,
      manualPoints: i === 24 ? 60 : 0,
      stats,
      achievements: [],
    };
    const earned: string[] = [];
    if (stats.tournamentsPlayed >= 1) earned.push("ach_first");
    if (stats.tournamentsPlayed >= 10) earned.push("ach_marathon");
    if (stats.tournamentsPlayed >= 25) earned.push("ach_grinder");
    if (stats.finalTables >= 1) earned.push("ach_ft");
    if (stats.finalTables >= 5) earned.push("ach_ft5");
    if (stats.knockouts >= 10) earned.push("ach_ko10");
    if (stats.knockouts >= 25) earned.push("ach_ko25");
    if (stats.wins >= 1) earned.push("ach_win");
    if (stats.wins >= 3) earned.push("ach_win3");
    if (stats.returns >= 1) earned.push("ach_comeback");
    if (stats.bestPoints >= 100) earned.push("ach_big");
    user.achievements = earned;
    users.push(user);
  }
  return users;
}

function buildSeasons(): Season[] {
  return [
    { id: "s_2025", name: "Сезон 2025 · Классика", startDate: "2025-01-10", endDate: "2025-12-20", isActive: false, archived: true },
    { id: "s_winter26", name: "Зимняя серия 2026", startDate: "2026-01-09", endDate: "2026-03-29", isActive: true, archived: false },
  ];
}

function buildTemplates(): Template[] {
  const sc = defaultScoring();
  return [
    {
      id: "tpl_weekly", name: "Пятничный Фризаут", type: "freezeout",
      description: "Классический еженедельный турнир клуба: ровная структура, два перерыва.",
      startingChips: 20000, maxPlayers: 45, levels: levels(12),
      breaks: [{ afterLevel: 3, duration: 15 }, { afterLevel: 7, duration: 15 }],
      rebuyAllowed: false, maxRebuys: 0, rebuyCostChips: 0, rebuyUntilLevel: 0,
      lateRegMinutes: 45, bonusDefs: [{ name: "Чип-бонус", chips: 5000 }],
      scoring: { ...sc, grid: defaultGrid() },
      tables: defaultTables(45),
    },
    {
      id: "tpl_bounty", name: "Баунти Хантер", type: "bounty",
      description: "Очки за каждое выбивание. Агрессивная игра поощряется.",
      startingChips: 15000, maxPlayers: 36, levels: levels(12),
      breaks: [{ afterLevel: 4, duration: 15 }],
      rebuyAllowed: false, maxRebuys: 0, rebuyCostChips: 0, rebuyUntilLevel: 0,
      lateRegMinutes: 40, bonusDefs: [{ name: "Бонус за баунти", chips: 3000 }, { name: "Чип-бонус", chips: 5000 }],
      scoring: { grid: defaultGrid(), participation: 10, knockoutPoints: 8, knockoutEnabled: true },
      tables: defaultTables(36),
    },
    {
      id: "tpl_rebuy", name: "Ребай-Марафон", type: "rebuy",
      description: "Длинные уровни, три ребая и аддон — для любителей глубокой игры.",
      startingChips: 15000, maxPlayers: 40, levels: levels(15, 5),
      breaks: [{ afterLevel: 4, duration: 20 }],
      rebuyAllowed: true, maxRebuys: 3, rebuyCostChips: 10000, rebuyUntilLevel: 5,
      lateRegMinutes: 60, bonusDefs: [{ name: "Чип-бонус", chips: 5000 }],
      scoring: { ...sc, grid: defaultGrid() },
      tables: defaultTables(40),
    },
    {
      id: "tpl_turbo", name: "Турбо-Финал", type: "freezeout",
      description: "Быстрые уровни по 8 минут — для финальных событий серий.",
      startingChips: 10000, maxPlayers: 30, levels: levels(8),
      breaks: [{ afterLevel: 5, duration: 10 }],
      rebuyAllowed: false, maxRebuys: 0, rebuyCostChips: 0, rebuyUntilLevel: 0,
      lateRegMinutes: 30, bonusDefs: [],
      scoring: { grid: defaultGrid(), participation: 8, knockoutPoints: 0, knockoutEnabled: false },
      tables: defaultTables(30),
    },
  ];
}

const P = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => `u${String(from + i).padStart(2, "0")}`);

function pastTournament(
  id: string, name: string, templateId: string, seasonId: string,
  offsetDays: number, participants: string[], scoring: ScoringConfig,
  dateIso: string, tpl: Template,
): Tournament {
  const results: ResultEntry[] = participants.map((userId, i) => {
    const place = i + 1;
    const ko = place <= 3 ? 2 + Math.floor(rnd() * 3) : Math.floor(rnd() * 3);
    return {
      userId, place,
      points: scoreForPlace(scoring, place, ko),
      knockouts: ko,
      rebuys: tpl.rebuyAllowed ? Math.floor(rnd() * 2) : 0,
      addons: tpl.rebuyAllowed && rnd() > 0.6 ? 1 : 0,
      returns: tpl.rebuyAllowed && rnd() > 0.72 ? 1 : 0,
    };
  });
  return {
    id, name, templateId, seasonId, date: dateIso,
    description: "Завершённый турнир серии.",
    type: tpl.type, maxPlayers: tpl.maxPlayers, startingChips: tpl.startingChips,
    levels: tpl.levels, breaks: tpl.breaks,
    rebuyAllowed: tpl.rebuyAllowed, maxRebuys: tpl.maxRebuys,
    rebuyCostChips: tpl.rebuyCostChips, rebuyUntilLevel: tpl.rebuyUntilLevel,
    lateRegMinutes: tpl.lateRegMinutes, lateRegUntil: null,
    bonusDefs: tpl.bonusDefs, scoring, nonScoring: false, finalTableAt: 9,
    status: "finished", regOpen: false,
    currentLevel: tpl.levels.length - 1, levelStartedAt: null, pausedRemaining: null, breakEndsAt: null,
    registrations: participants.map((userId, i) => ({
      userId, status: "checked-in" as const,
      registeredAt: Date.now() + (offsetDays - 2) * day + i * 60000, checkedInAt: Date.now() + offsetDays * day - 3600_000,
    })),
    tables: [], knockouts: [],
    rebuys: results.flatMap((r) => Array.from({ length: r.rebuys + r.addons }, (_, k) => ({
      userId: r.userId, kind: k < r.rebuys ? ("rebuy" as const) : ("addon" as const), at: Date.now() + offsetDays * day,
    }))),
    bonuses: [],
    results,
    createdBy: "u_admin", createdAt: Date.now() + (offsetDays - 3) * day,
  };
}

function buildTournaments(): Tournament[] {
  const now = Date.now();
  const tpls = buildTemplates();

  const scBounty = { grid: defaultGrid(), participation: 10, knockoutPoints: 8, knockoutEnabled: true };
  const p1 = pastTournament("tr_p1", "Пятничный Фризаут #10", "tpl_weekly", "s_winter26", -9, P(1, 14), defaultScoring(), iso(-9), tpls[0]);
  const p2 = pastTournament("tr_p2", "Ребай-Марафон #2", "tpl_rebuy", "s_winter26", -2, P(6, 16), defaultScoring(), iso(-2), tpls[2]);
  const p3 = pastTournament("tr_p3", "Кубок Сезона 2025 · Финал", "tpl_weekly", "s_2025", -55, P(3, 12), defaultScoring(), iso(-55), tpls[0]);
  p1.results![0].userId = "u01"; p1.results![2].userId = "u02"; p1.results![1].userId = "u13";
  p2.results![0].userId = "u13"; p2.results![1].userId = "u07"; p2.results![2].userId = "u01";

  /* --- живой турнир: Баунти прямо сейчас, уровень 4, 21 игрок за 3 столами --- */
  const live: Tournament = {
    id: "tr_live", name: "Баунти Хантер #4", templateId: "tpl_bounty", seasonId: "s_winter26",
    date: iso(0, 19), description: "Четвёртый баунти-турнир зимней серии. Очки за каждое выбивание.",
    type: "bounty", maxPlayers: 36, startingChips: 15000,
    levels: levels(12), breaks: [{ afterLevel: 4, duration: 15 }],
    rebuyAllowed: false, maxRebuys: 0, rebuyCostChips: 0, rebuyUntilLevel: 0,
    lateRegMinutes: 40, lateRegUntil: now + 22 * 60_000,
    bonusDefs: [{ name: "Бонус за баунти", chips: 3000 }, { name: "Чип-бонус", chips: 5000 }],
    scoring: scBounty, nonScoring: false, finalTableAt: 9,
    status: "active", regOpen: true,
    currentLevel: 3, levelStartedAt: now - 5.5 * 60_000, pausedRemaining: null, breakEndsAt: null,
    registrations: P(1, 24).map((userId, i) => ({
      userId, status: "checked-in" as const,
      registeredAt: now - 3 * day + i * 60000, checkedInAt: now - 3 * 60_000,
    })),
    tables: [
      { number: 1, isFinal: false, capacity: 9, seats: ["u01", "u02", "u03", "u04", "u05", "u06", "u07", null, "u08"] },
      { number: 2, isFinal: false, capacity: 9, seats: ["u09", "u10", "u11", "u12", "u13", "u14", null, "u15", "u16"] },
      { number: 3, isFinal: false, capacity: 9, seats: ["u17", "u18", "u19", null, "u20", "u21", null, null, null] },
    ],
    knockouts: [
      { userId: "u22", killerId: "u01", level: 1, at: now - 95 * 60000 },
      { userId: "u23", killerId: "u07", level: 2, at: now - 68 * 60000 },
      { userId: "u24", killerId: "u13", level: 3, at: now - 21 * 60000 },
    ],
    rebuys: [],
    bonuses: [
      { id: "bn_seed1", userId: "u01", name: "Чип-бонус", chips: 5000, at: now - 47 * 60000 },
      { id: "bn_seed2", userId: "u13", name: "Бонус за баунти", chips: 3000, at: now - 18 * 60000 },
    ],
    results: null,
    createdBy: "u_op", createdAt: now - 4 * day,
  };

  const reg1: Tournament = {
    id: "tr_reg1", name: "Зимний Кубок · Отборочный A", templateId: "tpl_weekly", seasonId: "s_winter26",
    date: iso(5, 19), description: "Отборочный этап Зимнего Кубка. Победитель получает место в финале серии.",
    type: "freezeout", maxPlayers: 45, startingChips: 20000,
    levels: levels(12), breaks: [{ afterLevel: 3, duration: 15 }, { afterLevel: 7, duration: 15 }],
    rebuyAllowed: false, maxRebuys: 0, rebuyCostChips: 0, rebuyUntilLevel: 0,
    lateRegMinutes: 45, lateRegUntil: null,
    bonusDefs: [{ name: "Чип-бонус", chips: 5000 }],
    scoring: defaultScoring(), nonScoring: false, finalTableAt: 9,
    status: "registration", regOpen: true,
    currentLevel: 0, levelStartedAt: null, pausedRemaining: null, breakEndsAt: null,
    registrations: P(1, 17).map((userId, i) => ({
      userId,
      status: i < 9 ? ("checked-in" as const) : ("registered" as const),
      registeredAt: now - 2 * day + i * 3600_000,
      checkedInAt: i < 9 ? now - 3600_000 : null,
    })),
    tables: [], knockouts: [], rebuys: [], bonuses: [], results: null,
    createdBy: "u_admin", createdAt: now - 2 * day,
  };
  reg1.registrations[0].userId = "u01";

  const reg2: Tournament = {
    id: "tr_reg2", name: "Турбо-Финал Серии", templateId: "tpl_turbo", seasonId: "s_winter26",
    date: iso(12, 20), description: "Быстрый финал серии — уровни по 8 минут.",
    type: "freezeout", maxPlayers: 30, startingChips: 10000,
    levels: levels(8), breaks: [{ afterLevel: 5, duration: 10 }],
    rebuyAllowed: false, maxRebuys: 0, rebuyCostChips: 0, rebuyUntilLevel: 0,
    lateRegMinutes: 30, lateRegUntil: null,
    bonusDefs: [],
    scoring: { grid: defaultGrid(), participation: 8, knockoutPoints: 0, knockoutEnabled: false },
    nonScoring: false, finalTableAt: 6,
    status: "registration", regOpen: true,
    currentLevel: 0, levelStartedAt: null, pausedRemaining: null, breakEndsAt: null,
    registrations: P(2, 6).map((userId, i) => ({
      userId, status: "registered" as const,
      registeredAt: now - day + i * 3600_000, checkedInAt: null,
    })),
    tables: [], knockouts: [], rebuys: [], bonuses: [], results: null,
    createdBy: "u_op", createdAt: now - day,
  };

  return [live, reg1, reg2, p2, p1, p3];
}

export function buildSeed(): DB {
  const now = Date.now();
  const online = ["u01", "u02", "u05", "u07", "u13", "u_admin", "u_op"];
  const inTour = ["u01", "u02", "u05", "u07", "u13"];
  return {
    v: 5,
    users: buildUsers(),
    achievements: JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS)),
    seasons: buildSeasons(),
    templates: buildTemplates(),
    tournaments: buildTournaments(),
    displays: [
      { id: "d_main", name: "Главный экран · Зал", mode: "main", tournamentId: "tr_live" },
      { id: "d_final", name: "Финальный стол", mode: "final", tournamentId: "tr_live" },
      { id: "d_res", name: "Результаты · Ресепшен", mode: "results", tournamentId: null },
    ],
    notices: [
      { id: "n1", userId: "all", text: "Регистрация на «Зимний Кубок · Отборочный A» открыта — 45 мест", at: now - 2 * 3600_000, kind: "info" },
      { id: "n2", userId: "all", text: "«Баунти Хантер #4» за столами — следите за экраном зала", at: now - 40 * 60000, kind: "alert" },
      { id: "n3", userId: "all", text: "Суббота: сателлит на Зимний Кубок, начало в 15:00", at: now - 5 * 3600_000, kind: "info" },
      { id: "n4", userId: "u01", text: "Вы записаны на «Зимний Кубок · Отборочный A» — не забудьте чекин", at: now - 3600_000, kind: "info" },
    ],
    settings: {
      clubName: "Золотой Туз",
      tagline: "Спортивный покер-клуб · турниры, рейтинги, сезоны",
      language: "ru",
      primary: "#d4a017",
      background: "#0a0a12",
      soundsEnabled: true,
      soundVolume: 70,
      defaultScoring: defaultScoring(),
    },
    presence: Object.fromEntries(
      ["u01", "u02", "u03", "u05", "u07", "u13", "u18", "u_admin", "u_op", "u04", "u11", "u25"].map((u, i) => [
        u,
        {
          status: online.includes(u) ? ("online" as const) : ("offline" as const),
          lastSeen: now - i * 7 * 60000,
          tournamentId: inTour.includes(u) ? "tr_live" : null,
        },
      ]),
    ),
    readMarkers: { u01: now - 90 * 60000 },
  };
}
