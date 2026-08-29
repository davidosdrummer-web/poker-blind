import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Award, BarChart3, Bell, CalendarDays, CheckCircle2, LogOut, Moon, Sun, Trophy as TrophyLucide, UserRound, XCircle,
} from "lucide-react";
import { actions, unreadCount } from "../lib/store";
import { useAuth, useDB, usePresenceHeartbeat } from "../lib/hooks";
import type { DB, User } from "../types";
import { computeBoard, cx, fmtDateTime, fmtNum, fullName, itmRate, timeAgo } from "../lib/formulas";
import { Avatar, Badge, Bar, Button, Card, EmptyState, Field, Input, Reveal, SectionHead, Stat, Tabs, toast } from "../components/ui";
import { Leaderboard, PageHeader, StatusBadge } from "../components/shared";
import { Spade, SuitsRow, TrophyIcon, CrownIcon } from "../components/icons";
import { AchievementsTab, NoticesTab, RatingsTab, StatsTab } from "./playerStats";

const TABS = [
  { id: "overview", label: "Обзор", icon: UserRound },
  { id: "tournaments", label: "Турниры", icon: CalendarDays },
  { id: "stats", label: "Статистика", icon: BarChart3 },
  { id: "achievements", label: "Достижения", icon: Award },
  { id: "ratings", label: "Рейтинг", icon: TrophyLucide },
  { id: "notices", label: "Уведомления", icon: Bell },
];

