import { useEffect, useRef, useState } from "react";
import { ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { actions } from "../../lib/store";
import { useDB } from "../../lib/hooks";
import type { DisplayMode } from "../../types";
import { Badge, Button, Card, Field, Input, Modal, Reveal, Select, toast } from "../../components/ui";
import { PageHeader } from "../../components/shared";
import { ScoringEditor } from "../../components/editors";
import { SuitsRow } from "../../components/icons";

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

export function SettingsPage() {
  const db = useDB();
  const [name, setName] = useState(db.settings.clubName);
  const [tagline, setTagline] = useState(db.settings.tagline);
  const [confirmSeed, setConfirmSeed] = useState(false);
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
          <div className="mb-3 font-display text-sm font-bold text-cream-100">Начисление очков по умолчанию</div>
          <ScoringEditor value={s.defaultScoring} onChange={(v) => actions.saveDefaultScoring(v)} />
          <p className="mt-2 text-xs text-ink-500">Используется как значение по умолчанию для новых шаблонов и турниров.</p>
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
    </div>
  );
}
