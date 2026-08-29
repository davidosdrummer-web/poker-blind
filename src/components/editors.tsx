import { useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, Coffee, GripVertical, Plus, Shuffle, Trash2, Trophy, X } from "lucide-react";
import type { BlindLevel, BonusDef, BreakRule, ScoringConfig, TableState, User } from "../types";
import { cx, fmtDuration, fmtNum, fullName, structureMinutes } from "../lib/formulas";
import { Avatar, Badge, Button, Field, Input, Toggle } from "./ui";

/* ============================ СЕТКА ОЧКОВ ============================ */

export function ScoringEditor({ value, onChange, showKnockout = true }: {
  value: ScoringConfig;
  onChange: (v: ScoringConfig) => void;
  showKnockout?: boolean;
}) {
  const grid = [...value.grid].sort((a, b) => a.place - b.place);
  const setPlace = (place: number, points: number) => {
    onChange({ ...value, grid: value.grid.map((g) => (g.place === place ? { ...g, points: Math.max(0, points) } : g)) });
  };
  const addPlace = () => {
    const maxPlace = grid.reduce((m, g) => Math.max(m, g.place), 0);
    const last = grid[grid.length - 1];
    const suggested = Math.max(2, Math.round(((last?.points ?? 20) * 0.8) / 2) * 2);
    onChange({ ...value, grid: [...value.grid, { place: maxPlace + 1, points: suggested }] });
  };
  const removePlace = (place: number) => {
    onChange({ ...value, grid: value.grid.filter((g) => g.place !== place) });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">Сетка начисления очков</span>
          <Button size="xs" variant="dark" onClick={addPlace}><Plus size={12} /> Место</Button>
        </div>
        <div className="grid max-h-64 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto pr-1 md:grid-cols-3">
          {grid.map((g) => (
            <div key={g.place} className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800/50 px-2 py-1">
              <span className={cx(
                "tabular w-9 shrink-0 text-center font-mono text-xs font-bold",
                g.place === 1 ? "text-gold-400" : g.place === 2 ? "text-ink-200" : g.place === 3 ? "text-[#c07a3d]" : "text-ink-400",
              )}>
                #{g.place}
              </span>
              <Input
                type="number" value={g.points}
                onChange={(e) => setPlace(g.place, Number(e.target.value) || 0)}
                className="h-8 border-transparent bg-transparent px-1 text-center font-mono text-sm font-bold text-cream-100 hover:border-ink-600"
              />
              <button onClick={() => removePlace(g.place)} className="shrink-0 text-ink-500 transition-colors hover:text-danger-400" title="Убрать место">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        {grid.length === 0 && <div className="rounded-lg border border-dashed border-ink-600 px-3 py-4 text-center text-xs text-ink-400">Добавьте места — очки за участие начисляются всем</div>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Очки за участие" hint="начисляются каждому игроку в зачёте">
          <Input type="number" value={value.participation} onChange={(e) => onChange({ ...value, participation: Math.max(0, Number(e.target.value) || 0) })} className="font-mono" />
        </Field>
        {showKnockout && (
          <div className="rounded-lg border border-ink-700 bg-ink-800/50 p-3">
            <Toggle
              checked={value.knockoutEnabled}
              onChange={(v) => onChange({ ...value, knockoutEnabled: v })}
              label="Очки за выбивание"
            />
            {value.knockoutEnabled && (
              <div className="mt-2.5">
                <Input type="number" value={value.knockoutPoints} onChange={(e) => onChange({ ...value, knockoutPoints: Math.max(0, Number(e.target.value) || 0) })} className="h-8 font-mono text-xs" />
                <div className="mt-1 text-[10px] text-ink-500">очков за каждого выбитого игрока</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ СТРУКТУРА ============================ */

type StructItem = { kind: "level"; idx: number; lvl: BlindLevel } | { kind: "break"; idx: number; br: BreakRule };

export function StructureEditor({ levels, breaks, onLevels, onBreaks }: {
  levels: BlindLevel[];
  breaks: BreakRule[];
  onLevels: (l: BlindLevel[]) => void;
  onBreaks: (b: BreakRule[]) => void;
}) {
  const items: StructItem[] = [];
  levels.forEach((lvl, idx) => {
    items.push({ kind: "level", idx, lvl });
    breaks.filter((b) => b.afterLevel === idx).forEach((br) => items.push({ kind: "break", idx: breaks.indexOf(br), br }));
  });

  const totalMin = structureMinutes(levels, breaks);

  const patchLevel = (i: number, patch: Partial<BlindLevel>) => {
    onLevels(levels.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };
  const moveLevel = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= levels.length) return;
    const next = [...levels];
    [next[i], next[j]] = [next[j], next[i]];
    // перерывы «привязаны» к уровням — двигаются вместе
    const brNext = breaks.map((b) => {
      if (b.afterLevel === i) return { ...b, afterLevel: j };
      if (b.afterLevel === j) return { ...b, afterLevel: i };
      return b;
    });
    onLevels(next);
    onBreaks(brNext);
  };
  const removeLevel = (i: number) => {
    onLevels(levels.filter((_, j) => j !== i));
    onBreaks(breaks.filter((b) => b.afterLevel !== i).map((b) => (b.afterLevel > i ? { ...b, afterLevel: b.afterLevel - 1 } : b)));
  };
  const patchBreak = (i: number, patch: Partial<BreakRule>) => {
    onBreaks(breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  };
  const moveBreak = (i: number, dir: -1 | 1) => {
    const cur = breaks[i];
    if (!cur) return;
    const target = cur.afterLevel + dir;
    if (target < 0 || target >= levels.length) return;
    onBreaks(breaks.map((b, j) => (j === i ? { ...b, afterLevel: target } : b)));
  };
  const removeBreak = (i: number) => onBreaks(breaks.filter((_, j) => j !== i));

  const addLevel = () => {
    const last = levels[levels.length - 1] ?? { sb: 25, bb: 50, ante: 0, duration: 12 };
    onLevels([...levels, { sb: last.sb * 2, bb: last.bb * 2, ante: last.ante * 2, duration: last.duration }]);
  };
  const addBreak = () => {
    onBreaks([...breaks, { afterLevel: Math.max(0, levels.length - 2), duration: 15 }]);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Уровни и перерывы · <span className="font-mono text-gold-300">{levels.length} ур.</span>
        </span>
        <Badge tone="gold" className="px-3 py-1">
          продолжительность: {fmtDuration(totalMin)}
        </Badge>
      </div>

      <div className="mb-2 grid grid-cols-[28px_1fr_1fr_1fr_70px_84px] gap-1.5 pr-1 font-mono text-[9px] uppercase tracking-wider text-ink-500">
        <span className="text-center">№</span><span>МБ</span><span>ББ</span><span>Анте</span><span>Время</span><span />
      </div>

      <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
        {items.map((it) => (
          it.kind === "level" ? (
            <div key={`l${it.idx}`} className="grid grid-cols-[28px_1fr_1fr_1fr_70px_84px] items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800/50 px-0 py-1">
              <span className="tabular text-center font-mono text-[11px] font-bold text-ink-400">{it.idx + 1}</span>
              <Input type="number" value={it.lvl.sb} onChange={(e) => patchLevel(it.idx, { sb: Number(e.target.value) || 0 })} className="h-8 border-transparent bg-transparent font-mono text-xs" />
              <Input type="number" value={it.lvl.bb} onChange={(e) => patchLevel(it.idx, { bb: Number(e.target.value) || 0 })} className="h-8 border-transparent bg-transparent font-mono text-xs" />
              <Input type="number" value={it.lvl.ante} onChange={(e) => patchLevel(it.idx, { ante: Number(e.target.value) || 0 })} className="h-8 border-transparent bg-transparent font-mono text-xs" />
              <Input type="number" value={it.lvl.duration} onChange={(e) => patchLevel(it.idx, { duration: Math.max(1, Number(e.target.value) || 1) })} className="h-8 border-transparent bg-transparent text-center font-mono text-xs" />
              <span className="flex items-center justify-end gap-0.5 pr-1.5">
                <button onClick={() => moveLevel(it.idx, -1)} className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-700 hover:text-cream-100" title="Выше"><ArrowUp size={13} /></button>
                <button onClick={() => moveLevel(it.idx, 1)} className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-700 hover:text-cream-100" title="Ниже"><ArrowDown size={13} /></button>
                <button onClick={() => removeLevel(it.idx)} className="rounded p-1 text-ink-400 transition-colors hover:bg-danger-500/15 hover:text-danger-400" title="Удалить уровень"><Trash2 size={13} /></button>
              </span>
            </div>
          ) : (
            <div key={`b${it.idx}`} className="grid grid-cols-[28px_1fr_1fr_1fr_70px_84px] items-center gap-1.5 rounded-lg border border-gold-500/25 bg-gold-500/6 py-1 pl-0">
              <span className="flex justify-center"><Coffee size={13} className="text-gold-400" /></span>
              <span className="col-span-2 text-xs font-semibold text-gold-200">Перерыв после уровня {it.br.afterLevel + 1}</span>
              <span className="text-right text-[10px] text-ink-500">время</span>
              <Input type="number" value={it.br.duration} onChange={(e) => patchBreak(it.idx, { duration: Math.max(1, Number(e.target.value) || 1) })} className="h-8 border-transparent bg-transparent text-center font-mono text-xs text-gold-200" />
              <span className="flex items-center justify-end gap-0.5 pr-1.5">
                <button onClick={() => moveBreak(it.idx, -1)} className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-700 hover:text-cream-100" title="Раньше"><ArrowUp size={13} /></button>
                <button onClick={() => moveBreak(it.idx, 1)} className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-700 hover:text-cream-100" title="Позже"><ArrowDown size={13} /></button>
                <button onClick={() => removeBreak(it.idx)} className="rounded p-1 text-ink-400 transition-colors hover:bg-danger-500/15 hover:text-danger-400" title="Удалить перерыв"><Trash2 size={13} /></button>
              </span>
            </div>
          )
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="dark" onClick={addLevel}><Plus size={13} /> Добавить уровень</Button>
        <Button size="sm" variant="outline" onClick={addBreak} disabled={levels.length === 0}><Coffee size={13} /> Добавить перерыв</Button>
      </div>
    </div>
  );
}

/* ============================ БОНУСЫ ============================ */

export function BonusDefsEditor({ value, onChange }: { value: BonusDef[]; onChange: (v: BonusDef[]) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">Бонусы турнира</span>
        <Button size="xs" variant="dark" onClick={() => onChange([...value, { name: "Чип-бонус", chips: 5000 }])}>
          <Plus size={12} /> Бонус
        </Button>
      </div>
      {value.length === 0 && (
        <div className="rounded-lg border border-dashed border-ink-600 px-3 py-6 text-center text-xs text-ink-400">
          Бонусов нет. Создайте пресеты — на пульте они появятся одной кнопкой.
        </div>
      )}
      {value.length > 0 && (
        <div className="mb-1 grid grid-cols-[24px_1fr_110px_24px] items-center gap-2 px-2.5 font-mono text-[9px] uppercase tracking-wider text-ink-500">
          <span className="text-center">№</span>
          <span>Название бонуса</span>
          <span className="text-center">Фишек</span>
          <span />
        </div>
      )}
      <div className="space-y-1.5">
        {value.map((b, i) => (
          <div key={i} className="grid grid-cols-[24px_1fr_110px_24px] items-center gap-2 rounded-lg border border-ink-700 bg-ink-800/50 px-2.5 py-1.5">
            <span className="shrink-0 text-center font-mono text-[10px] font-bold text-gold-500">{i + 1}</span>
            <Input value={b.name} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Название бонуса" className="h-8 border-transparent bg-transparent text-sm" />
            <Input type="number" value={b.chips} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, chips: Math.max(0, Number(e.target.value) || 0) } : x)))} className="h-8 border-transparent bg-transparent text-center font-mono text-sm font-bold text-gold-200" />
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="shrink-0 text-center text-ink-500 transition-colors hover:text-danger-400" title="Удалить">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-ink-500">
        Во время игры оператор выбирает бонус и игрока — фишки суммируются в общий банк турнира.
      </p>
    </div>
  );
}

/* ============================ СТОЛЫ И РАССАДКА ============================ */

export interface ParticipantLite {
  userId: string;
  checked: boolean;
  user: User;
}

export function TablesEditor({ tables, onChange, participants, ratingOf }: {
  tables: TableState[];
  onChange: (t: TableState[]) => void;
  participants: ParticipantLite[];
  ratingOf?: (userId: string) => number;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);

  const seatedIds = new Set(tables.flatMap((tb) => tb.seats.filter(Boolean) as string[]));
  const unseated = participants.filter((p) => !seatedIds.has(p.userId));

  const setCapacity = (num: number, cap: number) => {
    const c = Math.max(2, Math.min(10, cap));
    onChange(tables.map((tb) => {
      if (tb.number !== num) return tb;
      const seats = [...tb.seats];
      if (seats.length > c) seats.length = c;
      while (seats.length < c) seats.push(null);
      return { ...tb, capacity: c, seats };
    }));
  };

  const addTable = () => {
    const number = tables.reduce((m, tb) => Math.max(m, tb.number), 0) + 1;
    onChange([...tables, { number, isFinal: false, capacity: 9, seats: Array(9).fill(null) as (string | null)[] }]);
  };

  const removeTable = (num: number) => {
    onChange(tables.filter((tb) => tb.number !== num));
  };

  const seatUser = (table: number, seat: number, userId: string) => {
    onChange(tables.map((tb) => ({
      ...tb,
      seats: tb.seats.map((s, i) => {
        if (tb.number === table && i === seat) return userId;
        if (s === userId) return null; // убрать с прежнего места
        return s;
      }),
    })));
  };

  const unseat = (userId: string) => {
    onChange(tables.map((tb) => ({ ...tb, seats: tb.seats.map((s) => (s === userId ? null : s)) })));
  };

  const onDrop = (e: DragEvent, table: number, seat: number) => {
    e.preventDefault();
    setDragOver(null);
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    if (data.startsWith("u:")) {
      seatUser(table, seat, data.slice(2));
    } else if (data.startsWith("s:")) {
      const parts = data.split(":");
      const fromT = Number(parts[1]);
      const fromS = Number(parts[2]);
      const moved = tables.find((x) => x.number === fromT)?.seats[fromS] ?? null;
      if (moved == null) return;
      const target = tables.find((x) => x.number === table)?.seats[seat] ?? null;
      onChange(tables.map((tb) => {
        let seats = [...tb.seats];
        if (tb.number === fromT && tb.number === table) {
          seats[fromS] = target;
          seats[seat] = moved;
        } else {
          if (tb.number === fromT) seats[fromS] = target; // житель целевого места (или пусто) переезжает сюда
          if (tb.number === table) seats[seat] = moved;
        }
        return { ...tb, seats };
      }));
    }
  };

  const autoLocal = (algo: "random" | "rating") => {
    let pool = participants.map((p) => p.userId);
    if (algo === "random") {
      pool = [...pool].sort(() => Math.random() - 0.5);
    } else if (ratingOf) {
      pool = [...pool].sort((a, b) => (ratingOf(b) ?? 0) - (ratingOf(a) ?? 0));
    }
    const next = tables.map((tb) => ({ ...tb, seats: tb.seats.map((): string | null => null) }));
    const n = next.length;
    if (!n) return;
    pool.forEach((userId, i) => {
      let tableIdx: number;
      if (algo === "rating") {
        const round = Math.floor(i / n);
        const pos = i % n;
        tableIdx = round % 2 === 0 ? pos : n - 1 - pos; // «змейка»
      } else {
        const counts = next.map((tb) => tb.seats.filter(Boolean).length);
        tableIdx = counts.indexOf(Math.min(...counts));
      }
      const tb = next[tableIdx];
      const seatIdx = tb.seats.indexOf(null);
      if (seatIdx >= 0) tb.seats[seatIdx] = userId;
    });
    onChange(next);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      {/* участники для перетаскивания */}
      <div className="rounded-xl border border-ink-700 bg-ink-850/70 p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">Участники</span>
          <Badge tone="ink">{unseated.length} вне столов</Badge>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <Button size="xs" variant="dark" onClick={() => autoLocal("random")} disabled={!tables.length || !participants.length}>
            <Shuffle size={12} /> Случайно
          </Button>
          <Button size="xs" variant="outline" onClick={() => autoLocal("rating")} disabled={!tables.length || !participants.length}>
            <Trophy size={12} /> По рейтингу
          </Button>
        </div>
        <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {participants.length === 0 && (
            <div className="rounded-lg border border-dashed border-ink-600 px-3 py-5 text-center text-xs text-ink-400">
              Сначала запишите игроков в разделе «Регистрация»
            </div>
          )}
          {unseated.map((p) => (
            <div
              key={p.userId}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", `u:${p.userId}`); e.dataTransfer.effectAllowed = "move"; }}
              className="flex cursor-grab items-center gap-2 rounded-lg border border-ink-700 bg-ink-800/70 px-2 py-1.5 transition-colors hover:border-gold-500/50 active:cursor-grabbing"
            >
              <GripVertical size={13} className="shrink-0 text-ink-500" />
              <Avatar name={fullName(p.user)} hue={p.user.hue} size={24} photo={p.user.photoURL} />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-cream-100">{p.user.nickname}</span>
              {p.checked ? <Badge tone="felt">чекин</Badge> : <Badge tone="ink">записан</Badge>}
            </div>
          ))}
          {unseated.length === 0 && participants.length > 0 && (
            <div className="px-2 py-3 text-center text-xs text-felt-300">Все участники рассажены</div>
          )}
        </div>
      </div>

      {/* столы */}
      <div className="grid content-start gap-4 md:grid-cols-2">
        {tables.length === 0 && (
          <button
            onClick={addTable}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-600 px-4 py-10 text-center transition-all hover:border-gold-500/60 hover:bg-gold-500/5 md:col-span-2"
          >
            <Plus size={22} className="text-gold-400" />
            <span className="text-sm font-semibold text-ink-300">Столов пока нет — нажмите, чтобы добавить первый</span>
            <span className="text-[11px] text-ink-500">9 мест · ёмкость настраивается после создания</span>
          </button>
        )}
        {tables.map((tb) => (
          <div key={tb.number} className="rounded-xl border border-ink-700 bg-ink-850/70 p-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="font-display text-sm font-bold text-cream-100">Стол {tb.number}</span>
              <Badge tone="ink">{tb.seats.filter(Boolean).length}/{tb.seats.length}</Badge>
              <label className="ml-auto flex items-center gap-1.5 text-[11px] text-ink-400">
                мест
                <Input
                  type="number" value={tb.capacity}
                  onChange={(e) => setCapacity(tb.number, Number(e.target.value) || 9)}
                  className="h-7 w-14 border-transparent bg-transparent px-1 text-center font-mono text-xs font-bold text-cream-100 hover:border-ink-600"
                />
              </label>
              <button onClick={() => removeTable(tb.number)} className="rounded p-1 text-ink-500 transition-colors hover:text-danger-400" title="Удалить стол">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tb.seats.map((s, sIdx) => {
                const key = `${tb.number}:${sIdx}`;
                const u = s ? participants.find((p) => p.userId === s)?.user : null;
                return (
                  <div
                    key={sIdx}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
                    onDragLeave={() => setDragOver((v) => (v === key ? null : v))}
                    onDrop={(e) => onDrop(e, tb.number, sIdx)}
                    className={cx(
                      "flex h-12 w-[86px] items-center justify-center rounded-lg border transition-all",
                      dragOver === key && "scale-105 border-gold-400 ring-2 ring-gold-400/40",
                      u ? "border-ink-500/70 bg-ink-800" : "border-dashed border-ink-600",
                    )}
                  >
                    {u ? (
                      <div
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", `s:${tb.number}:${sIdx}`); e.dataTransfer.effectAllowed = "move"; }}
                        className="group flex w-full cursor-grab items-center gap-1.5 px-1.5 active:cursor-grabbing"
                        title="Перетащите на другое место"
                      >
                        <Avatar name={fullName(u)} hue={u.hue} size={24} photo={u.photoURL} />
                        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-cream-100">{u.nickname}</span>
                        <button onClick={() => unseat(u.id)} className="text-ink-500 opacity-0 transition-opacity hover:text-danger-400 group-hover:opacity-100" title="Убрать со стола">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">место {sIdx + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {tables.length > 0 && (
          <button onClick={addTable} className="flex min-h-[90px] items-center justify-center gap-2 rounded-xl border border-dashed border-ink-600 text-sm font-semibold text-ink-400 transition-all hover:border-gold-500/50 hover:text-gold-300 md:col-span-2">
            <Plus size={16} /> Добавить стол
          </button>
        )}
      </div>
    </div>
  );
}

export { fmtNum };