export default function PlayerCabinet() {
  const db = useDB();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [light, setLight] = useState(() => sessionStorage.getItem("gt_theme") === "light");
  usePresenceHeartbeat(user);
  const unread = user ? unreadCount(db, user.id) : 0;

  if (!user) return null;

  const toggleTheme = () => {
    setLight((v) => {
      sessionStorage.setItem("gt_theme", v ? "dark" : "light");
      return !v;
    });
  };

  return (
    <div className={cx(light && "theme-light")}>
      <div className="bg-stage suit-pattern noise min-h-screen">
        <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-900/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold-500/40 bg-ink-800">
                <Spade size={18} className="text-gold-400" />
              </span>
              <span className="hidden font-display text-sm font-extrabold text-cream-100 sm:block">{db.settings.clubName.toUpperCase()}</span>
            </Link>

            <nav className="order-3 -mb-px flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto sm:flex-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cx(
                    "relative inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
                    tab === t.id ? "border-gold-500 text-gold-300" : "border-transparent text-ink-300 hover:text-cream-100",
                  )}
                >
                  <t.icon size={14} />
                  {t.label}
                  {t.id === "notices" && unread > 0 && (
                    <span className="tabular ml-0.5 rounded-full bg-danger-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cream-50">{unread}</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
              <button onClick={toggleTheme} className="rounded-lg border border-ink-600 p-2 text-ink-300 transition-colors hover:border-gold-500/50 hover:text-gold-300" title="Сменить тему">
                {light ? <Moon size={15} /> : <Sun size={15} />}
              </button>
              <Avatar name={fullName(user)} hue={user.hue} size={34} online />
              <button
                onClick={() => { actions.logout(); toast("До встречи за столом!", "info"); navigate("/"); }}
                className="rounded-lg border border-ink-600 p-2 text-ink-300 transition-colors hover:border-danger-500/50 hover:text-danger-300"
                title="Выйти"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-7">
          <div className="animate-rise" key={tab}>
            {tab === "overview" && <OverviewTab user={user} db={db} goto={setTab} />}
            {tab === "tournaments" && <TournamentsTab user={user} db={db} />}
            {tab === "stats" && <StatsTab user={user} db={db} />}
            {tab === "achievements" && <AchievementsTab user={user} />}
            {tab === "ratings" && <RatingsTab user={user} db={db} />}
            {tab === "notices" && <NoticesTab user={user} db={db} />}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ============================ ОБЗОР ============================ */

function OverviewTab({ user, db, goto }: { user: User; db: DB; goto: (t: string) => void }) {
  const [nick, setNick] = useState(user.nickname);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone);
  const season = db.seasons.find((s) => s.isActive);
  const board = useMemo(() => computeBoard(db, season?.id ?? null), [db, season]);
  const me = board.find((b) => b.userId === user.id);
  const leader = board[0];
  const leaderUser = leader ? db.users.find((u) => u.id === leader.userId) : null;
  const myTournaments = db.tournaments.filter((t) => t.registrations.some((r) => r.userId === user.id && r.status !== "refunded"));
  const upcoming = myTournaments.filter((t) => t.status === "registration");
  const history = db.tournaments
    .filter((t) => t.results?.some((r) => r.userId === user.id))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <Reveal>
        <Card className="shine-wrap overflow-hidden">
          <div className="felt-surface relative px-6 pb-16 pt-6">
            <SuitsRow size={16} className="absolute right-5 top-5 opacity-60" />
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-felt-200/80">личный кабинет</div>
            <div className="mt-1 font-display text-2xl font-extrabold text-cream-50">
              Добро пожаловать, {user.nickname}
            </div>
          </div>
          <div className="relative -mt-10 flex flex-wrap items-end gap-5 px-6 pb-5">
            <Avatar name={fullName(user)} hue={user.hue} size={84} online className="border-4 border-ink-850 shadow-2xl" />
            <div className="min-w-0 flex-1 pt-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-bold text-cream-100">{user.nickname}</span>
                <Badge tone="felt" dot>в сети</Badge>
                <Badge tone="ink">{user.email}</Badge>
              </div>
              <div className="text-sm text-ink-400">{fullName(user)} · в клубе с {new Date(user.registeredAt).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 pb-1 text-center">
              {[
                { v: me?.rank ? `#${me.rank}` : "—", l: "в сезоне" },
                { v: fmtNum(me?.points ?? 0), l: "очков" },
                { v: `${itmRate(user.stats)}%`, l: "ITM" },
              ].map((x) => (
                <div key={x.l}>
                  <div className="tabular font-mono text-xl font-bold text-gold-300">{x.v}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-400">{x.l}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Reveal delay={80}>
            <Card className="p-5">
              <SectionHead kicker="сезон" title={season?.name ?? "Рейтинг"} right={season ? <Badge tone="gold" dot>активен</Badge> : undefined} />
              {me ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-gold-500/30 bg-gold-500/8 px-4 py-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-ink-400">ваше место</div>
                      <div className="tabular font-mono text-3xl font-bold text-gold-300">#{me.rank}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-ink-400">очков</div>
                      <div className="tabular font-mono text-3xl font-bold text-cream-100">{fmtNum(me.points)}</div>
                    </div>
                  </div>
                  {leader && me.userId !== leader.userId && (
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs text-ink-400">
                        <span>до лидера — <b className="text-gold-300">{leaderUser?.nickname}</b></span>
                        <span className="font-mono">{fmtNum(leader.points - me.points)} очков</span>
                      </div>
                      <Bar value={me.points} max={leader.points} />
                    </div>
                  )}
                  <Leaderboard rows={board} db={db} highlightId={user.id} limit={5} dense />
                  <button onClick={() => goto("ratings")} className="text-xs font-semibold text-gold-500 hover:text-gold-300">Полный рейтинг →</button>
                </div>
              ) : (
                <EmptyState icon={<TrophyIcon size={28} />} title="Вы пока вне зачёта" text="Сыграйте первый турнир сезона — очки появятся автоматически." />
              )}
            </Card>
          </Reveal>

          <Reveal delay={140}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Турниров" value={fmtNum(user.stats.tournamentsPlayed)} />
              <Stat label="Побед" value={fmtNum(user.stats.wins)} tone="gold" icon={<TrophyIcon size={14} />} />
              <Stat label="Топ-3" value={fmtNum(user.stats.top3)} tone="gold" icon={<CrownIcon size={14} />} />
              <Stat label="Нокаутов" value={fmtNum(user.stats.knockouts)} tone="danger" />
            </div>
          </Reveal>
        </div>

        <div className="space-y-5">
          <Reveal delay={100}>
            <Card className="p-5">
              <SectionHead kicker="профиль" title="Мои данные" />
              <div className="space-y-3">
                <Field label="Никнейм"><Input value={nick} onChange={(e) => setNick(e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Имя"><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
                  <Field label="Фамилия"><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
                </div>
                <Field label="Телефон"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 ___ ___-__-__" /></Field>
                <Button
                  className="w-full"
                  onClick={() => {
                    const err = actions.updateProfile(user.id, { nickname: nick, firstName, lastName, phone });
                    toast(err ?? "Профиль обновлён", err ? "err" : "ok");
                  }}
                >
                  Сохранить профиль
                </Button>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={160}>
            <Card className="p-5">
              <SectionHead kicker="скоро" title="Мои турниры" right={<button onClick={() => goto("tournaments")} className="text-xs font-semibold text-gold-500 hover:text-gold-300">все →</button>} />
              {upcoming.length === 0 && history.length === 0 && (
                <EmptyState title="Записей нет" text="Открытые турниры — во вкладке «Турниры»." />
              )}
              <div className="space-y-2">
                {upcoming.slice(0, 3).map((t) => {
                  const reg = t.registrations.find((r) => r.userId === user.id);
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-ink-800/60 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-cream-100">{t.name}</div>
                        <div className="text-[11px] text-ink-400">{fmtDateTime(t.date)}</div>
                      </div>
                      <Badge tone={reg?.status === "checked-in" ? "felt" : "ink"}>{reg?.status === "checked-in" ? "чекин ✓" : "записан"}</Badge>
                    </div>
                  );
                })}
                {history.map((t) => {
                  const r = t.results!.find((x) => x.userId === user.id)!;
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-ink-800/60 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-cream-100">{t.name}</div>
                        <div className="text-[11px] text-ink-400">{timeAgo(new Date(t.date).getTime())}</div>
                      </div>
                      <span className="flex items-center gap-2">
                        <Badge tone={r.place === 1 ? "gold" : r.place <= 3 ? "felt" : "ink"}>#{r.place}</Badge>
                        <span className="tabular font-mono text-sm font-bold text-gold-300">+{fmtNum(r.points)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/* ============================ ТУРНИРЫ ============================ */

function TournamentsTab({ user, db }: { user: User; db: DB }) {
  const open = db.tournaments.filter((t) => t.status === "registration" && t.regOpen);
  const mine = db.tournaments.filter((t) => t.registrations.some((r) => r.userId === user.id && r.status !== "refunded") && t.status === "registration");
  const history = db.tournaments.filter((t) => t.results?.some((r) => r.userId === user.id));

  const register = (tId: string, name: string) => {
    const err = actions.addRegistration(tId, user.id);
    if (err) { toast(err, "err"); return; }
    actions.pushNotice(user.id, `Вы записаны на «${name}» — не забудьте чекин до старта`, "info");
    toast(`Вы в списке «${name}»`);
  };

  return (
    <div className="space-y-6">
      <div>
        <PageHeader kicker="запись открыта" title="Турниры клуба" />
        {open.length === 0 && <EmptyState title="Открытых турниров нет" text="Загляните позже — расписание обновляет оператор." />}
        <div className="grid gap-4 md:grid-cols-2">
          {open.map((t) => {
            const regs = t.registrations.filter((r) => r.status !== "refunded").length;
            const myReg = t.registrations.find((r) => r.userId === user.id && r.status !== "refunded");
            const season = db.seasons.find((s) => s.id === t.seasonId);
            return (
              <Card key={t.id} lift className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-cream-100">{t.name}</h3>
                    <div className="mt-0.5 text-xs text-ink-400">{fmtDateTime(t.date)} · {season?.name}</div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mt-3">
                  <div className="mb-1.5 flex justify-between text-xs text-ink-400">
                    <span>мест занято</span><span className="font-mono text-cream-100">{regs} / {t.maxPlayers}</span>
                  </div>
                  <Bar value={regs} max={t.maxPlayers} tone="felt" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="cream">{fmtNum(t.startingChips)} фишек</Badge>
                  <Badge tone="ink">{t.levels.length} уровней</Badge>
                  {t.lateRegMinutes > 0 && <Badge tone="gold">поздняя рег. {t.lateRegMinutes} мин</Badge>}
                  {t.type === "bounty" && <Badge tone="danger">баунти</Badge>}
                </div>
                <div className="mt-4 border-t border-ink-700/70 pt-4">
                  {!myReg ? (
                    <Button className="w-full" disabled={regs >= t.maxPlayers} onClick={() => register(t.id, t.name)}>
                      {regs >= t.maxPlayers ? "Мест нет" : "Записаться"}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      {myReg.status === "registered" ? (
                        <Button variant="felt" className="flex-1" onClick={() => { actions.toggleCheckIn(t.id, user.id); toast("Чекин выполнен — ждём за столом!"); }}>
                          <CheckCircle2 size={15} /> Отметить присутствие
                        </Button>
                      ) : (
                        <Badge tone="felt" className="flex-1 justify-center py-2.5 text-sm">Вы записаны · чекин ✓</Badge>
                      )}
                      <Button variant="ghost" onClick={() => { actions.removeRegistration(t.id, user.id); toast("Запись отменена", "info"); }} title="Отменить запись">
                        <XCircle size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {mine.length > 0 && (
        <Card className="p-5">
          <SectionHead kicker="мои предстоящие" title="Вы в списках" />
          <div className="space-y-2">
            {mine.map((t) => {
              const reg = t.registrations.find((r) => r.userId === user.id);
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-ink-800/60 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-cream-100">{t.name}</div>
                    <div className="text-[11px] text-ink-400">{fmtDateTime(t.date)}</div>
                  </div>
                  <Badge tone={reg?.status === "checked-in" ? "felt" : "ink"}>{reg?.status === "checked-in" ? "чекин выполнен" : "ожидает чекина"}</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <SectionHead kicker="архив игрока" title="История выступлений" />
        {history.length === 0 && <EmptyState icon={<TrophyIcon size={28} />} title="История пуста" text="Первый финал — впереди." />}
        <div className="space-y-1.5">
          {history.map((t) => {
            const r = t.results!.find((x) => x.userId === user.id)!;
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-ink-800/60">
                <Badge tone={r.place === 1 ? "gold" : r.place <= 3 ? "felt" : r.place <= 9 ? "cream" : "ink"} className="w-14 justify-center">#{r.place}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-cream-100">{t.name}</div>
                  <div className="text-[11px] text-ink-400">
                    {new Date(t.date).toLocaleDateString("ru-RU")} · из {t.results!.length}
                    {r.knockouts > 0 && <span className="text-danger-300"> · нокаутов: {r.knockouts}</span>}
                    {r.returns > 0 && <span className="text-gold-300"> · возвратов: {r.returns}</span>}
                  </div>
                </div>
                <span className="tabular font-mono text-sm font-bold text-gold-300">+{fmtNum(r.points)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
