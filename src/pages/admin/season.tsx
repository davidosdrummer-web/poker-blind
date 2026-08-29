import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarRange, CrownIcon, Swords, Trophy, Users } from "lucide-react";
import { actions } from "../../lib/store";
import { useDB } from "../../lib/hooks";
import { computeBoard, cx, fmtDate, fmtNum, fullName, scoringText } from "../../lib/formulas";
import { Avatar, Badge, Button, Card, EmptyState, Modal, toast } from "../../components/ui";
import { PageHeader, StatusBadge } from "../../components/shared";
import { Spade, SuitsRow } from "../../components/icons";
import { nextSort, SortHead, type SortState } from "./ratings";

export default function SeasonPage() {
  const { id } = useParams();
  const db = useDB();
  const navigate = useNavigate();
  const season = db.seasons.find((s) => s.id === id);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [sort, setSort] = useState<SortState>({ k: "points", dir: -1 });

  const board = useMemo(() => computeBoard(db, id ?? null), [db, id]);
  const events = useMemo(() => db.tournaments.filter((t) => t.seasonId === id), [db.tournaments, id]);
  const finished = events.filter((t) => t.status === "registration" ? false : t.results);
  const finalT = useMemo(() => events.find((t) => t.nonScoring), [events]);
  const top18 = board.slice(0, 18);
  const leader = board[0] ? db.users.find((u) => u.id === board[0].userId) : null;

  const nickOf = (userId: string) => db.users.find((x) => x.id === userId)?.nickname ?? "";
  const sorted = useMemo(() => {
    const arr = [...board];
    const { k, dir } = sort;
    arr.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      if (k === "nick") { va = nickOf(a.userId).toLowerCase(); vb = nickOf(b.userId).toLowerCase(); }
      else if (k === "name") {
        const ua = db.users.find((x) => x.id === a.userId);
        const ub = db.users.find((x) => x.id === b.userId);
        va = ua ? fullName(ua).toLowerCase() : "";
        vb = ub ? fullName(ub).toLowerCase() : "";
      } else {
        va = (a as unknown as Record<string, number>)[k] ?? 0;
        vb = (b as unknown as Record<string, number>)[k] ?? 0;
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return b.points - a.points;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, sort, db.users]);

  if (!season) {
    return (
      <EmptyState icon={<Spade size={34} />} title="Сезон не найден" text="Возможно, он был удалён.">
      </EmptyState>
    );
  }

  const createFinal = () => {
    const res = actions.createSeasonFinal(season.id);
    if (res && res.startsWith("tr_")) {
      toast("Финальный турнир сформирован — топ-18 в списке участников");
      setConfirmFinal(false);
      navigate(`/admin/tournaments/${res}`);
    } else {
      toast(res ?? "Не удалось создать финал", "err");
    }
  };

  return (
    <div>
      <Link to="/admin/seasons" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-400 transition-colors hover:text-gold-300">
        <ArrowLeft size={13} /> все сезоны
      </Link>

      <PageHeader kicker="зачётный период" title={season.name}>
        {season.isActive && <Badge tone="gold" dot>идёт сейчас</Badge>}
        {season.archived && <Badge tone="ink">архив</Badge>}
        <Badge tone="ink">{fmtDate(new Date(season.startDate).getTime())} → {fmtDate(new Date(season.endDate).getTime())}</Badge>
      </PageHeader>

      {/* сводка */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "турниров проведено", v: String(finished.length), c: "text-cream-100", icon: <Swords size={14} className="text-gold-500" /> },
          { l: "в зачёте сезона", v: String(board.length), c: "text-felt-300", icon: <Users size={14} className="text-felt-300" /> },
          { l: "лидер сезона", v: leader?.nickname ?? "—", c: "text-gold-300", icon: <CrownIcon size={14} className="text-gold-400" /> },
          { l: "очков у лидера", v: leader ? fmtNum(board[0].points) : "—", c: "text-gold-300", icon: <Trophy size={14} className="text-gold-400" /> },
        ].map((x) => (
          <div key={x.l} className="rounded-xl border border-ink-700 bg-ink-850/80 px-4 py-3.5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">{x.icon}{x.l}</div>
            <div className={cx("mt-1.5 truncate font-display text-xl font-extrabold", x.c)}>{x.v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          {/* рейтинг сезона */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 bg-ink-800/70 px-5 py-3">
              <span className="font-display text-sm font-bold text-cream-100">Рейтинг сезона</span>
              <span className="font-mono text-[11px] text-ink-500">клик по заголовку — сортировка</span>
            </div>
            {board.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={<CalendarRange size={28} />} title="Зачёт пуст" text="Завершите первый турнир сезона — рейтинг построится автоматически." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-700 text-left">
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-400">Место</th>
                      <th className="px-3 py-2.5"><SortHead label="Никнейм" k="nick" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} /></th>
                      <th className="px-3 py-2.5"><SortHead label="Имя Фамилия" k="name" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} /></th>
                      <th className="px-3 py-2.5 text-right"><SortHead label="Очки" k="points" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="right" /></th>
                      <th className="px-3 py-2.5 text-center"><SortHead label="Игр" k="events" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="center" /></th>
                      <th className="px-3 py-2.5 text-center"><SortHead label="Побед" k="wins" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="center" /></th>
                      <th className="px-3 py-2.5 text-center"><SortHead label="Топ-3" k="top3" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="center" /></th>
                      <th className="px-4 py-2.5 text-center"><SortHead label="Выбил" k="knockouts" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="center" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => {
                      const u = db.users.find((x) => x.id === r.userId);
                      if (!u) return null;
                      return (
                        <tr key={r.userId} className={cx("border-b border-ink-700/40 transition-colors last:border-0 hover:bg-ink-800/60", r.rank === 1 && "bg-gold-500/8")}>
                          <td className="px-4 py-2">
                            <span className={cx(
                              "tabular mx-auto flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-extrabold",
                              r.rank === 1 ? "bg-gold-500 text-ink-950" : r.rank === 2 ? "bg-ink-500 text-cream-50" : r.rank === 3 ? "bg-[#8a5a2b] text-cream-50" : "text-ink-400",
                            )}>{r.rank}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <Avatar name={fullName(u)} hue={u.hue} size={26} photo={u.photoURL} />
                              <span className="font-bold text-cream-100">{u.nickname}</span>
                              {r.rank === 1 && <CrownIcon size={13} className="text-gold-400" />}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-ink-300">{fullName(u)}</td>
                          <td className="tabular px-3 py-2 text-right font-mono font-extrabold text-gold-300">{fmtNum(r.points)}</td>
                          <td className="tabular px-3 py-2 text-center font-mono text-ink-200">{r.events}</td>
                          <td className="tabular px-3 py-2 text-center font-mono text-ink-200">{r.wins}</td>
                          <td className="tabular px-3 py-2 text-center font-mono text-ink-200">{r.top3}</td>
                          <td className="tabular px-4 py-2 text-center font-mono text-ink-200">{r.knockouts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* турниры сезона */}
          <Card className="p-5">
            <div className="mb-3 font-display text-sm font-bold text-cream-100">Турниры сезона · {events.length}</div>
            {events.length === 0 && <div className="text-sm text-ink-500">В этом сезоне турниров пока нет</div>}
            <div className="space-y-1.5">
              {events.map((t) => {
                const w = t.results?.find((r) => r.place === 1);
                const wU = w ? db.users.find((u) => u.id === w.userId) : null;
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-700/70 bg-ink-800/50 px-4 py-2.5">
                    <Link to={`/admin/tournaments/${t.id}`} className="min-w-0 flex-1 truncate text-sm font-bold text-cream-100 transition-colors hover:text-gold-300">
                      {t.name}
                      {t.nonScoring && <Badge tone="gold" className="ml-2">финал · без очков</Badge>}
                    </Link>
                    <span className="font-mono text-[11px] text-ink-500">{fmtDate(new Date(t.date).getTime())}</span>
                    <StatusBadge status={t.status} />
                    {wU && <span className="text-xs text-ink-400">🏆 <b className="text-gold-300">{wU.nickname}</b>{!t.nonScoring && w ? ` · ${fmtNum(w.points)}` : ""}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* финал сезона */}
        <div className="space-y-5">
          <Card className={cx("p-5", !finalT && "shine-wrap border-gold-500/40")}>
            <div className="mb-1 flex items-center gap-2">
              <Trophy size={16} className="text-gold-400" />
              <span className="font-display text-sm font-bold text-cream-100">Финал сезона</span>
            </div>
            <p className="text-xs leading-relaxed text-ink-400">
              В финальный турнир автоматически попадает <b className="text-gold-300">топ-18</b> сезона.
              Очки в финале <b className="text-cream-100">не начисляются</b> и не влияют на рейтинги.
            </p>

            {finalT ? (
              <div className="mt-4 rounded-xl border border-felt-400/40 bg-felt-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-felt-300">
                  <Swords size={14} /> Финал сформирован
                </div>
                <Link to={`/admin/tournaments/${finalT.id}`} className="mt-1 block truncate text-sm font-bold text-cream-100 transition-colors hover:text-gold-300">
                  {finalT.name} →
                </Link>
                <div className="mt-1 text-[11px] text-ink-400">
                  участников: {finalT.registrations.length} · {fmtDate(new Date(finalT.date).getTime())}
                </div>
                <StatusBadge status={finalT.status} />
              </div>
            ) : (
              <>
                <div className="mt-4">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-500">топ-18 претендентов</div>
                  <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {top18.length === 0 && <div className="rounded-lg border border-dashed border-ink-600 px-3 py-5 text-center text-xs text-ink-400">Зачёт пуст — финал создать нельзя</div>}
                    {top18.map((r) => {
                      const u = db.users.find((x) => x.id === r.userId);
                      if (!u) return null;
                      return (
                        <div key={r.userId} className={cx("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5", r.rank <= 3 ? "bg-gold-500/10" : "bg-ink-800/50")}>
                          <span className={cx(
                            "tabular w-6 text-center font-mono text-xs font-extrabold",
                            r.rank === 1 ? "text-gold-400" : r.rank === 2 ? "text-ink-200" : r.rank === 3 ? "text-[#c07a3d]" : "text-ink-500",
                          )}>{r.rank}</span>
                          <Avatar name={fullName(u)} hue={u.hue} size={24} photo={u.photoURL} />
                          <span className="min-w-0 flex-1 truncate text-xs font-bold text-cream-100">{u.nickname}</span>
                          <span className="tabular font-mono text-xs font-bold text-gold-300">{fmtNum(r.points)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Button
                  className="mt-4 w-full" size="lg"
                  disabled={top18.length < 2}
                  onClick={() => setConfirmFinal(true)}
                >
                  <Trophy size={16} /> Сформировать финальный турнир
                </Button>
                {top18.length < 2 && <p className="mt-2 text-center text-[11px] text-ink-500">Нужно минимум 2 игрока в зачёте</p>}
              </>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-2 font-display text-sm font-bold text-cream-100">Формула сезона</div>
            <div className="rounded-lg bg-ink-800/70 px-4 py-3 font-mono text-[11px] leading-relaxed text-gold-300/90">
              {scoringText(db.settings.defaultScoring)}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-ink-500">
              Сетка очков настраивается в каждом турнире при создании. Сезонные зачёты суммируют очки всех турниров сезона.
            </p>
            <div className="mt-3 flex items-center gap-2 text-ink-500">
              <SuitsRow size={12} />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em]">золотой туз</span>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={confirmFinal} onClose={() => setConfirmFinal(false)} title="Сформировать финал сезона?">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-300">
            Будет создан турнир «Финал сезона · {season.name}» на 18 мест.
            Участники топ-18 попадут в список автоматически с выполненным чекином и рассадкой «змейкой» по рейтингу.
          </p>
          <div className="rounded-lg border border-gold-500/30 bg-gold-500/8 px-4 py-3 text-sm text-cream-100">
            Очки финала <b className="text-gold-300">не начисляются</b> и не попадают в рейтинги.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmFinal(false)}>Отмена</Button>
            <Button className="flex-1" onClick={createFinal}><Trophy size={15} /> Сформировать</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
