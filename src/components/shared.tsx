import type { ReactNode } from "react";
import type { DB, BoardRow, Tournament, TournamentStatus, TournamentType, User } from "../types";
import {
  averageStack, breakRemainingMs, chipBreakdown, cx, fmtChips, fmtClock, fmtDateTime, fmtNum, fullName,
  levelRemainingMs, plural, remainingCount, TYPE_LABELS,
} from "../lib/formulas";
import { useNow } from "../lib/hooks";
import { Badge, Bar, Card } from "./ui";
import { CrownIcon, TrophyIcon } from "./icons";

/* ---------------- PageHeader ---------------- */

export function PageHeader({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.26em] text-gold-500">{kicker}</div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-cream-100 sm:text-3xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

/* ---------------- статусы ---------------- */

const STATUS_MAP: Record<TournamentStatus, { label: string; tone: "gold" | "felt" | "danger" | "ink" | "cream"; pulse?: boolean }> = {
  registration: { label: "Регистрация", tone: "cream" },
  active: { label: "В игре", tone: "felt", pulse: true },
  break: { label: "Перерыв", tone: "gold", pulse: true },
  paused: { label: "Пауза", tone: "danger" },
  finished: { label: "Завершён", tone: "ink" },
};

export function StatusBadge({ status }: { status: TournamentStatus }) {
  const s = STATUS_MAP[status];
  return <Badge tone={s.tone} dot={s.pulse}>{s.label}</Badge>;
}

export function TypeLabel({ type }: { type: TournamentType }) {
  return (
    <Badge tone={type === "bounty" ? "danger" : "ink"} title={TYPE_LABELS[type]}>
      {TYPE_LABELS[type]}
    </Badge>
  );
}

/* ---------------- живое табло турнира ---------------- */

export function LiveBoard({ t, db, compact }: { t: Tournament; db: DB; compact?: boolean }) {
  const now = useNow(1000);
  const lvl = t.levels[Math.min(t.currentLevel, t.levels.length - 1)];
  const running = ["active", "break", "paused"].includes(t.status);
  const remMs = t.status === "break" ? breakRemainingMs(t, now) : levelRemainingMs(t, now);
  const remaining = remainingCount(t);
  const total = chipBreakdown(t).total;

  return (
    <Card lift className={cx("overflow-hidden", running && "border-gold-500/35")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/70 bg-ink-800/60 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {running && <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-felt-300 shadow-[0_0_10px_rgba(84,181,134,0.8)]" />}
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold text-cream-100">{t.name}</div>
            <div className="text-[11px] text-ink-400">{running ? `${db.seasons.find((s) => s.id === t.seasonId)?.name ?? ""}` : fmtDateTime(t.date)}</div>
          </div>
        </div>
        <StatusBadge status={t.status} />
      </div>

      <div className={cx("grid gap-4 px-5 py-4", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
        {running && lvl && (
          <div className="col-span-2 sm:col-span-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              {t.status === "break" ? "до конца перерыва" : `блайнды · ур. ${t.currentLevel + 1}`}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cx("tabular font-mono text-3xl font-extrabold", remMs < 60000 && t.status === "active" ? "text-danger-400" : "text-gold-300")}>
                {t.status === "paused" ? "—:—" : fmtClock(remMs / 1000)}
              </span>
              <span className="tabular font-mono text-sm font-bold text-cream-100">{fmtNum(lvl.sb)}/{fmtNum(lvl.bb)}</span>
            </div>
          </div>
        )}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">в игре</div>
          <div className="tabular mt-1 font-mono text-3xl font-extrabold text-felt-300">
            {running ? remaining : t.registrations.filter((r) => r.status !== "refunded").length}
            <span className="text-base text-ink-500"> / {t.maxPlayers}</span>
          </div>
        </div>
        {running ? (
          <>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">фишек в банке</div>
              <div className="tabular mt-1 font-mono text-3xl font-extrabold text-cream-100">{fmtChips(total)}</div>
            </div>
            {!compact && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">ср. стек</div>
                <div className="tabular mt-1 font-mono text-3xl font-extrabold text-cream-100">{fmtChips(averageStack(t))}</div>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">старт</div>
              <div className="tabular mt-1 font-mono text-3xl font-extrabold text-cream-100">{fmtNum(t.startingChips)}</div>
            </div>
            {!compact && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">столов</div>
                <div className="tabular mt-1 font-mono text-3xl font-extrabold text-cream-100">{t.tables.length || "—"}</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-5 pb-4">
        <Bar
          value={running ? remaining : t.registrations.filter((r) => r.status !== "refunded").length}
          max={t.maxPlayers}
          tone={running ? "felt" : "gold"}
        />
      </div>
    </Card>
  );
}

/* ---------------- лидерборд ---------------- */

export function Leaderboard({ rows, db, limit = 10, dense, highlightId }: {
  rows: BoardRow[]; db: DB; limit?: number; dense?: boolean; highlightId?: string;
}) {
  if (rows.length === 0) {
    return <div className="rounded-lg border border-dashed border-ink-600 px-4 py-8 text-center text-xs text-ink-400">Рейтинг пуст — завершите первый турнир</div>;
  }
  return (
    <div className="space-y-1">
      {rows.slice(0, limit).map((r) => {
        const u = db.users.find((x) => x.id === r.userId);
        if (!u) return null;
        const me = r.userId === highlightId;
        return (
          <div
            key={r.userId}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-2.5 transition-colors",
              dense ? "py-1.5" : "py-2",
              r.rank === 1 ? "bg-gold-500/12" : me ? "bg-felt-500/10" : "hover:bg-ink-800/70",
            )}
          >
            <span className={cx(
              "tabular w-7 shrink-0 text-center font-mono text-sm font-extrabold",
              r.rank === 1 ? "text-gold-400" : r.rank === 2 ? "text-ink-200" : r.rank === 3 ? "text-[#c07a3d]" : "text-ink-500",
            )}>
              {r.rank <= 3 ? ["①", "②", "③"][r.rank - 1] : r.rank}
            </span>
            {r.rank === 1 && <TrophyIcon size={14} className="-ml-1 shrink-0 text-gold-400" />}
            <span className="relative inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold"
              style={{
                width: dense ? 26 : 30, height: dense ? 26 : 30, fontSize: dense ? 10 : 11,
                background: `linear-gradient(135deg, hsl(${u.hue} 42% 26%), hsl(${u.hue} 50% 16%))`,
                color: `hsl(${u.hue} 75% 74%)`,
              }}
            >
              {fullName(u).split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className={cx("block truncate text-sm font-semibold", me ? "text-gold-200" : "text-cream-100")}>{u.nickname}</span>
              {!dense && <span className="block truncate text-[11px] text-ink-400">{r.events} {plural(r.events, ["турнир", "турнира", "турниров"])} · {r.wins} {plural(r.wins, ["победа", "победы", "побед"])}</span>}
            </span>
            {r.rank === 1 && !dense && <CrownIcon size={15} className="shrink-0 text-gold-400" />}
            <span className={cx("tabular shrink-0 font-mono font-bold", dense ? "text-sm text-gold-300" : "text-base text-gold-300")}>{fmtNum(r.points)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- сортируемые заголовки таблиц ---------------- */

export type SortDir = 1 | -1;

export function SortHead({ label, k, sort, onSort, align = "left", title }: {
  label: string;
  k: string;
  sort: { k: string; dir: SortDir };
  onSort: (k: string) => void;
  align?: "left" | "center" | "right";
  title?: string;
}) {
  const active = sort.k === k;
  return (
    <button
      onClick={() => onSort(k)}
      title={title ?? `Сортировать: ${label}`}
      className={cx(
        "group inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        active ? "text-gold-300" : "text-ink-400 hover:text-cream-100",
      )}
    >
      {label}
      <span className={cx("font-mono text-[9px] leading-none transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-50")}>
        {active && sort.dir === -1 ? "▼" : "▲"}
      </span>
    </button>
  );
}

/** Универсальный переключатель направления сортировки. */
export function nextSort(sort: { k: string; dir: SortDir }, k: string): { k: string; dir: SortDir } {
  if (sort.k !== k) return { k, dir: -1 };
  return { k, dir: sort.dir === -1 ? 1 : -1 };
}
