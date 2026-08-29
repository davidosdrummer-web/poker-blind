// src/lib/constants.ts
import type { AchievementDef, ScoringConfig } from '../types';

// Счётчик для генерации ID
let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter}`;
}

// Стартовая сетка очков по умолчанию
export function defaultGrid(): Array<{ place: number; points: number }> {
  const pts = [100, 70, 55, 45, 38, 32, 27, 23, 20, 18];
  return pts.map((points, i) => ({ place: i + 1, points }));
}

// Конфигурация очков по умолчанию
export function defaultScoring(): ScoringConfig {
  return { grid: defaultGrid(), participation: 10, knockoutPoints: 5, knockoutEnabled: true };
}

// Встроенная библиотека достижений
export const DEFAULT_ACHIEVEMENTS: AchievementDef[] = [
  { id: "ach_first", name: "Первая раздача", description: "Сыграть первый турнир клуба", icon: "cards", condition: { stat: "tournamentsPlayed", min: 1 }, builtIn: true },
  { id: "ach_win", name: "Первая победа", description: "Занять 1-е место", icon: "trophy", condition: { stat: "wins", min: 1 }, builtIn: true },
  { id: "ach_win3", name: "Хет-трик", description: "Три победы в турнирах", icon: "crown", condition: { stat: "wins", min: 3 }, builtIn: true },
  { id: "ach_ft", name: "Финальный стол", description: "Войти в финальный стол", icon: "table", condition: { stat: "finalTables", min: 1 }, builtIn: true },
  { id: "ach_ft5", name: "Завсегдатай финалок", description: "5 финальных столов", icon: "table", condition: { stat: "finalTables", min: 5 }, builtIn: true },
  { id: "ach_ko10", name: "Охотник", description: "Выбить 10 игроков", icon: "crosshair", condition: { stat: "knockouts", min: 10 }, builtIn: true },
  { id: "ach_ko25", name: "Гроза столов", description: "Выбить 25 игроков", icon: "crosshair", condition: { stat: "knockouts", min: 25 }, builtIn: true },
  { id: "ach_marathon", name: "Марафонец", description: "10 сыгранных турниров", icon: "shield", condition: { stat: "tournamentsPlayed", min: 10 }, builtIn: true },
  { id: "ach_grinder", name: "Гриндер", description: "25 сыгранных турниров", icon: "flame", condition: { stat: "tournamentsPlayed", min: 25 }, builtIn: true },
  { id: "ach_money", name: "Призовой регуляр", description: "5 попаданий в призовую зону", icon: "gem", condition: { stat: "inMoney", min: 5 }, builtIn: true },
  { id: "ach_comeback", name: "Феникс", description: "Вернуться в игру после вылета", icon: "flame", condition: { stat: "returns", min: 1 }, builtIn: true },
  { id: "ach_big", name: "Крупный улов", description: "100+ очков за один турнир", icon: "gem", condition: { stat: "bestPoints", min: 100 }, builtIn: true },
];

// Метки для типов возвратов
export const REBUY_LABELS: Record<string, string> = {
  rebuy: "Рабай",
  addon: "Аддон",
  reentry: "Ре-ентри",
  lastchance: "Ласт шанс",
};