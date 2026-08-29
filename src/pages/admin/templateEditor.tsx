import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Gift, LayoutTemplate, ListChecks, Plus, Save, SlidersHorizontal, Trash2, Trophy, Users,
} from "lucide-react";
import { actions } from "../../lib/store";
import { useDB } from "../../lib/hooks";
import type { DB, TableState, Template, TournamentType } from "../../types";
import { cx, fmtDuration, scoringText, structureMinutes, totalSeats, uid, TYPE_LABELS } from "../../lib/formulas";
import { Badge, Button, Card, Field, Input, Modal, Select, Toggle, toast } from "../../components/ui";
import { BonusDefsEditor, ScoringEditor, StructureEditor } from "../../components/editors";
import { TablesEditor, type ParticipantLite } from "../../components/editors";
import { SuitsRow } from "../../components/icons";

function blankTemplate(db: DB): Template {
  const sc = db.settings.defaultScoring;
  return {
    id: "", name: "", type: "freezeout", description: "",
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
    tables: [],
  };
}

const SECTIONS = [
  { id: "params", label: "Параметры", icon: SlidersHorizontal },
  { id: "structure", label: "Структура", icon: ListChecks },
  { id: "bonuses", label: "Бонусы", icon: Gift },
  { id: "scoring", label: "Очки", icon: Trophy },
  { id: "tables", label: "Столы", icon: LayoutTemplate },
];

