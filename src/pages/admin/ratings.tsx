import { useMemo, useState } from "react";
import { BarChart3, CrownIcon } from "lucide-react";
import { useDB } from "../../lib/hooks";
import { computeBoard, cx, fmtNum, fullName } from "../../lib/formulas";
import { Avatar, Badge, Card, EmptyState, toast } from "../../components/ui";
import { PageHeader } from "../../components/shared";

export default function RatingsPage() {
  const db = useDB();
  const [scope, setScope] = useState<string>("global");
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: "points", dir: -1 });

  const seasonId = scope === "global" ? null : scope;
  const board = useMemo(() => computeBoard(db, seasonId), [db, seasonId]);
  const scopeName = scope === "global" ? "Глобальный рейтинг" : db.seasons.find((s) => s.id === scope)?.name ?? "Сезон";

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
  }, [board, sort, db.users]);

  const exportCsv = () => {
    const head = "Место;Никнейм;Имя Фамилия;Очки;Игр;Побед;Топ-3;Финалок;Лучший;Выбил;Докупов";
    const rows = board.map((r) => {
      const u = db.users.find((x) => x.id === r.userId);
      return [r.rank, u?.nickname ?? "", u ? fullName(u) : "", r.points, r.events, r.wins, r.top3, r.finalTables, r.bestPoints, r.knockouts, r.returns].join(";");
    });
    const blob = new Blob([`${head}\n${rows.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rating_${scope}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Рейтинг выгружен в CSV", "info");
  };

  return (
    <div>
      <PageHeader kicker="зачёты клуба" title="Рейтинг">
        <Badge tone="ink">{board.length} в зачёте</Badge>
        <button onClick={exportCsv} className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-ink-600 px-3.5 text-sm font-bold text-ink-200 transition-all hover:border-gold-500/60 hover:text-gold-300">
          <BarChart3 size={14} /> CSV
        </button>
      </PageHeader>

      {/* переключатель зачётов */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setScope("global")}
          className={cx(
            "rounded-full border px-4 py-2 text-sm font-bold transition-all",
            scope === "global" ? "border-gold-500/70 bg-gold-500/15 text-gold-300" : "border-ink-600 text-ink-300 hover:border-ink-400 hover:text-cream-100",
          )}
        >
          Глобальный
        </button>
        {db.seasons.map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={cx(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-all",
              scope === s.id ? "border-gold-500/70 bg-gold-500/15 text-gold-300" : "border-ink-600 text-ink-300 hover:border-ink-400 hover:text-cream-100",
              s.archived && "opacity-60",
            )}
          >
            {s.isActive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-felt-300" />}
            {s.name}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 bg-ink-800/70 px-5 py-3">
          <span className="font-display text-sm font-bold text-cream-100">{scopeName}</span>
          <span className="font-mono text-[11px] text-ink-500">
            вся статистика накапливается из итогов прошедших турниров{scope === "global" ? " · включая ручные начисления" : ""}
          </span>
        </div>

        {board.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<CrownIcon size={30} />} title="Зачёт пуст" text="Завершите первый турнир — места, очки и вся статистика появятся здесь автоматически." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left">
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-400">Место</th>
                  <th className="px-3 py-2.5"><SortHead label="Никнейм" k="nick" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} /></th>
                  <th className="px-3 py-2.5"><SortHead label="Имя Фамилия" k="name" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHead label="Очки" k="points" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="right" /></th>
                  <th className="px-3 py-2.5 text-center"><SortHead label="Игр" k="events" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="center" /></th>
                  <th className="px-3 py-2.5 text-center"><SortHead label="Побед" k="wins" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="center" /></th>
                  <th className="px-3 py-2.5 text-center"><SortHead label="Топ-3" k="top3" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="center" /></th>
                  <th className="px-3 py-2.5 text-center"><SortHead label="Финалок" k="finalTables" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="center" /></th>
                  <th className="px-3 py-2.5 text-right"><SortHead label="Лучший" k="bestPoints" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="right" title="Лучший результат очков за один турнир" /></th>
                  <th className="px-3 py-2.5 text-center"><SortHead label="Выбил" k="knockouts" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="center" title="Сколько игроков выбил" /></th>
                  <th className="px-4 py-2.5 text-center"><SortHead label="Докупов" k="returns" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} align="center" title="Сколько раз делал докупы (возвращения)" /></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const u = db.users.find((x) => x.id === r.userId);
                  if (!u) return null;
                  return (
                    <tr key={r.userId} className={cx(
                      "border-b border-ink-700/40 transition-colors last:border-0 hover:bg-ink-800/60",
                      r.rank === 1 && "bg-gold-500/8",
                    )}>
                      <td className="px-4 py-2.5">
                        <span className={cx(
                          "tabular mx-auto flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-extrabold",
                          r.rank === 1 ? "bg-gold-500 text-ink-950" : r.rank === 2 ? "bg-ink-500 text-cream-50" : r.rank === 3 ? "bg-[#8a5a2b] text-cream-50" : "text-ink-400",
                        )}>
                          {r.rank}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={fullName(u)} hue={u.hue} size={28} />
                          <span className="font-bold text-cream-100">{u.nickname}</span>
                          {r.rank === 1 && <CrownIcon size={14} className="text-gold-400" />}
                          {r.manualPoints > 0 && scope === "global" && (
                            <span className="font-mono text-[10px] text-gold-500" title="Очки, начисленные администратором">+{fmtNum(r.manualPoints)}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-ink-300">{fullName(u)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono text-base font-extrabold text-gold-300">{fmtNum(r.points)}</td>
                      <td className="tabular px-3 py-2.5 text-center font-mono text-ink-200">{r.events}</td>
                      <td className={cx("tabular px-3 py-2.5 text-center font-mono font-bold", r.wins > 0 ? "text-gold-300" : "text-ink-400")}>{r.wins}</td>
                      <td className="tabular px-3 py-2.5 text-center font-mono text-ink-200">{r.top3}</td>
                      <td className="tabular px-3 py-2.5 text-center font-mono text-ink-200">{r.finalTables}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono text-felt-300">{fmtNum(r.bestPoints)}</td>
                      <td className={cx("tabular px-3 py-2.5 text-center font-mono", r.knockouts > 0 ? "text-danger-300" : "text-ink-400")}>{r.knockouts}</td>
                      <td className="tabular px-4 py-2.5 text-center font-mono text-ink-200">{r.returns}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-center text-[11px] text-ink-500">
        Кликните по заголовку столбца, чтобы отсортировать · вся статистика накапливается из итогов турниров
      </p>
    </div>
  );
}

/* ---------------- сортировка ---------------- */

export interface SortState { k: string; dir: 1 | -1 }

export function nextSort(cur: SortState, k: string): SortState {
  if (cur.k !== k) return { k, dir: -1 };
  return { k, dir: cur.dir === -1 ? 1 : -1 };
}

export function SortHead({ label, k, sort, onSort, align = "left", title }: {
  label: string; k: string; sort: SortState;
  onSort: (k: string) => void; align?: "left" | "right" | "center"; title?: string;
}) {
  const active = sort.k === k;
  return (
    <button
      onClick={() => onSort(k)}
      title={title ?? `Сортировать: ${label.toLowerCase()}`}
      className={cx(
        "group inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
        align === "right" && "flex-row-reverse",
        align === "center" && "mx-auto",
        active ? "text-gold-300" : "text-ink-400 hover:text-cream-100",
      )}
    >
      {label}
      <span className={cx("font-mono text-[9px] transition-all", active ? "opacity-100" : "opacity-0 group-hover:opacity-50")}>
        {active && sort.dir === 1 ? "▲" : "▼"}
      </span>
    </button>
  );
}
