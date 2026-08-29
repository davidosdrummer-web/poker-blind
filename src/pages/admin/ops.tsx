import { useEffect, useRef, useState } from "react";
import { Award, ExternalLink, Pencil, Plus, RefreshCw, Trash2, Volume2, VolumeX } from "lucide-react";
import { actions } from "../../lib/store";
import { useDB } from "../../lib/hooks";
import type { AchievementDef, DisplayMode, StatKey } from "../../types";
import { STAT_LABELS, cx, uid } from "../../lib/formulas";
import { playEvent, type SoundKind } from "../../lib/sound";
import { Badge, Button, Card, Field, Input, Modal, Reveal, Select, Toggle, toast } from "../../components/ui";
import { PageHeader } from "../../components/shared";
import { ScoringEditor } from "../../components/editors";
import {
  CardsIcon, CrownIcon, CrosshairIcon, FlameIcon, GemIcon, ShieldIcon, SuitsRow, TableIcon, TrophyIcon,
} from "../../components/icons";

const MODES: Array<{ v: DisplayMode; label: string }> = [
  { v: "main", label: "Основной (блайнды + таймер)" },
  { v: "final", label: "Финальный стол" },
  { v: "results", label: "Результаты" },
];

/** Живой предпросмотр: реальный ТВ-маршрут в iframe, вписанный в карточку. */
function TvPreview({ mode, tid, name }: { mode: DisplayMode; tid: string; name: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.28);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0) setScale(el.clientWidth / 1280);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden border-b border-ink-700 bg-ink-950"
      style={{ height: Math.round(720 * scale) }}
    >
      <iframe
        title={name}
        src={`#/display/${mode}${tid ? `?t=${tid}` : ""}`}
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
        style={{ width: 1280, height: 720, transform: `scale(${scale})` }}
        loading="lazy"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/40 to-transparent" />
      <Badge tone="gold" className="absolute right-2 top-2">live preview</Badge>
    </div>
  );
}