export default function TemplateEditorPage() {
  const { id } = useParams();
  const db = useDB();
  const navigate = useNavigate();
  const existing = db.templates.find((t) => t.id === id);
  const isNew = !existing;

  const [draft, setDraft] = useState<Template>(() => existing ? JSON.parse(JSON.stringify(existing)) : blankTemplate(db));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const savedRef = useRef(false);

  const patch = (p: Partial<Template>) => setDraft((d) => ({ ...d, ...p }));

  const copyFrom = (tplId: string) => {
    const tpl = db.templates.find((t) => t.id === tplId);
    if (!tpl || tpl.id === draft.id) return;
    setDraft((d) => ({ ...JSON.parse(JSON.stringify(tpl)), id: d.id, name: d.name || `${tpl.name} (копия)` }));
    toast(`Поля скопированы из «${tpl.name}»`, "info");
  };

  const save = () => {
    if (!draft.name.trim()) { toast("Укажите название шаблона", "err"); return; }
    const toSave: Template = { ...draft, name: draft.name.trim(), id: draft.id || uid("tpl") };
    actions.saveTemplate(toSave);
    toast(isNew ? `Шаблон «${toSave.name}» сохранён` : "Изменения сохранены");
    savedRef.current = true;
    if (isNew) navigate(`/admin/templates/${toSave.id}/edit`, { replace: true });
  };

  const del = () => {
    actions.deleteTemplate(draft.id);
    toast("Шаблон удалён", "info");
    navigate("/admin/templates");
  };

  const totalMin = structureMinutes(draft.levels, draft.breaks);

  /* участники для превью рассадки — вся база клуба */
  const participants: ParticipantLite[] = db.users
    .filter((u) => u.role === "player" && !u.archived)
    .slice(0, draft.maxPlayers)
    .map((u) => ({ userId: u.id, checked: true, user: u }));
  const ratingOf = () => 0;

  return (
    <div>
      {/* верхняя панель */}
      <div className="sticky top-0 z-30 -mx-6 mb-6 border-b border-ink-700/80 bg-ink-900/92 px-6 py-3.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/admin/templates" className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-400 transition-colors hover:text-gold-300">
            <ArrowLeft size={14} /> шаблоны
          </Link>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-gold-500">{isNew ? "новый шаблон" : "редактирование шаблона"}</div>
            <div className="truncate font-display text-base font-bold text-cream-100">{draft.name || "Без названия"}</div>
          </div>

          <Select value="" onChange={(e) => { if (e.target.value) copyFrom(e.target.value); }} className="w-52 text-xs">
            <option value="">— скопировать из… —</option>
            {db.templates.filter((t) => t.id !== draft.id).map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
          </Select>
          <Button size="sm" onClick={save}><Save size={13} /> Сохранить шаблон</Button>
          {!isNew && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} title="Удалить шаблон">
              <Trash2 size={14} />
            </Button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
          <Badge tone="cream">{TYPE_LABELS[draft.type]}</Badge>
          <span>структура: {fmtDuration(totalMin)}</span>
          <span>· шаблон не запускается — он используется при создании турниров</span>
        </div>
      </div>

      {/* навигация по разделам */}
      <nav className="sticky top-[86px] z-20 -mx-6 mb-6 border-b border-ink-800/70 bg-ink-950/85 px-6 backdrop-blur">
        <div className="flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => document.getElementById(`tpl-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
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
        {/* ПАРАМЕТРЫ (без даты и времени старта) */}
        <section id="tpl-params" className="scroll-mt-40">
          <SectionTitle icon={<SlidersHorizontal size={15} />} title="Параметры" sub="базовые настройки турнира по шаблону" />
          <Card className="p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название шаблона">
                <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Пятничный Фризаут" />
              </Field>
              <Field label="Стартовый стек">
                <Input type="number" value={draft.startingChips} onChange={(e) => patch({ startingChips: Number(e.target.value) || 0 })} className="font-mono" />
              </Field>
              <Field label="Максимум игроков">
                <Input type="number" value={draft.maxPlayers} onChange={(e) => patch({ maxPlayers: Math.max(2, Number(e.target.value) || 2) })} className="font-mono" />
              </Field>
              <Field label="Регистрация после старта" hint="минут поздней регистрации, 0 — выключено">
                <Input type="number" value={draft.lateRegMinutes} onChange={(e) => patch({ lateRegMinutes: Math.max(0, Number(e.target.value) || 0) })} className="font-mono" />
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

            <div className="mt-4 rounded-lg border border-ink-700 bg-ink-800/50 p-3">
              <Toggle checked={draft.rebuyAllowed} onChange={(v) => patch({ rebuyAllowed: v })} label="Ребаи разрешены" />
              {draft.rebuyAllowed && (
                <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
                  <Field label="Макс. ребаев">
                    <Input type="number" value={draft.maxRebuys} onChange={(e) => patch({ maxRebuys: Math.max(1, Number(e.target.value) || 1) })} className="font-mono" />
                  </Field>
                  <Field label="Фишек за ребай">
                    <Input type="number" value={draft.rebuyCostChips} onChange={(e) => patch({ rebuyCostChips: Number(e.target.value) || 0 })} className="font-mono" />
                  </Field>
                  <Field label="Ребаи до уровня">
                    <Input type="number" value={draft.rebuyUntilLevel + 1} onChange={(e) => patch({ rebuyUntilLevel: Math.max(0, Number(e.target.value) - 1) })} className="font-mono" />
                  </Field>
                </div>
              )}
            </div>

            <div className="mt-4">
              <Field label="Описание">
                <textarea
                  value={draft.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={3}
                  placeholder="Что особенного в этом формате…"
                  className="w-full rounded-lg border border-ink-600 bg-ink-800/80 px-3 py-2.5 text-sm text-cream-100 outline-none transition-all placeholder:text-ink-500 focus:border-gold-500/70 focus:ring-2 focus:ring-gold-500/20"
                />
              </Field>
            </div>
          </Card>
        </section>

        {/* СТРУКТУРА */}
        <section id="tpl-structure" className="scroll-mt-40">
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
        <section id="tpl-bonuses" className="scroll-mt-40">
          <SectionTitle icon={<Gift size={15} />} title="Бонусы" sub="пресеты для кнопки «Бонус» на пульте" />
          <Card className="p-5">
            <BonusDefsEditor value={draft.bonusDefs} onChange={(v) => patch({ bonusDefs: v })} />
          </Card>
        </section>

        {/* ОЧКИ */}
        <section id="tpl-scoring" className="scroll-mt-40">
          <SectionTitle icon={<Trophy size={15} />} title="Очки" sub={scoringText(draft.scoring)} />
          <Card className="p-5">
            <ScoringEditor value={draft.scoring} onChange={(v) => patch({ scoring: v })} />
          </Card>
        </section>

        {/* СТОЛЫ (конфигурация по умолчанию) */}
        <section id="tpl-tables" className="scroll-mt-40">
          <SectionTitle icon={<LayoutTemplate size={15} />} title="Столы" sub={`${draft.tables.length} столов по умолчанию · ${totalSeats(draft)} мест`} />
          <Card className="p-5">
            <TablesEditor
              tables={draft.tables}
              onChange={(v) => patch({ tables: v })}
              participants={participants}
              ratingOf={ratingOf}
            />
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              Конфигурация столов из шаблона подставляется в новые турниры; рассадить участников по местам можно там же перед стартом.
            </p>
          </Card>
        </section>
      </div>

      {/* удаление */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Удалить шаблон?">
        <div className="space-y-4">
          <p className="text-sm text-ink-300">«{draft.name}» будет удалён из библиотеки шаблонов. Созданные из него турниры останутся.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Отмена</Button>
            <Button variant="danger" className="flex-1" onClick={del}><Trash2 size={14} /> Удалить</Button>
          </div>
        </div>
      </Modal>

      <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-ink-600">
        <Users size={12} /> шаблон сохранится в библиотеку и станет доступен при создании турниров
        <SuitsRow size={11} />
      </div>
      <span className="hidden"><Plus size={1} />{cx("")}</span>
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
