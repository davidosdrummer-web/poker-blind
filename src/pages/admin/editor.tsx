import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, CalendarDays, CheckCircle2, Coins, Gift, LayoutTemplate, ListChecks, Plus,
  Save, SlidersHorizontal, Trash2, Trophy, Users, X,
} from "lucide-react";
import { actions } from "../../lib/store";
import { useDB } from "../../lib/hooks";
import type { DB, Registration, TableState, Template, Tournament, TournamentType } from "../../types";
import {
  computeBoard, cx, fmtDuration, fullName, scoringText, structureMinutes, totalSeats, uid, TYPE_LABELS,
} from "../../lib/formulas";
import { Avatar, Badge, Button, Card, Field, Input, Modal, Select, Toggle, toast } from "../../components/ui";
import { BonusDefsEditor, ScoringEditor, StructureEditor, TablesEditor, type ParticipantLite } from "../../components/editors";
import { SuitsRow } from "../../components/icons";

function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function blankTournament(db: DB): Tournament {
  const d = new Date(Date.now() + 3 * 86400_000);
  d.setHours(19, 0, 0, 0);
  const season = db.seasons.find((s) => s.isActive && !s.archived) ?? db.seasons[0];
  const sc = db.settings.defaultScoring;
  return {
    id: "", name: "", templateId: null, seasonId: season?.id ?? "", date: d.toISOString(),
    description: "",
    type: "freezeout", maxPlayers: 36, startingChips: 20000,
    levels: [
      { sb: 25, bb: 50, ante: 0, duration: 12 },
      { sb: 50, bb: 100, ante: 0, duration: 12 },
      { sb: 100, bb: 200, ante: 0, duration: 12 },
    ],
    breaks: [{ afterLevel: 1, duration: 15 }],
    rebuyAllowed: false, maxRebuys: 3, rebuyCostChips: 10000, rebuyUntilLevel: 4,
    lateRegMinutes: 45, lateRegUntil: null,
    bonusDefs: [{ name: "Чип-бонус", chips: 5000 }],
    scoring: JSON.parse(JSON.stringify(sc)),
    nonScoring: false, finalTableAt: 9,
    status: "registration", regOpen: true,
    currentLevel: 0, levelStartedAt: null, pausedRemaining: null, breakEndsAt: null,
    registrations: [], tables: [], knockouts: [], rebuys: [], bonuses: [], results: null,
    createdBy: "", createdAt: 0,
  };
}

function fromTemplate(db: DB, tpl: Template): Partial<Tournament> {
  return {
    templateId: tpl.id, name: tpl.name, type: tpl.type, description: tpl.description,
    startingChips: tpl.startingChips, maxPlayers: tpl.maxPlayers,
    levels: JSON.parse(JSON.stringify(tpl.levels)),
    breaks: JSON.parse(JSON.stringify(tpl.breaks)),
    rebuyAllowed: tpl.rebuyAllowed, maxRebuys: tpl.maxRebuys,
    rebuyCostChips: tpl.rebuyCostChips, rebuyUntilLevel: tpl.rebuyUntilLevel,
    lateRegMinutes: tpl.lateRegMinutes,
    bonusDefs: JSON.parse(JSON.stringify(tpl.bonusDefs)),
    scoring: JSON.parse(JSON.stringify(tpl.scoring)),
    tables: JSON.parse(JSON.stringify(tpl.tables ?? [])),
  };
}

const SECTIONS = [
  { id: "params", label: "Параметры", icon: SlidersHorizontal },
  { id: "reg", label: "Регистрация", icon: Users },
  { id: "structure", label: "Структура", icon: ListChecks },
  { id: "bonuses", label: "Бонусы", icon: Gift },
  { id: "scoring", label: "Очки", icon: Trophy },
  { id: "tables", label: "Столы", icon: LayoutTemplate },
];