export function DisplaysPage() {
  const db = useDB();

  return (
    <div>
      <PageHeader kicker="информационные экраны" title="ТВ-экраны">
        <Button onClick={() => {
          actions.saveDisplay({ id: `d_${Date.now().toString(36)}`, name: `Экран ${db.displays.length + 1}`, mode: "main", tournamentId: null });
          toast("Экран добавлен");
        }}>
          <Plus size={16} /> Добавить экран
        </Button>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {db.displays.map((d, i) => {
          const tid = d.tournamentId ?? "";
          return (
            <Reveal key={d.id} delay={i * 70}>
              <Card lift className="overflow-hidden">
                <TvPreview mode={d.mode} tid={tid} name={d.name} />
                <div className="space-y-3 p-4">
                  <Field label="Название">
                    <Input value={d.name} onChange={(e) => actions.saveDisplay({ ...d, name: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Режим">
                      <Select value={d.mode} onChange={(e) => { actions.saveDisplay({ ...d, mode: e.target.value as DisplayMode }); toast("Режим экрана обновлён", "info"); }}>
                        {MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Турнир">
                      <Select value={tid} onChange={(e) => { actions.saveDisplay({ ...d, tournamentId: e.target.value || null }); toast("Турнир на экране обновлён", "info"); }}>
                        <option value="">— текущий —</option>
                        {db.tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <div className="flex gap-1.5">
                    <a href={`#/display/${d.mode}${tid ? `?t=${tid}` : ""}`} target="_blank" rel="noreferrer" className="flex-1">
                      <Button size="sm" variant="dark" className="w-full"><ExternalLink size={13} /> Открыть</Button>
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => { actions.deleteDisplay(d.id); toast("Экран удалён", "info"); }} title="Удалить">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ НАСТРОЙКИ ============================ */

const SWATCHES = [
  { c: "#d4a017", label: "Золото" },
  { c: "#e4ba41", label: "Шампань" },
  { c: "#2f9767", label: "Сукно" },
  { c: "#d94f43", label: "Черви" },
  { c: "#71718f", label: "Графит" },
];

const BG_SWATCHES = [
  { c: "#0a0a12", label: "Полночь" },
  { c: "#0b1410", label: "Глубокое сукно" },
  { c: "#120d1a", label: "Баклажан" },
  { c: "#171009", label: "Виски" },
  { c: "#0b1118", label: "Тёмный нави" },
  { c: "#121212", label: "Графит" },
];

const ACH_ICONS: Record<AchievementDef["icon"], typeof CardsIcon> = {
  cards: CardsIcon, trophy: TrophyIcon, crown: CrownIcon, table: TableIcon,
  crosshair: CrosshairIcon, shield: ShieldIcon, flame: FlameIcon, gem: GemIcon,
};

const SOUND_PREVIEWS: Array<{ k: SoundKind; label: string }> = [
  { k: "chips", label: "Фишки" },
  { k: "level", label: "Уровень" },
  { k: "ko", label: "Нокаут" },
  { k: "bonus", label: "Бонус" },
  { k: "win", label: "Победа" },
];

export function SettingsPage() {
  const db = useDB();
  const [name, setName] = useState(db.settings.clubName);
  const [tagline, setTagline] = useState(db.settings.tagline);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [achModal, setAchModal] = useState<AchievementDef | null>(null);
  const s = db.settings;

  return (
    <div className="max-w-3xl">
      <PageHeader kicker="конфигурация" title="Настройки клуба" />

      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-sm font-bold text-cream-100">Бренд</div>
            <SuitsRow size={13} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Название клуба">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Язык интерфейса">
              <Select value={s.language} onChange={(e) => { actions.saveSettings({ language: e.target.value as "ru" | "en" }); toast("Язык сохранён", "info"); }}>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Слоган (попадает в бегущую строку ТВ)">
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </Field>
          </div>
          <Button className="mt-4" onClick={() => { actions.saveSettings({ clubName: name.trim() || "Золотой Туз", tagline }); toast("Настройки бренда сохранены"); }}>
            Сохранить
          </Button>
        </Card>

        <Card className="p-5">
          <div className="mb-3 font-display text-sm font-bold text-cream-100">Акцентный цвет</div>
          <div className="flex flex-wrap gap-3">
            {SWATCHES.map((sw) => (
              <button
                key={sw.c}
                onClick={() => { actions.saveSettings({ primary: sw.c }); toast(`Акцент: ${sw.label.toLowerCase()}`, "info"); }}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className={`h-10 w-10 rounded-full border-2 transition-all group-hover:scale-110 ${s.primary === sw.c ? "border-cream-100 shadow-lg" : "border-transparent"}`}
                  style={{ background: sw.c }}
                />
                <span className="text-[10px] text-ink-400">{sw.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-500">Применяется сразу: кнопки, акценты, ТВ-экраны.</p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 font-display text-sm font-bold text-cream-100">Цвет фона платформы</div>
          <div className="flex flex-wrap gap-3">
            {BG_SWATCHES.map((sw) => (
              <button
                key={sw.c}
                onClick={() => { actions.saveSettings({ background: sw.c }); toast(`Фон: ${sw.label.toLowerCase()}`, "info"); }}
                className="group flex flex-col items-center gap-1.5"
                title={sw.label}
              >
                <span
                  className={cx(
                    "h-10 w-14 rounded-lg border-2 transition-all group-hover:scale-105",
                    s.background === sw.c ? "border-gold-400 shadow-lg" : "border-ink-600",
                  )}
                  style={{ background: sw.c }}
                />
                <span className="text-[10px] text-ink-400">{sw.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-500">Базовый тёмный фон интерфейса — применяется ко всем разделам и ТВ-экранам.</p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-cream-100">
              {s.soundsEnabled ? <Volume2 size={16} className="text-gold-400" /> : <VolumeX size={16} className="text-ink-500" />}
              Звуковое сопровождение
            </div>
            <Toggle
              checked={s.soundsEnabled}
              onChange={(v) => { actions.saveSettings({ soundsEnabled: v }); toast(v ? "Звуки включены" : "Звуки выключены", "info"); }}
              label={s.soundsEnabled ? "Включено" : "Выключено"}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-ink-400">Громкость</span>
            <input
              type="range" min={0} max={100} step={5} value={s.soundVolume}
              onChange={(e) => actions.saveSettings({ soundVolume: Number(e.target.value) })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-700 accent-gold-500"
              aria-label="Громкость"
            />
            <span className="tabular w-10 text-right font-mono text-sm font-bold text-gold-300">{s.soundVolume}%</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SOUND_PREVIEWS.map((p) => (
              <Button key={p.k} size="xs" variant="dark" onClick={() => playEvent(p.k)}>
                <Volume2 size={12} /> {p.label}
              </Button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            События турнира — смена уровня, нокаут, бонус, ребай, победа — озвучиваются на пульте и в кабинете. Синтезируются на лету, файлы не нужны.
          </p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 font-display text-sm font-bold text-cream-100">Начисление очков по умолчанию</div>
          <ScoringEditor value={s.defaultScoring} onChange={(v) => actions.saveSettings({ defaultScoring: v })} />
          <p className="mt-2 text-xs text-ink-500">Используется как значение по умолчанию для новых шаблонов и турниров.</p>
        </Card>

        <Card className="p-5">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-cream-100">
              <Award size={16} className="text-gold-400" /> Достижения игроков
            </div>
            <Button
              size="sm"
              onClick={() => setAchModal({
                id: uid("ach"), name: "", description: "", icon: "trophy",
                condition: { stat: "wins", min: 1 }, builtIn: false,
              })}
            >
              <Plus size={14} /> Новое достижение
            </Button>
          </div>
          <p className="mb-4 text-xs text-ink-500">
            Выдаются игрокам автоматически после турниров, когда выполняется условие. Изменения видны в ЛК игрока мгновенно.
          </p>
          <div className="space-y-1.5">
            {db.achievements.length === 0 && (
              <div className="rounded-lg border border-dashed border-ink-600 px-3 py-5 text-center text-xs text-ink-400">
                Достижений нет — создайте первое
              </div>
            )}
            {db.achievements.map((a) => {
              const Icon = ACH_ICONS[a.icon] ?? TrophyIcon;
              const statLabel = STAT_LABELS.find((x) => x.k === a.condition.stat)?.label ?? a.condition.stat;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-ink-700/70 bg-ink-800/50 px-3 py-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-300">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-cream-100">{a.name}</span>
                      {a.builtIn && <Badge tone="ink">встроенное</Badge>}
                    </div>
                    <div className="truncate text-[11px] text-ink-400">{a.description}</div>
                  </div>
                  <Badge tone="cream" className="shrink-0">{statLabel} ≥ {a.condition.min}</Badge>
                  <Button size="xs" variant="ghost" onClick={() => setAchModal({ ...a })} title="Редактировать"><Pencil size={12} /></Button>
                  <Button
                    size="xs" variant="ghost" title="Удалить"
                    onClick={() => { actions.deleteAchievement(a.id); toast(`«${a.name}» удалено`, "info"); }}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="border-danger-500/30 p-5">
          <div className="mb-2 flex items-center gap-2 font-display text-sm font-bold text-danger-300">
            <RefreshCw size={15} /> Демо-данные
          </div>
          <p className="text-xs leading-relaxed text-ink-400">
            Сброс вернёт клуб к исходному состоянию: игроки, сезоны, турниры и рейтинг из поставки.
            Изменения во всех вкладках будут перезаписаны.
          </p>
          <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmSeed(true)}>
            Сбросить к демо-данным
          </Button>
        </Card>
      </div>

      <Modal open={confirmSeed} onClose={() => setConfirmSeed(false)} title="Сбросить все данные?">
        <div className="space-y-4">
          <p className="text-sm text-ink-300">Действие необратимо: текущие турниры, результаты и профили будут заменены демо-набором.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmSeed(false)}>Отмена</Button>
            <Button variant="danger" className="flex-1" onClick={() => { actions.reseedAll(); setConfirmSeed(false); toast("Демо-данные восстановлены"); }}>
              Сбросить
            </Button>
          </div>
        </div>
      </Modal>

      {achModal && (
        <AchievementForm
          value={achModal}
          onClose={() => setAchModal(null)}
          onSave={(a) => {
            const err = actions.saveAchievement(a);
            if (err) { toast(err, "err"); return; }
            toast(`Достижение «${a.name}» сохранено`);
            setAchModal(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- форма достижения ---------------- */

function AchievementForm({ value, onSave, onClose }: {
  value: AchievementDef;
  onSave: (a: AchievementDef) => void;
  onClose: () => void;
}) {
  const [a, setA] = useState(value);
  const isNew = !value.name;
  const Icon = ACH_ICONS[a.icon] ?? TrophyIcon;

  return (
    <Modal open onClose={onClose} title={isNew ? "Новое достижение" : `Редактирование: ${value.name}`}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-gold-400 bg-gold-500/12 text-gold-300 shadow-[0_0_20px_rgba(212,160,23,0.25)]">
            <Icon size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-bold text-cream-100">{a.name || "Без названия"}</div>
            <div className="truncate text-xs text-ink-400">{a.description || "Описание достижения"}</div>
          </div>
        </div>

        <Field label="Название">
          <Input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="Первая победа" autoFocus />
        </Field>
        <Field label="Описание">
          <Input value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} placeholder="Занять 1-е место" />
        </Field>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">Иконка</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(ACH_ICONS) as AchievementDef["icon"][]).map((k) => {
              const Ic = ACH_ICONS[k];
              return (
                <button
                  key={k}
                  onClick={() => setA({ ...a, icon: k })}
                  className={cx(
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-all",
                    a.icon === k ? "border-gold-400 bg-gold-500/15 text-gold-300" : "border-ink-600 text-ink-400 hover:border-ink-400 hover:text-cream-100",
                  )}
                  title={k}
                >
                  <Ic size={16} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Условие (показатель)">
            <Select value={a.condition.stat} onChange={(e) => setA({ ...a, condition: { ...a.condition, stat: e.target.value as StatKey } })}>
              {STAT_LABELS.map((sl) => <option key={sl.k} value={sl.k}>{sl.label}</option>)}
            </Select>
          </Field>
          <Field label="Порог (≥)">
            <Input
              type="number" min={1} value={a.condition.min}
              onChange={(e) => setA({ ...a, condition: { ...a.condition, min: Math.max(0, Number(e.target.value) || 0) } })}
              className="font-mono"
            />
          </Field>
        </div>

        <div className="rounded-lg bg-ink-800/70 px-3.5 py-2.5 text-xs text-ink-400">
          Игрок получит достижение, когда значение показателя достигнет порога — проверка идёт после каждого завершённого турнира.
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button
            className="flex-1"
            onClick={() => onSave({ ...a, name: a.name.trim(), description: a.description.trim() })}
            disabled={!a.name.trim()}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
