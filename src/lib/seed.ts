import type { DB } from "../types";
import { DEFAULT_ACHIEVEMENTS, defaultScoring } from "./formulas";

/**
 * Начальное состояние платформы при боевом запуске.
 * База пуста: первый зарегистрированный пользователь автоматически
 * получает роль администратора и настраивает клуб (сезоны, шаблоны,
 * турниры, экраны, игроков).
 */
export function buildInitial(): DB {
  return {
    v: 7,
    users: [],
    achievements: JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS)),
    seasons: [],
    templates: [],
    tournaments: [],
    displays: [
      { id: "d_main", name: "Главный экран · Зал", mode: "main", tournamentId: null },
      { id: "d_final", name: "Финальный стол", mode: "final", tournamentId: null },
      { id: "d_res", name: "Результаты · Ресепшен", mode: "results", tournamentId: null },
    ],
    notices: [],
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
    presence: {},
    readMarkers: {},
  };
}