export default function TournamentEditorPage() {
  const { id } = useParams();
  const db = useDB();
  const navigate = useNavigate();
  const existing = db.tournaments.find((t) => t.id === id);
  const isNew = !existing;

  const [draft, setDraft] = useState<Tournament>(() => existing ? JSON.parse(JSON.stringify(existing)) : blankTournament(db));
  const [tplChoice, setTplChoice] = useState<string>(existing?.templateId ?? "");
  const [tplName, setTplName] = useState("");
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [regFilter, setRegFilter] = useState("");
  const savedRef = useRef(false);

  const patch = (p: Partial<Tournament>) => setDraft((d) => ({ ...d, ...p }));
  const canEditGame = isNew || draft.status === "registration";

  const applyTemplate = (tplId: string) => {
    setTplChoice(tplId);
    const tpl = db.templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setDraft((d) => ({ ...d, ...fromTemplate(db, tpl) }));
    toast(`Шаблон «${tpl.name}» применён — поля заполнены`, "info");
  };

  const saveAsTemplate = () => {
    const name = tplName.trim() || draft.name.trim() || "Новый шаблон";
    actions.saveTemplate({
      id: uid("tpl"), name, type: draft.type, description: draft.description,
      startingChips: draft.startingChips, maxPlayers: draft.maxPlayers,
      levels: draft.levels, breaks: draft.breaks,
      rebuyAllowed: draft.rebuyAllowed, maxRebuys: draft.maxRebuys,
      rebuyCostChips: draft.rebuyCostChips, rebuyUntilLevel: draft.rebuyUntilLevel,
      lateRegMinutes: draft.lateRegMinutes, bonusDefs: draft.bonusDefs, scoring: draft.scoring,
      tables: draft.tables,
    });
    toast(`Шаблон «${name}» сохранён`);
    setSaveTplOpen(false);
    setTplName("");
  };

  const create = () => {
    if (!draft.name.trim()) { toast("Укажите название турнира", "err"); return; }
    if (!draft.seasonId) { toast("Выберите сезон", "err"); return; }
    const newId = actions.createTournament({ ...draft, name: draft.name.trim() });
    toast(`Турнир «${draft.name.trim()}» создан — регистрация открыта`);
    savedRef.current = true;
    navigate(`/admin/tournaments/${newId}/edit`);
  };

  const save = () => {
    if (!draft.name.trim()) { toast("Укажите название турнира", "err"); return; }
    actions.updateTournament({ ...draft, name: draft.name.trim() });
    toast("Изменения сохранены");
  };

  const del = () => {
    const err = actions.deleteTournament(draft.id);
    if (err) { toast(err, "err"); return; }
    toast("Турнир удалён", "info");
    navigate("/admin/tournaments");
  };

  /* дата/время как отдельные поля */
  const [datePart, timePart] = useMemo(() => {
    const iso = isoLocal(new Date(draft.date));
    const [dp, tp] = iso.split("T");
    return [dp, tp];
  }, [draft.date]);
  const setDate = (dp: string, tp: string) => patch({ date: new Date(`${dp}T${tp || "19:00"}`).toISOString() });

  /* регистрация */
  const regs = draft.registrations.filter((r) => r.status !== "refunded");
  const clubPlayers = db.users.filter((u) => u.role === "player" && !u.isBlocked && !u.archived);
  const freePlayers = clubPlayers.filter((u) => !regs.some((r) => r.userId === u.id));
  const filteredFree = freePlayers.filter((u) => {
    const q = regFilter.trim().toLowerCase();
    return !q || u.nickname.toLowerCase().includes(q) || fullName(u).toLowerCase().includes(q);
  });

  const addReg = (userId: string) => {
    if (regs.length >= draft.maxPlayers) { toast("Достигнут лимит участников", "err"); return; }
    patch({ registrations: [...draft.registrations, { userId, status: "registered", registeredAt: Date.now(), checkedInAt: null }] });
  };
  const removeReg = (userId: string) => {
    patch({
      registrations: draft.registrations.filter((r) => r.userId !== userId),
      tables: draft.tables.map((tb) => ({ ...tb, seats: tb.seats.map((s) => (s === userId ? null : s)) })),
    });
  };
  const toggleCheck = (userId: string) => {
    patch({
      registrations: draft.registrations.map((r) => r.userId === userId
        ? { ...r, status: r.status === "checked-in" ? "registered" : "checked-in", checkedInAt: r.status === "checked-in" ? null : Date.now() }
        : r),
    });
  };

  /* рейтинг для рассадки «по рейтингу» */
  const seasonBoard = useMemo(() => computeBoard(db, draft.seasonId || null), [db, draft.seasonId]);
  const ratingOf = (uidv: string) => seasonBoard.find((b) => b.userId === uidv)?.points ?? 0;

  const participants: ParticipantLite[] = regs
    .map((r) => ({ userId: r.userId, checked: r.status === "checked-in", user: db.users.find((u) => u.id === r.userId)! }))
    .filter((p) => p.user);

  const totalMin = structureMinutes(draft.levels, draft.breaks);

  return (
    <div>
      {/* верхняя панель */}
      <div className="sticky top-0 z-30 -mx-6 mb-6 border-b border-ink-700/80 bg-ink-900/92 px-6 py-3.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/admin/tournaments" className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-400 transition-colors hover:text-gold-300">
            <ArrowLeft size={14} /> турниры
          </Link>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-gold-500">{isNew ? "создание турнира" : "редактирование"}</div>
            <div className="truncate font-display text-base font-bold text-cream-100">{draft.name || "Без названия"}</div>
          </div>

          <Select value={tplChoice} onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); }} className="w-52 text-xs">
            <option value="">— выбрать шаблон —</option>
            {db.templates.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
          </Select>
          <Button size="sm" variant="dark" onClick={() => setSaveTplOpen(true)} title="Сохранить текущие настройки как шаблон">
            <Save size={13} /> Сохранить шаблон
          </Button>
          {isNew ? (
            <Button size="sm" onClick={create}><Plus size={13} /> Создать турнир</Button>
          ) : (
            <Button size="sm" onClick={save}><Save size={13} /> Сохранить</Button>
          )}
          {!isNew && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} title="Удалить турнир">
              <Trash2 size={14} />
            </Button>
          )}
        </div>
        {!canEditGame && (
          <div className="mt-2 text-[11px] text-gold-300">
            Турнир уже запущен — игровые параметры зафиксированы, редактируются название и описание.
          </div>
        )}
      </div>

      {/* навигация по разделам */}
      <nav className="sticky top-[73px] z-20 -mx-6 mb-6 border-b border-ink-800/70 bg-ink-950/85 px-6 backdrop-blur">
        <div className="flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold text-ink-300 transition-colors hover:border-gold-500/50 hover:text-gold-300"
            >
              <s.icon size={14} /> {s.label}
            </button>
          ))}
          <span className="ml-auto hidden items-center gap-2 py-2.5 font-mono text-[11px] text-ink-500 md:flex">
            длительность: <b className="text-gold-300">{fmtDuration(totalMin)}</b>
          </span>
        </div>
      </nav>

      <div className="space-y-7 pb-10">
        {/* ПАРАМЕТРЫ */}
        <section id="sec-params" className="scroll-mt-36">
          <SectionTitle icon={<SlidersHorizontal size={15} />} title="Параметры" sub="основные настройки турнира" />
          <Card className="p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название турнира">
                <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Пятничный Фризаут #13" />
              </Field>
              <Field label="Сезон">
                <Select value={draft.seasonId} onChange={(e) => patch({ seasonId: e.target.value })}>
                  {db.seasons.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Дата старта">
                <Input type="date" value={datePart} onChange={(e) => setDate(e.target.value, timePart)} />
              </Field>
              <Field label="Время старта">
                <Input type="time" value={timePart} onChange={(e) => setDate(datePart, e.target.value)} />
              </Field>
              <Field label="Стартовый стек">
                <Input type="number" value={draft.startingChips} onChange={(e) => patch({ startingChips: Number(e.target.value) || 0 })} className="font-mono" disabled={!canEditGame} />
              </Field>
              <Field label="Тип турнира">
                <Select value={draft.type} onChange={(e) => patch({ type: e.target.value as TournamentType })} disabled={!canEditGame}>
                  {(Object.keys(TYPE_LABELS) as TournamentType[]).map((k) => <option key={k} value={k}>{TYPE_LABELS[k]}</option>)}
                </Select>
              </Field>
              <Field label="Регистрация после старта" hint="минут поздней регистрации, 0 — выключено">
                <Input type="number" value={draft.lateRegMinutes} onChange={(e) => patch({ lateRegMinutes: Math.max(0, Number(e.target.value) || 0) })} className="font-mono" />
              </Field>
              <Field label="Финальный стол" hint="осталось игроков, 0 — выключено">
                <div className="flex items-center gap-2">
                  <Input type="number" value={draft.finalTableAt} onChange={(e) => patch({ finalTableAt: Math.max(0, Number(e.target.value) || 0) })} className="font-mono" disabled={!canEditGame} />
                </div>
                <span className="mt-1 block text-[10px] leading-snug text-ink-500">
                  Когда за столами останется {draft.finalTableAt > 0 ? draft.finalTableAt : "N"} игроков, они автоматически перейдут за общий финальный стол — он появится на ТВ-экране «Финал»
                </span>
              </Field>
              <div className="rounded-lg border border-ink-700 bg-ink-800/50 p-3">
                <Toggle
                  checked={draft.scoring.knockoutEnabled}
                  onChange={(v) => patch({ scoring: { ...draft.scoring, knockoutEnabled: v } })}
                  label="Очки за выбивание"
                />
                {draft.scoring.knockoutEnabled && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number" value={draft.scoring.knockoutPoints}
                      onChange={(e) => patch({ scoring: { ...draft.scoring, knockoutPoints: Math.max(0, Number(e.target.value) || 0) } })}
                      className="h-8 w-24 font-mono text-xs"
                    />
                    <span className="text-[11px] text-ink-500">очков за нокаут</span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4">
              <Field label="Описание">
                <textarea
                  value={draft.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={3}
                  placeholder="Особые условия, призы, правила…"
                  className="w-full rounded-lg border border-ink-600 bg-ink-800/80 px-3 py-2.5 text-sm text-cream-100 outline-none transition-all placeholder:text-ink-500 focus:border-gold-500/70 focus:ring-2 focus:ring-gold-500/20"
                />
              </Field>
            </div>
          </Card>
        </section>

        {/* РЕГИСТРАЦИЯ */}
        <section id="sec-reg" className="scroll-mt-36">
          <SectionTitle icon={<Users size={15} />} title="Регистрация" sub={`${regs.length} из ${draft.maxPlayers} · чекин: ${regs.filter((r) => r.status === "checked-in").length}`} />
          <div className="grid gap-5 lg:grid-cols-2">
            {/* все игроки клуба */}
            <Card className="flex min-h-[380px] flex-col p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="font-display text-sm font-bold text-cream-100">Игроки клуба</div>
                <Badge tone="ink">{clubPlayers.length}</Badge>
              </div>
              <Input value={regFilter} onChange={(e) => setRegFilter(e.target.value)} placeholder="Поиск по нику или имени…" className="mb-3 h-9" />
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {filteredFree.map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5 rounded-lg border border-ink-700/70 bg-ink-800/50 px-3 py-2 transition-colors hover:border-gold-500/40">
                    <Avatar name={fullName(u)} hue={u.hue} size={30} photo={u.photoURL} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-xs font-bold text-cream-100">{u.nickname}</span>
                      <span className="block truncate text-[10px] text-ink-500">{fullName(u)}</span>
                    </span>
                    <Button size="xs" variant="dark" onClick={() => { addReg(u.id); toast(`${u.nickname} записан`, "info"); }}>
                      <Plus size={12} /> Записать
                    </Button>
                  </div>
                ))}
                {filteredFree.length === 0 && <div className="py-8 text-center text-xs text-ink-500">Все игроки клуба уже записаны или не найдены</div>}
              </div>
            </Card>

            {/* записанные */}
            <Card className="flex min-h-[380px] flex-col p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="font-display text-sm font-bold text-cream-100">Записаны на турнир</div>
                <div className="flex items-center gap-2">
                  <Input type="number" value={draft.maxPlayers} onChange={(e) => patch({ maxPlayers: Math.max(2, Number(e.target.value) || 2) })} className="h-8 w-20 text-center font-mono text-xs" />
                  <span className="text-[11px] text-ink-500">макс.</span>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {regs.map((r: Registration) => {
                  const u = db.users.find((x) => x.id === r.userId);
                  if (!u) return null;
                  return (
                    <div key={r.userId} className="flex items-center gap-2.5 rounded-lg border border-ink-700/70 bg-ink-800/50 px-3 py-2">
                      <Avatar name={fullName(u)} hue={u.hue} size={30} photo={u.photoURL} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-xs font-bold text-cream-100">{u.nickname}</span>
                        <span className="block truncate text-[10px] text-ink-500">{fullName(u)}</span>
                      </span>
                      <button
                        onClick={() => toggleCheck(r.userId)}
                        className={cx(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all",
                          r.status === "checked-in"
                            ? "border-felt-400/60 bg-felt-500/15 text-felt-300"
                            : "border-ink-600 text-ink-300 hover:border-felt-400/50 hover:text-felt-300",
                        )}
                      >
                        <CheckCircle2 size={11} /> {r.status === "checked-in" ? "в зале" : "чекин"}
                      </button>
                      <button onClick={() => removeReg(r.userId)} className="rounded p-1 text-ink-500 transition-colors hover:bg-danger-500/10 hover:text-danger-300" title="Убрать">
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
                {regs.length === 0 && <div className="py-8 text-center text-xs text-ink-500">Список пуст — записывайте игроков слева</div>}
              </div>
            </Card>
          </div>
        </section>

        {/* СТРУКТУРА */}
        <section id="sec-structure" className="scroll-mt-36">
          <SectionTitle icon={<ListChecks size={15} />} title="Структура" sub={`блайнды и перерывы · ${fmtDuration(totalMin)}`} />
          <Card className="p-5">
            <StructureEditor
              levels={draft.levels}
              breaks={draft.breaks}
              onLevels={(l) => patch({ levels: l })}
              onBreaks={(b) => patch({ breaks: b })}
            />
          </Card>
        </section>

        {/* БОНУСЫ */}
        <section id="sec-bonuses" className="scroll-mt-36">
          <SectionTitle icon={<Gift size={15} />} title="Бонусы" sub="пресеты для кнопки «Бонус» на пульте" />
          <Card className="p-5">
            <BonusDefsEditor value={draft.bonusDefs} onChange={(v) => patch({ bonusDefs: v })} />
          </Card>
        </section>

        {/* ОЧКИ */}
        <section id="sec-scoring" className="scroll-mt-36">
          <SectionTitle icon={<Trophy size={15} />} title="Очки" sub={scoringText(draft.scoring)} />
          <Card className="p-5">
            <ScoringEditor value={draft.scoring} onChange={(v) => patch({ scoring: v })} />
          </Card>
        </section>

        {/* СТОЛЫ */}
        <section id="sec-tables" className="scroll-mt-36">
          <SectionTitle icon={<LayoutTemplate size={15} />} title="Столы" sub={`${draft.tables.length} столов · ${totalSeats(draft)} мест`} />
          <Card className="p-5">
            <TablesEditor
              tables={draft.tables}
              onChange={(v: TableState[]) => patch({ tables: v })}
              participants={participants}
              ratingOf={ratingOf}
            />
          </Card>
        </section>
      </div>

      {/* сохранить шаблон */}
      <Modal open={saveTplOpen} onClose={() => setSaveTplOpen(false)} title="Сохранить как шаблон">
        <div className="space-y-4">
          <Field label="Название шаблона" hint={!draft.name.trim() ? "обязательно" : "по умолчанию — название турнира"}>
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={draft.name || "Мой шаблон"} autoFocus />
          </Field>
          <div className="rounded-lg bg-ink-800/70 px-4 py-3 text-xs leading-relaxed text-ink-300">
            В шаблон войдут: структура блайндов и перерывы, стартовый стек, лимит игроков, бонусы, сетка очков и поздняя регистрация.
          </div>
          <Button className="w-full" onClick={saveAsTemplate}><Save size={14} /> Сохранить шаблон</Button>
        </div>
      </Modal>

      {/* удаление */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Удалить турнир?">
        <div className="space-y-4">
          <p className="text-sm text-ink-300">«{draft.name}» будет удалён вместе со списками и результатами. Действие необратимо.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Отмена</Button>
            <Button variant="danger" className="flex-1" onClick={del}><Trash2 size={14} /> Удалить</Button>
          </div>
        </div>
      </Modal>

      <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-ink-600">
        <Coins size={12} /> параметры применяются мгновенно: пульт и ТВ-экраны обновятся автоматически
        <CalendarDays size={12} />
      </div>
      <span className="hidden"><SuitsRow size={1} /></span>
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <span className="inline-flex translate-y-0.5 items-center text-gold-500">{icon}</span>
      <h2 className="font-display text-base font-bold text-cream-100">{title}</h2>
      {sub && <span className="truncate font-mono text-[11px] text-ink-500">{sub}</span>}
    </div>
  );
}
