import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, ArrowRight, Copy, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { actions } from "../../lib/store";
import { useDB } from "../../lib/hooks";
import type { Season } from "../../types";
import { computeBoard, cx, fmtDate, fmtDuration, fmtNum, fullName, scoringText, structureMinutes, uid, TYPE_LABELS } from "../../lib/formulas";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, Reveal, Select, Toggle, toast } from "../../components/ui";
import { PageHeader, StatusBadge, TypeLabel } from "../../components/shared";
import { CardsIcon } from "../../components/icons";

/* ============================ ШАБЛОНЫ ============================ */

export function TemplatesPage() {
  const db = useDB();

  return (
    <div>
      <PageHeader kicker="библиотека форматов" title="Шаблоны турниров">
        <Link to="/admin/templates/new"><Button><Plus size={16} /> Новый шаблон</Button></Link>
      </PageHeader>

      {db.templates.length === 0 && (
        <EmptyState icon={<CardsIcon size={32} />} title="Шаблонов пока нет" text="Создайте первый шаблон — он ускорит создание турниров." />
      )}

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

              {tp.description && <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-ink-400">{tp.description}</p>}

              <div className="mt-3.5 grid grid-cols-2 gap-2 text-sm">
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
                {tp.tables.length > 0 && <><span className="mx-1.5 text-ink-600">·</span>{tp.tables.length} столов</>}
              </div>
              {tp.rebuyAllowed && <div className="mt-2"><Badge tone="gold">ребаи ×{tp.maxRebuys} до {tp.rebuyUntilLevel + 1}-го уровня</Badge></div>}
              {tp.bonusDefs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tp.bonusDefs.map((b) => <Badge key={b.name} tone="cream">{b.name} +{fmtNum(b.chips)}</Badge>)}
                </div>
              )}
              <div className="mt-2 font-mono text-[11px] text-gold-500/90">{scoringText(tp.scoring)}</div>

              <div className="mt-4 flex gap-1.5 border-t border-ink-700/70 pt-3.5">
                <Link to={`/admin/templates/${tp.id}/edit`} className="flex-1">
                  <Button size="sm" variant="dark" className="w-full"><Pencil size={13} /> Открыть</Button>
                </Link>
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
    </div>
  );
}

/* ============================ СЕЗОНЫ ============================ */

function blankSeason(): Season {
  const now = new Date();
  const end = new Date(now.getTime() + 90 * 86_400_000);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  return { id: uid("s"), name: "", startDate: d(now), endDate: d(end), isActive: false, archived: false };
}

export function SeasonsPage() {
  const db = useDB();
  const [editing, setEditing] = useState<Season | null>(null);

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
          const events = db.tournaments.filter((t) => t.seasonId === s.id);
          const finished = events.filter((t) => t.results);
          const board = computeBoard(db, s.id);
          const leader = board[0] ? db.users.find((u) => u.id === board[0].userId) : null;
          const finalT = events.find((t) => t.nonScoring);
          return (
            <Reveal key={s.id} delay={i * 60}>
              <Card lift className={cx("p-5", s.isActive && "border-gold-500/40")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/admin/seasons/${s.id}`} className="font-display text-base font-bold text-cream-100 transition-colors hover:text-gold-300">
                        {s.name}
                      </Link>
                      {s.isActive && <Badge tone="gold" dot>идёт сейчас</Badge>}
                      {s.archived && <Badge tone="ink">архив</Badge>}
                      {finalT && <Badge tone="felt">финал создан</Badge>}
                    </div>
                    <div className="mt-1 font-mono text-xs text-ink-400">
                      {fmtDate(new Date(s.startDate).getTime())} → {fmtDate(new Date(s.endDate).getTime())}
                      <span className="mx-2 text-ink-600">·</span>
                      {finished.length} из {events.length} турниров сыграно
                      {leader && <><span className="mx-2 text-ink-600">·</span>лидер — <b className="text-gold-300">{leader.nickname}</b> ({fmtNum(board[0].points)})</>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/admin/seasons/${s.id}`}>
                      <Button size="sm" variant="dark">Открыть сезон <ArrowRight size={13} /></Button>
                    </Link>
                    <Toggle checked={s.isActive} onChange={(v) => { actions.saveSeason({ ...s, isActive: v, archived: v ? false : s.archived }); toast(v ? `«${s.name}» активен` : "Сезон деактивирован", "info"); }} label="Активен" />
                    {!s.archived && (
                      <Button size="xs" variant="ghost" onClick={() => { actions.archiveSeason(s.id); toast("Сезон в архиве", "info"); }}>
                        <Archive size={12} /> Архив
                      </Button>
                    )}
                    <Button size="xs" variant="ghost" onClick={() => setEditing({ ...s })} title="Редактировать">
                      <Pencil size={12} />
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => { const e = actions.deleteSeason(s.id); toast(e ?? "Сезон удалён", e ? "err" : "info"); }} title="Удалить">
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>

                {/* мини-пьедестал сезона */}
                {board.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700/70 pt-3.5">
                    <Trophy size={14} className="text-gold-500" />
                    {board.slice(0, 3).map((r, idx) => {
                      const u = db.users.find((x) => x.id === r.userId);
                      if (!u) return null;
                      return (
                        <span key={r.userId} className={cx(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
                          idx === 0 ? "border-gold-500/50 bg-gold-500/12 text-gold-200" : "border-ink-600 bg-ink-800/60 text-ink-200",
                        )}>
                          <Avatar name={fullName(u)} hue={u.hue} size={18} photo={u.photoURL} />
                          {u.nickname}
                          <span className="tabular font-mono text-[10px] opacity-80">{fmtNum(r.points)}</span>
                        </span>
                      );
                    })}
                    <span className="ml-auto font-mono text-[11px] text-ink-500">в зачёте: {board.length}</span>
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
            <div className="rounded-lg bg-ink-800/70 px-4 py-3 text-xs leading-relaxed text-ink-400">
              Очки начисляются по сетке каждого турнира. Начисление по умолчанию: <b className="font-mono text-gold-300/90">{scoringText(db.settings.defaultScoring)}</b> — меняется в настройках клуба и в каждом турнире.
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


