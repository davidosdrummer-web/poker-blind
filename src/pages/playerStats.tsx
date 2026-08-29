import { useMemo, useState } from "react";
import { Bell, CheckCheck, TrendingUp } from "lucide-react";
import type { DB, User } from "../types";
import { avgPlace, computeBoard, cx, fmtNum, fullName, plural, timeAgo } from "../lib/formulas";
import { actions, noticesFor } from "../lib/store";
import { Badge, Button, Card, EmptyState, SectionHead, Stat, toast } from "../components/ui";
import { Leaderboard } from "../components/shared";
import {
  CardsIcon, CrownIcon, CrosshairIcon, FlameIcon, GemIcon, ShieldIcon, TableIcon, TrophyIcon,
} from "../components/icons";

const ACH_ICON: Record<string, typeof CardsIcon> = {
  cards: CardsIcon, trophy: TrophyIcon, table: TableIcon, crosshair: CrosshairIcon,
  shield: ShieldIcon, flame: FlameIcon, crown: CrownIcon, gem: GemIcon,
};

/* ============================ СТАТИСТИКА ============================ */

export function StatsTab({ user, db }: { user: User; db: DB }) {
  const s = user.stats;
  const history = useMemo(() => {
    const rows: Array<{ t: string; place: number; points: number; date: string }> = [];
    for (const t of db.tournaments) {
      const r = t.results?.find((x) => x.userId === user.id);
      if (r) rows.push({ t: t.name, place: r.place, points: r.points, date: t.date });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
  }, [db.tournaments, user.id]);
  const maxPlace = Math.max(...history.map((h) => h.place), 10);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Турниров" value={fmtNum(s.tournamentsPlayed)} icon={<CardsIcon size={15} />} hint="Турниры с опубликованными итогами" />
        <Stat label="Побед" value={fmtNum(s.wins)} tone="gold" icon={<TrophyIcon size={15} />} hint="Занятые первые места" />
        <Stat label="Топ-3" value={fmtNum(s.top3)} tone="gold" icon={<CrownIcon size={15} />} hint="Финиши на пьедестале" />
        <Stat label="Финальных столов" value={fmtNum(s.finalTables)} icon={<TableIcon size={15} />} hint="Финиши в топ-9" />
        <Stat label="Нокаутов" value={fmtNum(s.knockouts)} tone="danger" icon={<CrosshairIcon size={15} />} hint="Игроков, которых вы выбили" />
        <Stat label="Докупов" value={fmtNum(s.returns)} icon={<FlameIcon size={15} />} hint="Возвращений в игру: ре-ентри и ласт-шансы" />
        <Stat label="Лучший результат" value={fmtNum(s.bestPoints)} tone="gold" icon={<GemIcon size={15} />} hint="Максимум очков за один турнир" />
        <Stat label="Попаданий в призы" value={fmtNum(s.inMoney)} tone="felt" icon={<TrendingUp size={15} />} hint="Финиши в призовой зоне (~топ-15%)" />
        <Stat label="Среднее место" value={avgPlace(s) ? avgPlace(s).toFixed(1) : "—"} icon={<span className="font-mono text-xs">№</span>} hint="Чем меньше — тем стабильнее игра" />
        <Stat label="Лучшее место" value={s.bestPlace ? `#${s.bestPlace}` : "—"} tone="gold" icon={<CrownIcon size={15} />} hint="Самый высокий финиш" />
        <Stat label="Ребаев и аддонов" value={fmtNum(s.rebuys)} icon={<FlameIcon size={15} />} hint="Докупки фишек без вылета" />
      </div>

      <Card className="p-5">
        <SectionHead kicker="динамика" title="Последние 10 турниров" right={<Badge tone="ink">место · ниже — лучше</Badge>} />
        {history.length === 0 ? (
          <EmptyState icon={<CardsIcon size={30} />} title="Вы ещё не играли в зачёт" text="Запишитесь на турнир во вкладке «Турниры» — после финала здесь появится статистика." />
        ) : (
          <>
            <div className="flex h-44 items-end gap-2.5">
              {history.map((h, i) => {
                const height = Math.max(10, 100 - ((h.place - 1) / maxPlace) * 88);
                const gold = h.place === 1;
                const top3 = h.place <= 3;
                return (
                  <div key={i} className="group flex flex-1 flex-col items-center gap-1.5" title={`${h.t}: ${h.place} место, ${h.points} очков`}>
                    <span className={cx("tabular font-mono text-[11px] font-bold transition-colors", gold ? "text-gold-400" : top3 ? "text-felt-300" : "text-ink-400")}>
                      {h.place}
                    </span>
                    <div
                      className={cx(
                        "w-full max-w-[46px] rounded-t-md transition-all duration-500 group-hover:opacity-100",
                        gold ? "bg-gradient-to-t from-gold-600 to-gold-400" : top3 ? "bg-gradient-to-t from-felt-600 to-felt-400" : "bg-ink-600 group-hover:bg-ink-500",
                      )}
                      style={{ height: `${height}%`, opacity: 0.85 }}
                    />
                    <span className="w-full truncate text-center text-[9px] text-ink-500">#{i + 1}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-ink-700 pt-3">
              {[...history].reverse().map((h, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm hover:bg-ink-800/60">
                  <Badge tone={h.place === 1 ? "gold" : h.place <= 3 ? "felt" : "ink"} className="w-14 justify-center">#{h.place}</Badge>
                  <span className="min-w-0 flex-1 truncate text-cream-100">{h.t}</span>
                  <span className="hidden font-mono text-[11px] text-ink-500 sm:block">{new Date(h.date).toLocaleDateString("ru-RU")}</span>
                  <span className="tabular font-mono text-sm font-bold text-gold-300">+{fmtNum(h.points)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ============================ ДОСТИЖЕНИЯ ============================ */

export function AchievementsTab({ user, db }: { user: User; db: DB }) {
  const defs = db.achievements;
  const earned = defs.filter((a) => user.achievements.includes(a.id)).length;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold text-cream-100">Витрина наград</div>
          <div className="text-sm text-ink-400">
            открыто <b className="font-mono text-gold-300">{earned}</b> из {defs.length} — достижения выдаются автоматически после турниров
          </div>
        </div>
        <Badge tone="gold" className="px-3 py-1.5"><CrownIcon size={12} /> {defs.length ? Math.round((earned / defs.length) * 100) : 0}%</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {defs.map((a, i) => {
          const has = user.achievements.includes(a.id);
          const Icon = ACH_ICON[a.icon] ?? CardsIcon;
          return (
            <div
              key={a.id}
              className={cx(
                "card-lift relative flex flex-col items-center rounded-xl border p-5 text-center",
                has ? "shine-wrap border-gold-500/45 bg-gradient-to-b from-gold-500/12 to-ink-850" : "border-ink-700 bg-ink-850/60 opacity-70",
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className={cx(
                "flex h-14 w-14 items-center justify-center rounded-full border-2",
                has ? "animate-pop border-gold-400 bg-gold-500/15 text-gold-300 shadow-[0_0_24px_rgba(212,160,23,0.35)]" : "border-ink-600 bg-ink-800 text-ink-500",
              )}>
                <Icon size={24} />
              </span>
              <div className={cx("mt-3 font-display text-sm font-bold", has ? "text-cream-100" : "text-ink-300")}>{a.name}</div>
              <div className="mt-1 text-xs leading-snug text-ink-400">{a.description}</div>
              {!has && <Badge tone="ink" className="mt-2.5">закрыто</Badge>}
              {has && <Badge tone="gold" className="mt-2.5">получено</Badge>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ РЕЙТИНГ ============================ */

export function RatingsTab({ user, db }: { user: User; db: DB }) {
  const season = db.seasons.find((s) => s.isActive);
  const [scope, setScope] = useState("season");
  const board = useMemo(
    () => computeBoard(db, scope === "season" ? season?.id ?? null : null),
    [db, scope, season],
  );
  const me = board.find((b) => b.userId === user.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-ink-600 p-1">
          {[["season", "Текущий сезон"], ["all", "За всё время"]].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setScope(v)}
              className={cx("rounded-md px-3.5 py-1.5 text-sm font-semibold transition-all", scope === v ? "bg-gold-500 text-ink-950" : "text-ink-300 hover:text-cream-100")}
            >
              {label}
            </button>
          ))}
        </div>
        {me ? (
          <Badge tone="gold" className="px-3 py-1.5 text-xs">ваше место: <b className="font-mono">#{me.rank}</b> · {fmtNum(me.points)} очков</Badge>
        ) : (
          <Badge tone="ink" className="px-3 py-1.5 text-xs">вы пока вне зачёта</Badge>
        )}
      </div>

      <Card className="p-5">
        <SectionHead
          kicker={scope === "season" ? season?.name ?? "сезон" : "клубный зачёт"}
          title="Топ-20"
          right={<TrophyIcon size={18} className="text-gold-400" />}
        />
        <Leaderboard rows={board} db={db} highlightId={user.id} limit={20} />
      </Card>
    </div>
  );
}

/* ============================ УВЕДОМЛЕНИЯ ============================ */

export function NoticesTab({ user, db }: { user: User; db: DB }) {
  const list = noticesFor(db, user.id);
  const marker = db.readMarkers[user.id] ?? 0;
  const unread = list.filter((n) => n.at > marker).length;

  return (
    <Card className="p-5">
      <SectionHead
        kicker="оповещения"
        title="Уведомления"
        right={
          unread > 0 ? (
            <Button size="sm" variant="dark" onClick={() => { actions.markNoticesRead(user.id); toast("Отмечено прочитанным", "info"); }}>
              <CheckCheck size={14} /> Прочитать всё ({unread})
            </Button>
          ) : <Bell size={16} className="text-ink-500" />
        }
      />
      {list.length === 0 && <EmptyState icon={<Bell size={28} />} title="Тишина" text="Здесь появятся записи на турниры, достижения и анонсы клуба." />}
      <div className="space-y-2">
        {list.map((n) => {
          const isUnread = n.at > marker;
          return (
            <div key={n.id} className={cx(
              "flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
              isUnread ? "border-gold-500/35 bg-gold-500/6" : "border-ink-700/70 bg-ink-800/50",
            )}>
              <span className={cx(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                n.kind === "win" ? "bg-gold-400" : n.kind === "alert" ? "bg-danger-400" : "bg-felt-300",
              )} />
              <div className="min-w-0 flex-1">
                <div className={cx("text-sm leading-snug", isUnread ? "text-cream-100" : "text-ink-300")}>{n.text}</div>
                <div className="mt-0.5 text-[11px] text-ink-500">
                  {n.userId === "all" ? "весь клуб" : "лично вам"} · {timeAgo(n.at)}
                </div>
              </div>
              {n.kind === "win" && <CrownIcon size={15} className="mt-0.5 shrink-0 text-gold-400" />}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-ink-500">
        {list.length} {plural(list.length, ["уведомление", "уведомления", "уведомлений"])} — старты турниров и изменения расписания приходят автоматически
      </p>
    </Card>
  );
}
