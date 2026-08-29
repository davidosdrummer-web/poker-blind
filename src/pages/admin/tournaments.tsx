import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, MonitorPlay, Pencil, Play, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { actions, liveTournament } from "../../lib/store";
import { useDB } from "../../lib/hooks";
import type { Tournament } from "../../types";
import { cx, fmtChips, fmtDateTime, fmtNum, fullName } from "../../lib/formulas";
import { Badge, Bar, Button, Card, Reveal, toast } from "../../components/ui";
import { PageHeader, StatusBadge, TypeLabel } from "../../components/shared";
import { CrosshairIcon, SuitsRow } from "../../components/icons";

export default function TournamentsPage() {
  const db = useDB();
  const live = liveTournament(db);

  const groups: Array<{ id: string; title: string; kicker: string; items: Tournament[] }> = [
    {
      id: "active", title: "Активные", kicker: "идут прямо сейчас",
      items: db.tournaments.filter((t) => ["active", "break", "paused"].includes(t.status)),
    },
    {
      id: "upcoming", title: "Запланированные", kicker: "регистрация и подготовка",
      items: db.tournaments.filter((t) => t.status === "registration"),
    },
    {
      id: "done", title: "Завершённые", kicker: "итоги и очки",
      items: db.tournaments.filter((t) => t.status === "finished"),
    },
  ];

  return (
    <div>
      <PageHeader kicker="расписание клуба" title="Турниры">
        <Link to="/admin/tournaments/new"><Button><Plus size={16} /> Создать турнир</Button></Link>
      </PageHeader>

      <div className="space-y-9">
        {groups.map((g) => (
          <section key={g.id}>
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="font-display text-lg font-bold text-cream-100">{g.title}</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">{g.kicker}</span>
              <Badge tone={g.id === "active" ? "felt" : "ink"} className="ml-auto">{g.items.length}</Badge>
            </div>

            {g.items.length === 0 && (
              <div className="rounded-xl border border-dashed border-ink-700 bg-ink-850/40 px-5 py-6 text-sm text-ink-500">
                {g.id === "active" ? "Сейчас турнир не идёт — откройте пульт после запуска" : g.id === "upcoming" ? "Нет запланированных турниров" : "Завершённых турниров пока нет"}
              </div>
            )}

            <div className="space-y-3">
              {g.items.map((t, i) => {
                const regs = t.registrations.filter((r) => r.status !== "refunded").length;
                const season = db.seasons.find((s) => s.id === t.seasonId);
                const isLive = live?.id === t.id;
                const winner = t.results?.find((r) => r.place === 1);
                const wUser = winner ? db.users.find((u) => u.id === winner.userId) : null;
                return (
                  <Reveal key={t.id} delay={Math.min(i, 4) * 60}>
                    <Card lift className={cx("p-4.5 px-5 py-4", isLive && "border-gold-500/45")}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                        <div className="min-w-0 flex-1 basis-64">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-[15px] font-bold text-cream-100">{t.name}</h3>
                            <TypeLabel type={t.type} />
                            <StatusBadge status={t.status} />
                          </div>
                          <div className="mt-1 text-xs text-ink-400">
                            {fmtDateTime(t.date)} · {season?.name ?? "вне сезона"} · стек {fmtNum(t.startingChips)}
                          </div>
                        </div>

                        <div className="w-44 shrink-0">
                          <div className="mb-1 flex justify-between font-mono text-[11px] text-ink-400">
                            <span>{t.status === "finished" ? "участников" : "регистрация"}</span>
                            <span className="text-cream-100">{regs}/{t.maxPlayers}</span>
                          </div>
                          <Bar value={regs} max={t.maxPlayers} tone={isLive ? "felt" : "gold"} />
                        </div>

                        {t.status === "finished" && wUser && winner && (
                          <div className="flex items-center gap-2 rounded-lg bg-gold-500/8 px-3 py-1.5 text-xs text-ink-200">
                            <span className="text-gold-400">♛</span>
                            <b className="text-gold-300">{wUser.nickname}</b>
                            <span className="font-mono">{fmtNum(winner.points)}</span>
                          </div>
                        )}

                        <div className="flex shrink-0 items-center gap-1.5">
                          {isLive && (
                            <Link to="/admin">
                              <Button size="sm" variant="felt"><SlidersHorizontal size={13} /> Пульт <ArrowRight size={12} /></Button>
                            </Link>
                          )}
                          {t.status === "registration" && (
                            <Link to={`/admin/tournaments/${t.id}`}>
                              <Button size="sm" variant="dark"><Play size={13} /> Открыть <ArrowRight size={12} /></Button>
                            </Link>
                          )}
                          {t.status === "finished" && (
                            <Link to={`/admin/tournaments/${t.id}`}>
                              <Button size="sm" variant="dark"><BarChart3 size={13} /> Итоги</Button>
                            </Link>
                          )}
                          <Link to={`/admin/tournaments/${t.id}/edit`} title="Редактировать">
                            <Button size="sm" variant="outline"><Pencil size={13} /></Button>
                          </Link>
                          <Link to={`/display/main?t=${t.id}`} target="_blank" title="Показать на ТВ">
                            <Button size="sm" variant="outline"><MonitorPlay size={13} /></Button>
                          </Link>
                          {t.status !== "active" && t.status !== "break" && t.status !== "paused" && (
                            <Button
                              size="sm" variant="ghost" title="Удалить"
                              onClick={() => {
                                const err = actions.deleteTournament(t.id);
                                toast(err ?? "Турнир удалён", err ? "err" : "info");
                              }}
                            >
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-center gap-3 text-xs text-ink-500">
        <SuitsRow size={12} />
        <span>одновременно в клубе проводится один турнир — остальные ждут очереди</span>
        <CrosshairIcon size={12} className="text-ink-600" />
        <span>{fmtChips(db.tournaments.reduce((s, t) => s + (t.results ? t.results.reduce((q, r) => q + r.points, 0) : 0), 0))} очков разыграно</span>
      </div>
    </div>
  );
}
