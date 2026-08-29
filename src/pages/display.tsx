import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Maximize2 } from "lucide-react";
import { useDB, useNow } from "../lib/hooks";
import { liveTournament, REBUY_LABELS } from "../lib/store";
import type { DB, Tournament } from "../types";
import {
  averageStack, breakRemainingMs, chipBreakdown, cx, fmtChips, fmtClock, fmtNum,
  fullName, levelDurationMs, levelRemainingMs, plural, remainingCount, seatedPlayers,
} from "../lib/formulas";
import { CrownIcon, SuitsRow } from "../components/icons";

const SEAT_POS: Array<[number, number]> = [
  [50, 5], [80, 12], [96, 36], [92, 68], [68, 90], [32, 90], [8, 68], [4, 36], [20, 12],
];

function useFullscreen() {
  const [fs, setFs] = useState(false);
  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setFs(true)).catch(() => undefined);
    } else {
      document.exitFullscreen?.().then(() => setFs(false)).catch(() => undefined);
    }
  };
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  return { fs, toggle };
}

export default function DisplayShell() {
  const { mode } = useParams();
  const [params] = useSearchParams();
  const db = useDB();
  const { toggle } = useFullscreen();

  const t = useMemo(() => {
    const id = params.get("t");
    if (id) return db.tournaments.find((x) => x.id === id);
    if (mode === "results") {
      return db.tournaments.find((x) => x.results) ?? liveTournament(db);
    }
    return liveTournament(db) ?? db.tournaments.find((x) => x.status === "registration");
  }, [db, params, mode]);

  const tickerItems = useMemo(() => {
    const items: string[] = [];
    if (t) {
      if (mode !== "results") items.push(`${t.name} · уровень ${t.currentLevel + 1}`);
      [...t.knockouts].slice(-3).reverse().forEach((k) => {
        const a = db.users.find((u) => u.id === k.killerId)?.nickname;
        const b = db.users.find((u) => u.id === k.userId)?.nickname;
        items.push(a ? `Нокаут: ${a} выбил ${b}` : `${b} покидает турнир`);
      });
      [...t.rebuys].slice(-2).reverse().forEach((r) => {
        const n = db.users.find((u) => u.id === r.userId)?.nickname;
        items.push(`${n} — ${REBUY_LABELS[r.kind]}`);
      });
      [...t.bonuses].slice(-2).reverse().forEach((b) => {
        const n = db.users.find((u) => u.id === b.userId)?.nickname;
        items.push(`Бонус «${b.name}»: ${n} +${fmtNum(b.chips)}`);
      });
    }
    const season = db.seasons.find((s) => s.isActive);
    if (season) items.push(season.name);
    items.push(db.settings.tagline);
    return items;
  }, [db, t, mode]);

  return (
    <div className="tv-vignette suit-pattern relative flex h-screen flex-col overflow-hidden bg-ink-950 text-cream-100">
      {/* верхняя панель */}
      <header className="relative z-10 flex items-center justify-between border-b border-ink-800/80 bg-ink-900/70 px-6 py-3 backdrop-blur sm:px-10">
        <div className="flex items-center gap-3">
          <SuitsRow size={15} />
          <span className="font-display text-base font-extrabold tracking-wide text-cream-100">{db.settings.clubName.toUpperCase()}</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-gold-500 sm:block">
            {mode === "final" ? "финальный стол" : mode === "results" ? "результаты" : "live"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Clock />
          <nav className="hidden items-center gap-1 rounded-lg border border-ink-700 bg-ink-800/70 p-1 lg:flex">
            {[["main", "Главный"], ["final", "Финал"], ["results", "Итоги"]].map(([m, label]) => (
              <Link key={m} to={`/display/${m}${t ? `?t=${t.id}` : ""}`}
                className={cx("rounded-md px-3 py-1 text-xs font-bold transition-all", mode === m ? "bg-gold-500 text-ink-950" : "text-ink-300 hover:text-cream-100")}
              >
                {label}
              </Link>
            ))}
          </nav>
          <button onClick={toggle} className="rounded-lg border border-ink-600 p-2 text-ink-300 transition-colors hover:border-gold-500/60 hover:text-gold-300" title="Во весь экран">
            <Maximize2 size={16} />
          </button>
        </div>
      </header>

      {!t ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
          <CrownIcon size={44} className="text-gold-500/70" />
          <div className="font-display text-2xl font-bold text-cream-100">Турнир скоро начнётся</div>
          <div className="text-sm text-ink-400">Экран обновится автоматически, когда оператор запустит игру</div>
        </div>
      ) : mode === "final" ? (
        <FinalScreen db={db} t={t} />
      ) : mode === "results" ? (
        <ResultsScreen db={db} t={t} />
      ) : (
        <MainScreen db={db} t={t} />
      )}

      {/* бегущая строка */}
      <footer className="relative z-10 overflow-hidden border-t border-gold-500/25 bg-ink-900/85 py-2.5 backdrop-blur">
        <div className="animate-marquee flex w-max items-center gap-10 whitespace-nowrap">
          {[...tickerItems, ...tickerItems].map((x, i) => (
            <span key={i} className="flex items-center gap-3 text-sm font-semibold text-cream-100/90">
              <span className="h-1.5 w-1.5 rotate-45 bg-gold-500" />{x}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}

function Clock() {
  const now = useNow(1000);
  return (
    <span className="tabular font-mono text-sm font-bold text-gold-300">
      {new Date(now).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

/* ---------------- главный экран ---------------- */

function MainScreen({ db, t }: { db: DB; t: Tournament }) {
  const now = useNow(500);
  const lvl = t.levels[Math.min(t.currentLevel, t.levels.length - 1)];
  const isBreak = t.status === "break";
  const remMs = isBreak ? breakRemainingMs(t, now) : levelRemainingMs(t, now);
  const dur = levelDurationMs(t);
  const ratio = isBreak ? remMs / Math.max(1, (t.breakEndsAt ?? now + dur) - (now - (dur - remMs))) : remMs / dur;
  void ratio;
  const bd = chipBreakdown(t);
  const remaining = remainingCount(t);
  const avg = averageStack(t);
  const recent = [...t.knockouts].slice(-4).reverse();
  const nextLvl = t.levels[t.currentLevel + 1];

  if (t.status === "registration") {
    const regs = t.registrations.filter((r) => r.status !== "refunded").length;
    return (
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        <div className="font-mono text-xs uppercase tracking-[0.4em] text-gold-500">идёт регистрация</div>
        <div className="font-display text-[min(6vw,64px)] font-extrabold leading-tight text-cream-50">{t.name}</div>
        <div className="tabular font-mono text-2xl text-felt-300">{regs} / {t.maxPlayers} игроков</div>
        <div className="text-lg text-ink-300">
          Старт: {new Date(t.date).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          {" · "}стек {fmtNum(t.startingChips)}
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 grid flex-1 gap-6 overflow-hidden px-6 py-6 sm:px-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col items-center justify-center gap-6">
        {isBreak ? (
          <div className="text-center">
            <div className="font-mono text-xs uppercase tracking-[0.4em] text-gold-500">перерыв</div>
            <div className="tabular mt-2 font-mono text-[min(16vw,150px)] font-extrabold leading-none text-gold-300">
              {fmtClock(remMs / 1000)}
            </div>
            <div className="mt-3 text-lg text-ink-300">игра возобновится автоматически</div>
          </div>
        ) : (
          <div className="text-center">
            <div className="font-mono text-xs uppercase tracking-[0.4em] text-gold-500">
              {t.status === "paused" ? "пауза" : `уровень ${t.currentLevel + 1} из ${t.levels.length}`}
            </div>
            <div className={cx("tabular mt-2 font-mono text-[min(16vw,150px)] font-extrabold leading-none", remMs < 60000 && t.status === "active" ? "timer-critical text-danger-400" : "text-cream-50")}>
              {t.status === "paused" ? "—:—" : fmtClock(remMs / 1000)}
            </div>
          </div>
        )}

        <div className="flex items-end gap-8">
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-400">блайнды</div>
            <div className="tabular font-mono text-[min(7vw,58px)] font-extrabold text-cream-100">
              {fmtNum(lvl.sb)} <span className="text-gold-400">/</span> {fmtNum(lvl.bb)}
            </div>
          </div>
          {lvl.ante > 0 && (
            <div className="text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-400">анте</div>
              <div className="tabular font-mono text-[min(4vw,36px)] font-bold text-gold-300">{fmtNum(lvl.ante)}</div>
            </div>
          )}
          {nextLvl && !isBreak && (
            <div className="text-center opacity-70">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-400">далее</div>
              <div className="tabular font-mono text-[min(4vw,30px)] font-bold text-ink-300">{fmtNum(nextLvl.sb)}/{fmtNum(nextLvl.bb)}</div>
            </div>
          )}
        </div>

        <div className="w-full max-w-md">
          <div className="h-2 overflow-hidden rounded-full bg-ink-700">
            <div
              className={cx("h-full rounded-full transition-all duration-1000 ease-linear", remMs < 60000 ? "bg-danger-500" : "bg-gradient-to-r from-gold-600 to-gold-400")}
              style={{ width: `${Math.max(0, Math.min(100, ((isBreak ? remMs : remMs) / (isBreak ? 15 * 60000 : dur)) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="hidden flex-col justify-center gap-4 lg:flex">
        {[
          { l: "в игре", v: String(remaining), s: `из ${t.registrations.length}`, cls: "text-felt-300" },
          { l: "фишек в игре", v: fmtChips(bd.total), s: `ср. стек ${fmtChips(avg)}`, cls: "text-cream-100" },
          { l: "нокауты", v: String(t.knockouts.length), s: "за вечер", cls: "text-danger-300" },
        ].map((x) => (
          <div key={x.l} className="rounded-xl border border-ink-700/80 bg-ink-900/60 px-6 py-4 backdrop-blur">
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">{x.l}</div>
            <div className="flex items-baseline gap-2.5">
              <span className={cx("tabular font-mono text-4xl font-extrabold", x.cls)}>{x.v}</span>
              <span className="text-xs text-ink-500">{x.s}</span>
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-ink-700/80 bg-ink-900/60 px-6 py-4 backdrop-blur">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">последние нокауты</div>
          {recent.length === 0 && <div className="text-sm text-ink-500">Пока без выбывших</div>}
          <div className="space-y-1.5">
            {recent.map((k, i) => {
              const a = db.users.find((u) => u.id === k.killerId)?.nickname ?? "блайнды";
              const b = db.users.find((u) => u.id === k.userId)?.nickname ?? "—";
              return (
                <div key={`${k.at}_${k.userId}`} className={cx("flex items-center justify-between text-sm", i === 0 && "animate-pop")}>
                  <span className="truncate text-cream-100"><b className="text-gold-300">{a}</b> → {b}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-500">ур. {k.level + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- финальный стол ---------------- */

function FinalScreen({ db, t }: { db: DB; t: Tournament }) {
  const now = useNow(500);
  const lvl = t.levels[Math.min(t.currentLevel, t.levels.length - 1)];
  const players = useMemo(() => seatedPlayers(t).slice(0, 9), [t]);
  const bd = chipBreakdown(t);
  const kosOf = (uidv: string) => t.knockouts.filter((k) => k.killerId === uidv).length;
  const retOf = (uidv: string) => t.rebuys.filter((r) => r.userId === uidv && (r.kind === "reentry" || r.kind === "lastchance")).length;

  return (
    <div className="relative z-10 grid flex-1 gap-6 overflow-hidden px-6 py-6 sm:px-10 lg:grid-cols-[1fr_330px]">
      <div className="relative flex items-center justify-center">
        <div className="felt-oval relative h-[min(62vh,560px)] w-full max-w-[880px] rounded-[50%]">
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <CrownIcon size={40} className="text-gold-400" />
            <div className="mt-2 font-display text-[min(4vw,34px)] font-extrabold uppercase tracking-wide text-cream-50">Финальный стол</div>
            <div className="mt-1 font-mono text-sm text-felt-200/80">{players.length} {plural(players.length, ["игрок", "игрока", "игроков"])}</div>
            <div className="mt-3 rounded-full border border-gold-500/40 bg-ink-950/60 px-4 py-1.5 font-mono text-sm text-gold-200">
              фишек в игре: <b className="tabular">{fmtChips(bd.total)}</b>
            </div>
          </div>

          {players.map((p, i) => {
            const [x, y] = SEAT_POS[i];
            const u = db.users.find((q) => q.id === p);
            const kos = kosOf(p);
            const ret = retOf(p);
            return (
              <div
                key={p}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink-500/70 bg-ink-900/85 px-3.5 py-2 text-center shadow-xl backdrop-blur-sm"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-ink-700 font-display text-sm font-bold text-cream-100">
                  {i + 1}
                </div>
                <div className="max-w-[120px] truncate text-sm font-bold text-cream-100">{u?.nickname ?? "—"}</div>
                <div className="mt-0.5 flex items-center justify-center gap-2 font-mono text-[10px]">
                  {kos > 0 && <span className="text-danger-300">KO {kos}</span>}
                  {ret > 0 && <span className="text-gold-300">RE {ret}</span>}
                  {kos === 0 && ret === 0 && <span className="text-felt-300/70">в игре</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden flex-col justify-center gap-4 lg:flex">
        <div className="rounded-xl border border-ink-700/80 bg-ink-900/60 px-6 py-4 backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">блайнды · ур. {t.currentLevel + 1}</div>
          <div className="tabular mt-1 font-mono text-4xl font-extrabold text-cream-100">
            {fmtNum(lvl.sb)} <span className="text-gold-400">/</span> {fmtNum(lvl.bb)}
          </div>
        </div>
        <div className="rounded-xl border border-ink-700/80 bg-ink-900/60 px-6 py-4 backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">таймер</div>
          <div className="tabular mt-1 font-mono text-4xl font-extrabold text-gold-300">
            {t.status === "break" ? fmtClock(breakRemainingMs(t, now) / 1000) : t.status === "paused" ? "—:—" : fmtClock(levelRemainingMs(t, now) / 1000)}
          </div>
        </div>
        <div className="rounded-xl border border-ink-700/80 bg-ink-900/60 px-6 py-4 backdrop-blur">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-400">состав</div>
          <div className="space-y-1">
            {players.map((p, i) => {
              const u = db.users.find((q) => q.id === p);
              return (
                <div key={p} className="flex items-center gap-2 text-sm">
                  <span className="tabular w-5 font-mono text-[11px] text-ink-500">{i + 1}</span>
                  <span className="truncate text-cream-100">{u?.nickname}</span>
                  <span className="ml-auto truncate pl-2 text-[11px] text-ink-500">{u ? fullName(u) : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- результаты ---------------- */

function ResultsScreen({ db, t }: { db: DB; t: Tournament }) {
  const results = t.results;
  const winner = results?.find((r) => r.place === 1);
  const winnerUser = winner ? db.users.find((u) => u.id === winner.userId) : null;
  const maxPts = results?.[0]?.points ?? 1;

  if (!results) {
    return (
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold text-cream-100">Итоги появятся после финала</div>
          <div className="mt-2 text-ink-400">Турнир «{t.name}» ещё идёт</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 grid flex-1 gap-6 overflow-hidden px-6 py-6 sm:px-10 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-gold-500/30 bg-gradient-to-b from-gold-500/12 to-transparent p-6 text-center">
        <CrownIcon size={54} className="animate-pop text-gold-400" />
        <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-gold-500">победитель</div>
        <div className="font-display text-4xl font-extrabold text-cream-50">{winnerUser?.nickname ?? "—"}</div>
        <div className="text-sm text-ink-300">{winnerUser ? fullName(winnerUser) : ""}</div>
        <div className="rounded-lg border border-gold-500/40 bg-ink-950/50 px-5 py-2.5">
          <span className="tabular font-mono text-3xl font-extrabold text-gold-300">{fmtNum(winner?.points ?? 0)}</span>
          <span className="ml-2 text-xs text-ink-400">очков</span>
        </div>
        <div className="mt-2 text-xs text-ink-400">{t.name}</div>
      </div>

      <div className="flex min-h-0 flex-col justify-center">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-gold-500">итоговый протокол</div>
        <div className="max-h-full space-y-1.5 overflow-hidden pr-2">
          {results.slice(0, 10).map((r) => {
            const u = db.users.find((x) => x.id === r.userId);
            return (
              <div key={r.userId} className={cx(
                "flex items-center gap-4 rounded-lg border px-4 py-2.5",
                r.place === 1 ? "border-gold-500/50 bg-gold-500/10" : "border-ink-700/60 bg-ink-900/50",
              )}>
                <span className={cx(
                  "tabular w-10 text-center font-mono text-lg font-extrabold",
                  r.place === 1 ? "text-gold-400" : r.place === 2 ? "text-ink-200" : r.place === 3 ? "text-[#c07a3d]" : "text-ink-500",
                )}>
                  {r.place}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold text-cream-100">{u?.nickname ?? "—"}</div>
                  <div className="truncate text-[11px] text-ink-500">{u ? fullName(u) : ""}{r.knockouts > 0 ? ` · нокаутов: ${r.knockouts}` : ""}</div>
                </div>
                <div className="hidden w-40 md:block">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400" style={{ width: `${(r.points / maxPts) * 100}%` }} />
                  </div>
                </div>
                <span className="tabular w-20 text-right font-mono text-xl font-extrabold text-gold-300">{fmtNum(r.points)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
