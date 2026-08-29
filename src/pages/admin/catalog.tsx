import { useMemo, useState } from "react";
import { Archive, Calculator, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { actions } from "../../lib/store";
import { useDB } from "../../lib/hooks";
import type { BreakRule, Season, Template, TournamentType } from "../../types";
import { computeBoard, cx, fmtDuration, fmtNum, fullName, scoringText, structureMinutes, uid, TYPE_LABELS } from "../../lib/formulas";
import { Badge, Button, Card, Field, Input, Modal, Reveal, Select, Toggle, EmptyState, toast } from "../../components/ui";
import { Leaderboard, PageHeader, StatusBadge, TypeLabel } from "../../components/shared";
import { CardsIcon, CrownIcon } from "../../components/icons";

/* ============================ ШАБЛОНЫ ============================ */

function blankTemplate(db: ReturnType<typeof useDB>): Template {
  const sc = db.settings.defaultScoring;
  return {
    id: uid("tpl"), name: "", type: "freezeout", description: "",
    startingChips: 20000, maxPlayers: 36,
    levels: [
      { sb: 25, bb: 50, ante: 0, duration: 12 },
      { sb: 50, bb: 100, ante: 0, duration: 12 },
      { sb: 100, bb: 200, ante: 0, duration: 12 },
    ],
    breaks: [{ afterLevel: 1, duration: 15 }],
    rebuyAllowed: false, maxRebuys: 3, rebuyCostChips: 10000, rebuyUntilLevel: 4,
    lateRegMinutes: 45,
    bonusDefs: [{ name: "Чип-бонус", chips: 5000 }],
    scoring: JSON.parse(JSON.stringify(sc)),
  };
}

export function TemplatesPage() {
  const db = useDB();
  const [editing, setEditing] = useState<Template | null>(null);

  const setLevel = (i: number, patch: Partial<Template["levels"][number]>) => {
    if (!editing) return;
    setEditing({ ...editing, levels: editing.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  };

  return (
    <div>
      <PageHeader kicker="конструктор" title="Шаблоны турниров">
        <Button onClick={() => setEditing(blankTemplate(db))}><Plus size={16} /> Новый шаблон</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {db.templates.map((tp, i) => (
          <Reveal key={tp.id} delay={i * 60}>
            <Card lift className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-cream-100">{tp.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <TypeLabel type={tp.type} />
                    <Badge tone="ink">{tp.levels.length} ур. · {fmtDuration(structureMinutes(tp.levels, tp.breaks))}</Badge>
                  </div>
                </div>
                <CardsIcon size={26} className="shrink-0 text-gold-500/60" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-ink-800/70 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-ink-400">Старт. стек</div>
                  <div className="tabular font-mono font-bold text-cream-100">{fmtNum(tp.startingChips)}</div>
                </div>
                <div className="rounded-lg bg-ink-800/70 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-ink-400">Макс. игроков</div>
                  <div className="tabular font-mono font-bold text-cream-100">{tp.maxPlayers}</div>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 font-mono text-[11px] text-ink-300">
                {fmtNum(tp.levels[0]?.sb ?? 25)}/{fmtNum(tp.levels[0]?.bb ?? 50)} → {fmtNum(tp.levels[tp.levels.length - 1]?.sb ?? 0)}/{fmtNum(tp.levels[tp.levels.length - 1]?.bb ?? 0)}
                <span className="mx-1.5 text-ink-600">·</span>поздняя рег. {tp.lateRegMinutes} мин
              </div>
              {tp.rebuyAllowed && <div className="mt-2"><Badge tone="gold">ребаи ×{tp.maxRebuys} до {tp.rebuyUntilLevel + 1}-го уровня</Badge></div>}
              {tp.bonusDefs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tp.bonusDefs.map((b) => <Badge key={b.name} tone="cream">{b.name} +{fmtNum(b.chips)}</Badge>)}
                </div>
              )}
              <div className="mt-2 font-mono text-[11px] text-gold-500/90">{scoringText(tp.scoring)}</div>

              <div className="mt-4 flex gap-1.5 border-t border-ink-700/70 pt-3.5">
                <Button size="sm" variant="dark" className="flex-1" onClick={() => setEditing(JSON.parse(JSON.stringify(tp)))}>
                  <Pencil size={13} /> Изменить
                </Button>
                <Button size="sm" variant="outline" title="Дублировать" onClick={() => { const e = actions.duplicateTemplate(tp.id); toast(e ?? "Копия создана", e ? "err" : "ok"); }}>
                  <Copy size={13} />
                </Button>
                <Button size="sm" variant="ghost" title="Удалить" onClick={() => { actions.deleteTemplate(tp.id); toast("Шаблон удалён", "info"); }}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      <Modal open={editing != null} onClose={() => setEditing(null)} title={db.templates.some((x) => x.id === editing?.id) ? "Редактирование шаблона" : "Новый шаблон"} width="max-w-2xl">
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Название">
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Пятничный Фризаут" />
              </Field>
              <Field label="Тип">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as TournamentType, rebuyAllowed: e.target.value === "rebuy" || e.target.value === "addon" ? true : editing.rebuyAllowed })}>
                  {(Object.keys(TYPE_LABELS) as TournamentType[]).map((k) => <option key={k} value={k}>{TYPE_LABELS[k]}</option>)}
                </Select>
              </Field>
              <Field label="Стартовые фишки">
                <Input type="number" value={editing.startingChips} onChange={(e) => setEditing({ ...editing, startingChips: Number(e.target.value) || 0 })} className="font-mono" />
              </Field>
              <Field label="Максимум игроков">
                <Input type="number" value={editing.maxPlayers} onChange={(e) => setEditing({ ...editing, maxPlayers: Number(e.target.value) || 2 })} className="font-mono" />
              </Field>
              <Field label="Поздняя регистрация, мин" hint="0 — выключено">
                <Input type="number" value={editing.lateRegMinutes} onChange={(e) => setEditing({ ...editing, lateRegMinutes: Math.max(0, Number(e.target.value) || 0) })} className="font-mono" />
              </Field>
              <div className="rounded-lg border border-ink-700 bg-ink-800/50 p-3">
                <Toggle checked={editing.rebuyAllowed} onChange={(v) => setEditing({ ...editing, rebuyAllowed: v })} label="Ребаи разрешены" />
                {editing.rebuyAllowed && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <Input type="number" value={editing.maxRebuys} onChange={(e) => setEditing({ ...editing, maxRebuys: Number(e.target.value) || 1 })} className="h-8 font-mono text-xs" title="Макс. ребаев" />
                    <Input type="number" value={editing.rebuyCostChips} onChange={(e) => setEditing({ ...editing, rebuyCostChips: Number(e.target.value) || 0 })} className="h-8 font-mono text-xs" title="Фишек за ребай" />
                    <Input type="number" value={editing.rebuyUntilLevel + 1} onChange={(e) => setEditing({ ...editing, rebuyUntilLevel: Math.max(0, Number(e.target.value) - 1) })} className="h-8 font-mono text-xs" title="До уровня" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">Структура блайндов</span>
                <Button size="xs" variant="dark" onClick={() => {
                  const last = editing.levels[editing.levels.length - 1] ?? { sb: 25, bb: 50, ante: 0, duration: 12 };
                  setEditing({ ...editing, levels: [...editing.levels, { sb: last.sb * 2, bb: last.bb * 2, ante: last.ante * 2, duration: last.duration }] });
                }}>
                  <Plus size={12} /> уровень
                </Button>
              </div>
              <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {editing.levels.map((l, i) => (
                  <div key={i} className="grid grid-cols-[26px_1fr_1fr_1fr_84px_30px] items-center gap-1.5">
                    <span className="tabular text-center font-mono text-[11px] text-ink-500">{i + 1}</span>
                    <Input type="number" value={l.sb} onChange={(e) => setLevel(i, { sb: Number(e.target.value) || 0 })} className="h-8 font-mono text-xs" />
                    <Input type="number" value={l.bb} onChange={(e) => setLevel(i, { bb: Number(e.target.value) || 0 })} className="h-8 font-mono text-xs" />
                    <Input type="number" value={l.ante} onChange={(e) => setLevel(i, { ante: Number(e.target.value) || 0 })} className="h-8 font-mono text-xs" />
                    <Input type="number" value={l.duration} onChange={(e) => setLevel(i, { duration: Number(e.target.value) || 5 })} className="h-8 font-mono text-xs" />
                    <button onClick={() => setEditing({ ...editing, levels: editing.levels.filter((_, j) => j !== i) })} className="text-ink-500 hover:text-danger-400" title="Убрать">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
                <Calculator size={13} className="text-gold-500" /> Очки
              </span>
              <div className="rounded-lg border border-ink-700 bg-ink-800/50 px-3 py-2 font-mono text-[11px] text-ink-300">{scoringText(editing.scoring)}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <div>
                  <div className="mb-1 font-mono text-[9px] uppercase text-ink-500">Участие</div>
                  <Input type="number" value={editing.scoring.participation} onChange={(e) => setEditing({ ...editing, scoring: { ...editing.scoring, participation: Math.max(0, Number(e.target.value) || 0) } })} className="h-8 font-mono text-xs" />
                </div>
                <div>
                  <div className="mb-1 font-mono text-[9px] uppercase text-ink-500">Нокаут</div>
                  <Input type="number" value={editing.scoring.knockoutPoints} onChange={(e) => setEditing({ ...editing, scoring: { ...editing.scoring, knockoutPoints: Math.max(0, Number(e.target.value) || 0) } })} className="h-8 font-mono text-xs" />
                </div>
                <div className="col-span-2">
                  <div className="mb-1 font-mono text-[9px] uppercase text-ink-500">Сетка мест (первые 3)</div>
                  <div className="flex gap-1.5">
                    {editing.scoring.grid.slice(0, 3).map((g) => (
                      <Input key={g.place} type="number" value={g.points} onChange={(e) => setEditing({
                        ...editing,
                        scoring: { ...editing.scoring, grid: editing.scoring.grid.map((x) => (x.place === g.place ? { ...x, points: Math.max(0, Number(e.target.value) || 0) } : x)) },
                      })} className="h-8 font-mono text-xs" title={`#${g.place}`} />
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-[10px] text-ink-500">Полная сетка настраивается на странице турнира (раздел «Очки»)</p>
            </div>

            <Button className="w-full" size="lg" onClick={() => {
              if (!editing.name.trim()) { toast("Укажите название шаблона", "err"); return; }
              actions.saveTemplate({ ...editing, breaks: editing.breaks as BreakRule[] });
              toast("Шаблон сохранён");
              setEditing(null);
            }}>
              Сохранить шаблон
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================ СЕЗОНЫ ============================ */

function blankSeason(): Season {
  const now = new Date();
  const end = new Date(now.getTime() + 90 * 86400_000);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  return { id: uid("s"), name: "", startDate: d(now), endDate: d(end), isActive: false, archived: false };
}

export function SeasonsPage() {
  const db = useDB();
  const [editing, setEditing] = useState<Season | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...db.seasons].sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.startDate.localeCompare(a.startDate)),
    [db.seasons],
  );

  return (
    <div>
      <PageHeader kicker="зачётные периоды" title="Сезоны">
        <Button onClick={() => setEditing(blankSeason())}><Plus size={16} /> Новый сезон</Button>
      </PageHeader>

      <div className="space-y-4">
        {sorted.map((s, i) => {
          const events = db.tournaments.filter((t) => t.seasonId === s.id && t.results);
          const board = computeBoard(db, s.id);
          const leader = board[0] ? db.users.find((u) => u.id === board[0].userId) : null;
          return (
            <Reveal key={s.id} delay={i * 60}>
              <Card className={cx("p-5", s.isActive && "border-gold-500/40")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-cream-100">{s.name}</h3>
                      {s.isActive && <Badge tone="gold" dot>идёт сейчас</Badge>}
                      {s.archived && <Badge tone="ink">архив</Badge>}
                    </div>
                    <div className="mt-1 font-mono text-xs text-ink-400">
                      {new Date(s.startDate).toLocaleDateString("ru-RU")} → {new Date(s.endDate).toLocaleDateString("ru-RU")}
                      <span className="mx-2 text-ink-600">·</span>
                      {events.length} в зачёте
                      {leader && <><span className="mx-2 text-ink-600">·</span>лидер — <b className="text-gold-300">{leader.nickname}</b></>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Toggle checked={s.isActive} onChange={(v) => { actions.saveSeason({ ...s, isActive: v, archived: v ? false : s.archived }); toast(v ? `«${s.name}» активен` : "Сезон деактивирован", "info"); }} label="Активен" />
                    <Button size="xs" variant="dark" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                      {expanded === s.id ? "Свернуть рейтинг" : "Итоговый рейтинг"}
                    </Button>
                    {!s.archived && (
                      <Button size="xs" variant="ghost" onClick={() => { actions.archiveSeason(s.id); toast("Сезон в архиве", "info"); }}>
                        <Archive size={12} /> Архив
                      </Button>
                    )}
                    <Button size="xs" variant="ghost" onClick={() => { const e = actions.deleteSeason(s.id); toast(e ?? "Сезон удалён", e ? "err" : "info"); }}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>

                {expanded === s.id && (
                  <div className="animate-rise mt-4 border-t border-ink-700 pt-4">
                    {board.length === 0 ? (
                      <EmptyState icon={<CrownIcon size={26} />} title="Зачёт ещё не начался" text="Завершите первый турнир сезона — рейтинг построится автоматически." />
                    ) : (
                      <div className="grid gap-5 lg:grid-cols-2">
                        <Leaderboard rows={board} db={db} limit={10} />
                        <div className="space-y-2">
                          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold-500">турниры сезона</div>
                          {events.map((t) => {
                            const w = t.results?.find((r) => r.place === 1);
                            const wU = w ? db.users.find((u) => u.id === w.userId) : null;
                            return (
                              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-ink-800/60 px-3.5 py-2.5 text-sm">
                                <span className="truncate font-semibold text-cream-100">{t.name}</span>
                                <StatusBadge status={t.status} />
                                <span className="shrink-0 text-xs text-ink-400">🏆 {wU?.nickname ?? "—"} · <b className="font-mono text-gold-300">{w ? fmtNum(w.points) : "—"}</b></span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </Reveal>
          );
        })}
      </div>

      <Modal open={editing != null} onClose={() => setEditing(null)} title={db.seasons.some((x) => x.id === editing?.id) ? "Редактирование сезона" : "Новый сезон"}>
        {editing && (
          <div className="space-y-4">
            <Field label="Название">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Весенняя серия 2026" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Начало">
                <Input type="date" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
              </Field>
              <Field label="Окончание">
                <Input type="date" value={editing.endDate} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} />
              </Field>
            </div>
            <Button className="w-full" size="lg" onClick={() => {
              if (!editing.name.trim()) { toast("Укажите название", "err"); return; }
              actions.saveSeason(editing);
              toast("Сезон сохранён");
              setEditing(null);
            }}>
              Сохранить сезон
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
