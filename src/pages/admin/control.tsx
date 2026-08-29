import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Flag, MonitorPlay, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { actions } from "../../lib/store";
import { useDB } from "../../lib/hooks";
import { cx, fmtDateTime, fmtNum, fullName, scoringText, timeAgo } from "../../lib/formulas";
import { Avatar, Badge, Button, Card, EmptyState, Modal, Tabs, Toggle, toast } from "../../components/ui";
import { PageHeader, StatusBadge, TypeLabel } from "../../components/shared";
import { CrosshairIcon, Spade } from "../../components/icons";

export default function ControlPage() {
  const { id } = useParams();
  const db = useDB();
  const t = db.tournaments.find((x) => x.id === id);
  const [tab, setTab] = useState("reg");

  if (!t) {
    return <EmptyState icon={<Spade size={36} />} title="Турнир не найден" text="Возможно, он был удалён." />;
  }

  const regs = t.registrations.filter((r) => r.status !== "refunded");
  const live = ["active", "break", "paused"].includes(t.status);

  return (
    <div>
      <Link to="/admin/tournaments" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-400 transition-colors hover:text-gold-300">
        <ArrowLeft size={13} /> все турниры
      </Link>

      <PageHeader kicker="турнир" title={t.name}>
        <StatusBadge status={t.status} />
        <TypeLabel type={t.type} />
        <Badge tone="ink">{fmtDateTime(t.date)}</Badge>
        {live && (
          <Link to="/admin">
            <Button size="sm" variant="felt"><SlidersHorizontal size={13} /> На пульт</Button>
          </Link>
        )}
        <Link to={`/admin/tournaments/${t.id}/edit`}>
          <Button size="sm" variant="outline">Редактировать</Button>
        </Link>
        <Link to={`/display/main?t=${t.id}`} target="_blank">
          <Button size="sm" variant="outline"><MonitorPlay size={13} /> ТВ</Button>
        </Link>
      </PageHeader>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "reg", label: `Регистрация · ${regs.length}` },
          { id: "tables", label: `Столы · ${t.tables.length}` },
          { id: "results", label: t.results ? "Итоги" : "Результаты" },
        ]}
      />

      <div className="pt-5">
        {tab === "reg" && (
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-ink-400">
                записано {regs.length} из {t.maxPlayers} · чекин: <b className="text-felt-300">{regs.filter((r) => r.status === "checked-in").length}</b>
              </div>
              {t.status === "registration" && (
                <Toggle
                  checked={t.regOpen}
                  onChange={(v) => { actions.setRegOpen(t.id, v); toast(v ? "Регистрация открыта" : "Регистрация закрыта", "info"); }}
                  label={t.regOpen ? "Регистрация открыта" : "Регистрация закрыта"}
                />
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {regs.map((r) => {
                const u = db.users.find((x) => x.id === r.userId);
                if (!u) return null;
                return (
                  <div key={r.userId} className="flex items-center gap-3 rounded-lg border border-ink-700/70 bg-ink-800/50 px-3 py-2">
                    <Avatar name={fullName(u)} hue={u.hue} size={30} online={db.presence[u.id]?.status === "online"} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-bold text-cream-100">{u.nickname}</span>
                      <span className="block truncate text-[11px] text-ink-500">{fullName(u)}</span>
                    </span>
                    {t.status === "registration" && (
                      <>
                        <button
                          onClick={() => actions.toggleCheckIn(t.id, r.userId)}
                          className={cx(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-all",
                            r.status === "checked-in"
                              ? "border-felt-400/60 bg-felt-500/15 text-felt-300"
                              : "border-ink-600 text-ink-300 hover:border-felt-400/50 hover:text-felt-300",
                          )}
                        >
                          <CheckCircle2 size={12} /> {r.status === "checked-in" ? "в зале" : "чекин"}
                        </button>
                        <button onClick={() => actions.removeRegistration(t.id, r.userId)} className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-danger-500/10 hover:text-danger-300" title="Убрать">
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              {regs.length === 0 && <div className="py-6 text-center text-sm text-ink-500 md:col-span-2">Список пуст</div>}
            </div>
          </Card>
        )}

        {tab === "tables" && (
          <div>
            {t.tables.length === 0 && <EmptyState title="Столы не настроены" text="Рассадка выполняется на странице турнира (раздел «Столы») или автоматически при запуске." />}
            {t.tables.length > 0 && (
              <>
                {live && (
                  <div className="mb-4 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => { const e = actions.balanceTables(t.id); toast(e ?? "Столы сбалансированы", e ? "err" : "ok"); }}>
                      <RefreshCw size={13} /> Баланс столов
                    </Button>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {t.tables.map((tb) => (
                    <Card key={tb.number} className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-display text-sm font-bold text-cream-100">Стол {tb.number}</span>
                        <Badge tone="ink">{tb.seats.filter(Boolean).length}/{tb.seats.length}</Badge>
                      </div>
                      <div className="space-y-1.5">
                        {tb.seats.map((s, i) => {
                          const u = s ? db.users.find((x) => x.id === s) : null;
                          return (
                            <div key={i} className={cx("flex items-center gap-2.5 rounded-lg px-2 py-1", u ? "bg-ink-800/60" : "opacity-40")}>
                              <span className="w-5 text-center font-mono text-[10px] text-ink-500">{i + 1}</span>
                              {u ? (
                                <>
                                  <Avatar name={fullName(u)} hue={u.hue} size={24} />
                                  <span className="truncate text-xs font-bold text-cream-100">{u.nickname}</span>
                                  <span className="ml-auto truncate pl-2 text-[10px] text-ink-500">{fullName(u)}</span>
                                </>
                              ) : (
                                <span className="text-xs text-ink-600">свободно</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "results" && <ResultsTab tId={t.id} />}
      </div>
    </div>
  );
}

function ResultsTab({ tId }: { tId: string }) {
  const db = useDB();
  const t = db.tournaments.find((x) => x.id === tId)!;
  const [confirmFinish, setConfirmFinish] = useState(false);

  const provisional = useMemo(() => {
    if (t.results) return t.results.map((r) => ({ userId: r.userId, place: r.place }));
    const regAt = new Map<string, number>();
    for (const r of t.registrations) regAt.set(r.userId, r.checkedInAt ?? r.registeredAt);
    const seatedIds: string[] = [];
    for (const tb of t.tables) for (const s of tb.seats) if (s) seatedIds.push(s);
    const remaining = seatedIds.sort((a, b) => (regAt.get(a) ?? 0) - (regAt.get(b) ?? 0));
    const out = [...t.knockouts].reverse().map((k) => k.userId);
    return [...remaining, ...out].map((userId, i) => ({ userId, place: i + 1 }));
  }, [t]);

  if (t.results) {
    const maxPts = t.results[0]?.points ?? 1;
    return (
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-base font-bold text-cream-100">Итоговый протокол</div>
            <div className="text-xs text-ink-400">начисление: {scoringText(t.scoring)}</div>
          </div>
          <Link to={`/display/results?t=${t.id}`} target="_blank">
            <Button size="sm" variant="outline"><MonitorPlay size={13} /> Показать на ТВ</Button>
          </Link>
        </div>
        <div className="space-y-1">
          {t.results.map((r) => {
            const u = db.users.find((x) => x.id === r.userId);
            return (
              <div key={r.userId} className={cx(
                "flex items-center gap-3 rounded-lg border px-3.5 py-2.5",
                r.place === 1 ? "border-gold-500/50 bg-gold-500/10" : "border-transparent hover:bg-ink-800/60",
              )}>
                <span className={cx(
                  "tabular w-8 text-center font-mono text-sm font-bold",
                  r.place === 1 ? "text-gold-400" : r.place === 2 ? "text-ink-200" : r.place === 3 ? "text-[#c07a3d]" : "text-ink-400",
                )}>{r.place}</span>
                <span className="flex-1 truncate text-sm font-bold text-cream-100">{u?.nickname ?? "—"}</span>
                <span className="hidden truncate text-[11px] text-ink-500 sm:block">{u ? fullName(u) : ""}</span>
                {r.knockouts > 0 && <Badge tone="danger"><CrosshairIcon size={10} /> {r.knockouts}</Badge>}
                {r.returns > 0 && <Badge tone="gold">возврат ×{r.returns}</Badge>}
                <span className="hidden w-24 sm:block">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <span className="block h-full rounded-full bg-gold-500" style={{ width: `${(r.points / maxPts) * 100}%` }} />
                  </span>
                </span>
                <span className="tabular w-16 text-right font-mono text-base font-bold text-gold-300">{fmtNum(r.points)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-base font-bold text-cream-100">Предварительный порядок мест</div>
          <div className="text-xs text-ink-400">оставшиеся — по времени чекина, выбывшие — в обратном порядке вылета</div>
        </div>
        {t.status !== "registration" && (
          <Button variant="danger" onClick={() => setConfirmFinish(true)}><Flag size={14} /> Опубликовать итоги</Button>
        )}
      </div>
      <div className="space-y-1">
        {provisional.slice(0, 20).map((p) => {
          const u = db.users.find((x) => x.id === p.userId);
          const ko = t.knockouts.find((k) => k.userId === p.userId);
          return (
            <div key={p.userId} className="flex items-center gap-3 rounded-lg px-3.5 py-2 hover:bg-ink-800/60">
              <span className="tabular w-8 text-center font-mono text-sm font-bold text-ink-400">{p.place}</span>
              <span className="flex-1 truncate text-sm font-semibold text-cream-100">{u?.nickname ?? "—"}</span>
              {!ko ? <Badge tone="felt" dot>в игре</Badge> : <Badge tone="ink">выбыл · ур. {ko.level + 1} · {timeAgo(ko.at)}</Badge>}
            </div>
          );
        })}
      </div>

      <Modal open={confirmFinish} onClose={() => setConfirmFinish(false)} title="Завершить турнир?">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-300">
            Очки по сетке, статистика игроков и достижения рассчитаются мгновенно, результаты попадут в рейтинги.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmFinish(false)}>Отмена</Button>
            <Button
              variant="danger" className="flex-1"
              onClick={() => {
                const err = actions.finishTournament(t.id);
                if (err) toast(err, "err");
                else toast("Результаты опубликованы — очки начислены");
                setConfirmFinish(false);
              }}
            >
              <Flag size={14} /> Опубликовать
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
