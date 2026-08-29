// src/lib/formulas.ts — только изменённая функция chipBreakdown

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

export function chipBreakdown(t: Tournament): ChipBreakdown {
  const entries = t.registrations.filter((r) => r.status !== "refunded").length;
  const entryChips = entries * t.startingChips;
  
  const rebuys = t.rebuys.filter((r) => r.kind === "rebuy").length;
  const addons = t.rebuys.filter((r) => r.kind === "addon").length;
  const reentries = t.rebuys.filter((r) => r.kind === "reentry").length;
  const lastchances = t.rebuys.filter((r) => r.kind === "lastchance").length;
  
  // Суммируем бонусы из Realtime DB
  const bonusChips = t.bonuses.reduce((s, b) => s + b.chips, 0);
  
  const total = entryChips
    + rebuys * injectionChips(t, "rebuy")
    + addons * injectionChips(t, "addon")
    + reentries * injectionChips(t, "reentry")
    + lastchances * injectionChips(t, "lastchance")
    + bonusChips;
    
  return { 
    entries, 
    entryChips, 
    rebuys, 
    addons, 
    reentries, 
    lastchances, 
    bonusChips, 
    total 
  };
}