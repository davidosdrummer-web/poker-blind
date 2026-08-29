import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Coffee, ExternalLink, Flag, Gift, Minus, MonitorPlay,
  Pause, Pencil, Play, Plus, RotateCcw, TimerReset, Undo2, X,
} from "lucide-react";
import { actions, liveTournament, REBUY_LABELS } from "../../lib/store";
import { useDB, useHotkeys, useNow } from "../../lib/hooks";
import type { DB, RebuyKind, Tournament } from "../../types";
import {
  breakRemainingMs, chipBreakdown, cx, fmtChips, fmtClock, fmtNum,
  injectionChips, isLateRegOpen, lateRegRemainingMs, levelDurationMs, levelRemainingMs,
  seatedPlayers, timeAgo,
} from "../../lib/formulas";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Ring, Select, toast } from "../../components/ui";
import { PageHeader, StatusBadge } from "../../components/shared";
import { ChipIcon, CrosshairIcon } from "../../components/icons";

const RETURN_KINDS: Array<{ kind: RebuyKind; desc: string }> = [
  { kind: "rebuy", desc: "продолжение с новым стеком" },
  { kind: "addon", desc: "добавка фишек к стеку" },
  { kind: "reentry", desc: "возврат со стартовым стеком" },
  { kind: "lastchance", desc: "последний шанс, ¾ стека" },
];

export default function ConsolePage() {
  const db = useDB();
  const t = liveTournament(db);

  if (!t) {
    return (
      <div>
        <PageHeader kicker="пульт" title="Управление турниром" />
        <EmptyState
          icon={<TimerReset size={36} />}
          title="Сейчас турнир не идёт"
          text="В клубе одновременно проводится один турнир. Откройте запланированный на странице «Турниры» и запустите его."
        />
        <div className="mt-4 flex justify-center">
          <Link to="/admin/tournaments"><Button><Play size={15} /> К турнирам</Button></Link>
        </div>
      </div>
    );
  }
  return <LiveConsole t={t} db={db} />;
}

function LiveConsole({ t, db }: { t: Tournament; db: DB }) {
  const now = useNow(1000);
  const lvl = t.levels[Math.min(t.currentLevel, t.levels.length - 1)];
  const isBreak = t.status === "break";
  const remMs = isBreak ? breakRemainingMs(t, now) : levelRemainingMs(t, now);
  const ringRatio = isBreak ? remMs / (15 * 60000) : remMs / levelDurationMs(t);

  const seated = seatedPlayers(t);
  const remaining = seated.length;
  const participants = t.registrations.filter((r) => r.status !== "refunded");
  const bd = chipBreakdown(t);
  const lateOpen = isLateRegOpen(t, now);
  const lateRem = lateRegRemainingMs(t, now);

  const [breakMin, setBreakMin] = useState(15);
  const [modal, setModal] = useState<"" | "ko" | "bonus" | "finish">("");
  const [koVictim, setKoVictim] = useState("");
  const [koKiller, setKoKiller] = useState("");
  const [bnUser, setBnUser] = useState("");
  const [bnName, setBnName] = useState("");
  const [bnChips, setBnChips] = useState(5000);
  const [returnFor, setReturnFor] = useState<string | null>(null);

  const eliminated = useMemo(() => [...t.knockouts].reverse(), [t.knockouts]);
  const nick = (uidv: string | null) => (uidv ? db.users.find((u) => u.id === uidv)?.nickname ?? "—" : "блайнды");

  /* движок: автоповышение блайндов + выход с перерыва */
  useEffect(() => {
    if (t.status === "active" && t.levelStartedAt != null && levelRemainingMs(t, now) <= 0 && t.currentLevel < t.levels.length - 1) {
      const err = actions.nextLevel(t.id);
      if (err) toast(err, "err");
      else toast(`Уровень ${t.currentLevel + 2} — блайнды повышены`, "info");
    }
    if (t.status === "break" && t.breakEndsAt != null && now >= t.breakEndsAt) {
      actions.endBreak(t.id);
      toast("Перерыв завершён — игра продолжается");
    }
  }, [now, t.id, t.status, t.levelStartedAt, t.breakEndsAt, t.currentLevel, t.levels.length]);

  const togglePause = () => {
    if (t.status === "active") { actions.pauseTournament(t.id); toast("Таймер остановлен", "info"); }
    else if (t.status === "paused") { actions.resumeTournament(t.id); toast("Игра возобновлена"); }
  };

  useHotkeys({
    " ": togglePause,
    n: () => { const e = actions.nextLevel(t.id); if (e) toast(e, "err"); },
    p: () => actions.prevLevel(t.id),
    b: () => { if (t.status === "active") { actions.startBreak(t.id, breakMin); toast(`Перерыв ${breakMin} мин`, "info"); } },
  });

  const doReturn = (userId: string, kind: RebuyKind) => {
    const err = actions.addRebuy(t.id, userId, kind);
    if (err) { toast(err, "err"); return; }
    toast(`${nick(userId)}: ${REBUY_LABELS[kind]} — фишки в банке`);
    setReturnFor(null);
  };

  const events = useMemo(() => {
    const ko = t.knockouts.map((k) => ({ at: k.at, kind: "ko" as const, text: `${nick(k.killerId)} выбил ${nick(k.userId)}` }));
    const rb = t.rebuys.map((r) => ({ at: r.at, kind: "ret" as const, text: `${nick(r.userId)} — ${REBUY_LABELS[r.kind].toLowerCase()}` }));
    const bn = t.bonuses.map((b) => ({ at: b.at, kind: "bn" as const, text: `${nick(b.userId)} — бонус «${b.name}» +${fmtNum(b.chips)}` }));
    return [...ko, ...rb, ...bn].sort((a, b) => b.at - a.at).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.knockouts, t.rebuys, t.bonuses, db.users]);

  return (
    <div>
      <PageHeader kicker="пульт · живой турнир" title={t.name}>
        <StatusBadge status={t.status} />
        {(() => {
          const hasFinal = t.tables.some((tb) => tb.isFinal);
          if (hasFinal) return <Badge tone="gold" dot>финальный стол</Badge>;
          if (t.finalTableAt > 0) {
            return (
              <Badge tone="ink" title={`Финальный стол сформируется при ${t.finalTableAt} оставшихся игроках`}>
                финал: осталось {remaining} → {t.finalTableAt}
              </Badge>
            );
          }
          return null;
        })()}
        <div className={cx(
          "flex items-center gap-2 rounded-lg border px-3 py-1.5",
          lateOpen ? "border-gold-500/40 bg-gold-500/10" : "border-ink-700 bg-ink-850/70",
        )}>
          <RotateCcw size={13} className={lateOpen ? "text-gold-400" : "text-ink-500"} />
          <span className="text-xs text-ink-200">
            {lateOpen
              ? <>поздняя регистрация: <b className="tabular font-mono text-gold-300">{fmtClock(lateRem / 1000)}</b></>
              : "поздняя регистрация закрыта"}
          </span>
          <button onClick={() => { actions.adjustLateReg(t.id, 15); toast("Поздняя регистрация +15 мин", "info"); }} className="rounded-md bg-ink-700 px-2 py-0.5 font-mono text-[10px] font-bold text-cream-100 transition-colors hover:bg-gold-500 hover:text-ink-950">
            +15 мин
          </button>
          {lateOpen && (
            <button onClick={() => { actions.adjustLateReg(t.id, -99999); toast("Поздняя регистрация закрыта", "info"); }} className="rounded-md bg-ink-700 px-2 py-0.5 font-mono text-[10px] font-bold text-cream-100 transition-colors hover:bg-danger-500">
              закрыть
            </button>
          )}
        </div>
        <Link to={`/admin/tournaments/${t.id}`}><Button size="sm" variant="dark"><ExternalLink size={13} /> Состав и столы</Button></Link>
        <Link to={`/admin/tournaments/${t.id}/edit`}><Button size="sm" variant="outline"><Pencil size={13} /> Редактировать</Button></Link>
        <Link to={`/display/main?t=${t.id}`} target="_blank"><Button size="sm" variant="outline"><MonitorPlay size={13} /> ТВ</Button></Link>
      </PageHeader>

      {/* сводка */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { l: "фишек в игре", v: fmtChips(bd.total), c: "text-gold-300" },
          { l: "в игре", v: `${remaining} из ${participants.length}`, c: "text-felt-300" },
          { l: "нокауты", v: String(t.knockouts.length), c: "text-danger-300" },
          { l: "возвраты", v: String(t.rebuys.length), c: "text-cream-100" },
          { l: "бонусы", v: `${t.bonuses.length} · ${fmtChips(bd.bonusChips)}`, c: "text-gold-300" },
          { l: "уровень", v: `${t.currentLevel + 1}/${t.levels.length}`, c: "text-cream-100" },
        ].map((x) => (
          <div key={x.l} className="rounded-xl border border-ink-700 bg-ink-850/80 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">{x.l}</div>
            <div className={cx("tabular mt-1 truncate font-mono text-xl font-bold", x.c)}>{x.v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,440px)_1fr]">
        {/* таймер + управление */}
        <div className="space-y-5">
          <Card className="flex flex-col items-center p-6">
            <Ring ratio={t.status === "paused" ? 0.5 : Math.max(0.001, Math.min(1, ringRatio))} size={230} stroke={11} critical={remMs < 60000 && t.status === "active"}>
              <span className="tabular font-mono text-5xl font-bold text-cream-100">
                {t.status === "paused" ? "—:—" : fmtClock(remMs / 1000)}
              </span>
              <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ink-400">
                {isBreak ? "перерыв" : t.status === "paused" ? "пауза" : `уровень ${t.currentLevel + 1}/${t.levels.length}`}
              </span>
            </Ring>
            <div className="tabular mt-4 text-center font-mono">
              <span className="text-3xl font-bold text-cream-100">{fmtNum(lvl.sb)} / {fmtNum(lvl.bb)}</span>
              {lvl.ante > 0 && <span className="ml-2 text-lg text-gold-300">анте {fmtNum(lvl.ante)}</span>}
            </div>

            <div className="mt-5 grid w-full grid-cols-2 gap-2">
              {isBreak ? (
                <Button variant="felt" onClick={() => { actions.endBreak(t.id); toast("Перерыв завершён"); }}>
                  <Play size={15} /> С перерыва
                </Button>
              ) : (
                <Button variant={t.status === "paused" ? "felt" : "dark"} onClick={togglePause}>
                  {t.status === "paused" ? <><Play size={15} /> Продолжить</> : <><Pause size={15} /> Пауза</>}
                </Button>
              )}
              <div className="flex gap-2">
                <Select value={String(breakMin)} onChange={(e) => setBreakMin(Number(e.target.value))} className="w-[76px] px-2 text-xs">
                  {[10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} мин</option>)}
                </Select>
                <Button variant="outline" className="flex-1" disabled={isBreak} onClick={() => { actions.startBreak(t.id, breakMin); toast(`Перерыв ${breakMin} мин`, "info"); }}>
                  <Coffee size={14} /> Перерыв
                </Button>
              </div>
              <Button variant="dark" disabled={t.currentLevel === 0} onClick={() => actions.prevLevel(t.id)}>
                <ArrowLeft size={14} /> Пред. уровень
              </Button>
              <Button variant="dark" onClick={() => { const e = actions.nextLevel(t.id); if (e) toast(e, "err"); else toast(`Уровень ${t.currentLevel + 2}`, "info"); }}>
                След. уровень <ArrowRight size={14} />
              </Button>
              <Button variant="outline" onClick={() => { actions.adjustTimer(t.id, -60); toast("−1 минута", "info"); }}>
                <Minus size={14} /> 1 мин
              </Button>
              <Button variant="outline" onClick={() => { actions.adjustTimer(t.id, 60); toast("+1 минута", "info"); }}>
                <Plus size={14} /> 1 мин
              </Button>
            </div>

            <div className="mt-2.5 grid w-full grid-cols-3 gap-2">
              <Button variant="danger" onClick={() => { setKoVictim(seated[0] ?? ""); setKoKiller(""); setModal("ko"); }}>
                <CrosshairIcon size={15} /> Выбивание
              </Button>
              <Button onClick={() => { setBnUser(seated[0] ?? ""); setBnName(t.bonusDefs[0]?.name ?? "Чип-бонус"); setBnChips(t.bonusDefs[0]?.chips ?? Math.max(1000, lvl.bb * 10)); setModal("bonus"); }}>
                <Gift size={15} /> Бонус
              </Button>
              <Button variant="ghost" onClick={() => setModal("finish")}>
                <Flag size={15} /> Завершить
              </Button>
            </div>

            <div className="mt-3 text-center text-[11px] leading-relaxed text-ink-500">
              <kbd className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-cream-100">Space</kbd> пауза ·{" "}
              <kbd className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-cream-100">N</kbd> след. ·{" "}
              <kbd className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-cream-100">P</kbd> пред. ·{" "}
              <kbd className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-cream-100">B</kbd> перерыв
            </div>
          </Card>

          {/* структура блайндов */}
          <Card className="p-4">
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-500">структура блайндов</div>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {t.levels.slice(Math.max(0, t.currentLevel - 2), t.currentLevel + 6).map((l, i) => {
                const idx = Math.max(0, t.currentLevel - 2) + i;
                const cur = idx === t.currentLevel;
                const br = t.breaks.find((b) => b.afterLevel === idx);
                return (
                  <div key={idx}>
                    <button
                      onClick={() => { while (idx > t.currentLevel) { if (actions.nextLevel(t.id)) break; } while (idx < t.currentLevel) actions.prevLevel(t.id); }}
                      className={cx(
                        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-all",
                        cur ? "border-gold-500/60 bg-gold-500/12" : "border-transparent hover:bg-ink-800/70",
                      )}
                    >
                      <span className={cx("tabular w-6 font-mono text-[11px] font-bold", cur ? "text-gold-400" : "text-ink-500")}>{idx + 1}</span>
                      <span className={cx("tabular flex-1 font-mono text-sm font-semibold", cur ? "text-gold-200" : "text-cream-100")}>
                        {fmtNum(l.sb)}/{fmtNum(l.bb)}{l.ante > 0 && <span className="ml-2 text-[11px] text-gold-300">A{fmtNum(l.ante)}</span>}
                      </span>
                      <span className="font-mono text-[10px] text-ink-500">{l.duration}′</span>
                      {cur && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" />}
                    </button>
                    {br && <div className="ml-4 flex items-center gap-1.5 border-l border-ink-700 py-0.5 pl-3 text-[10px] text-ink-400"><Coffee size={10} className="text-gold-500" /> перерыв {br.duration} мин</div>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* правая колонка */}
        <div className="grid min-w-0 content-start gap-5 lg:grid-cols-2">
          {/* банк */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-500">
              <ChipIcon size={13} /> банк турнира
            </div>
            <div className="tabular font-mono text-4xl font-extrabold text-cream-100">{fmtChips(bd.total)}</div>
            <div className="mt-4 space-y-1.5 text-sm">
              <BreakdownRow label={`Входы · ${bd.entries} × ${fmtNum(t.startingChips)}`} value={bd.entryChips} />
              {bd.rebuys > 0 && <BreakdownRow label={`Ребаи · ${bd.rebuys}`} value={bd.rebuys * injectionChips(t, "rebuy")} plus />}
              {bd.addons > 0 && <BreakdownRow label={`Аддоны · ${bd.addons}`} value={bd.addons * injectionChips(t, "addon")} plus />}
              {bd.reentries > 0 && <BreakdownRow label={`Ре-ентри · ${bd.reentries}`} value={bd.reentries * injectionChips(t, "reentry")} plus />}
              {bd.lastchances > 0 && <BreakdownRow label={`Ласт шанс · ${bd.lastchances}`} value={bd.lastchances * injectionChips(t, "lastchance")} plus />}
              {bd.bonusChips > 0 && <BreakdownRow label={`Бонусы · ${t.bonuses.length}`} value={bd.bonusChips} plus gold />}
            </div>
            <p className="mt-4 border-t border-ink-700 pt-3 text-[11px] leading-relaxed text-ink-500">
              Каждый ввод фишек суммируется в банк. Фишки выбывших из банка не вычитаются —
              стеки по ходу турнира не отслеживаются.
            </p>
          </Card>

          {/* выбывшие */}
          <Card className={cx("flex min-h-0 flex-col p-5", eliminated.length > 0 && "border-danger-500/30")}>
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-danger-400">
                <CrosshairIcon size={13} /> выбывшие · {eliminated.length}
              </span>
              {lateOpen ? <Badge tone="gold">возврат возможен</Badge> : <Badge tone="ink">поздняя рег. закрыта</Badge>}
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: 300 }}>
              {eliminated.length === 0 && (
                <div className="rounded-lg border border-dashed border-ink-600 px-3 py-6 text-center text-xs text-ink-400">
                  Пока никто не выбыл — все в игре
                </div>
              )}
              {eliminated.map((k) => (
                <div key={`${k.userId}_${k.at}`} className="animate-rise rounded-lg border border-ink-700/70 bg-ink-800/60">
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-bold text-cream-100">{nick(k.userId)}</span>
                      <span className="block truncate text-[10px] text-ink-500">
                        {k.killerId ? `выбил ${nick(k.killerId)}` : "вылетел на блайндах"} · ур. {k.level + 1} · {timeAgo(k.at)}
                      </span>
                    </span>
                    <Button
                      size="xs" variant="outline"
                      disabled={!lateOpen}
                      onClick={() => setReturnFor(returnFor === k.userId ? null : k.userId)}
                      title={lateOpen ? "Вернуть в игру" : "Возврат возможен, пока открыта поздняя регистрация"}
                    >
                      <Undo2 size={12} /> Вернуть
                    </Button>
                  </div>
                  {returnFor === k.userId && (
                    <div className="grid grid-cols-2 gap-1.5 border-t border-ink-700 px-3 py-2">
                      {RETURN_KINDS.map((rk) => (
                        <button
                          key={rk.kind}
                          onClick={() => doReturn(k.userId, rk.kind)}
                          className="rounded-lg border border-ink-600 bg-ink-900/70 px-2 py-1.5 text-left transition-all hover:border-gold-500/60 hover:bg-gold-500/10"
                        >
                          <span className="block text-[11px] font-bold text-gold-200">
                            {REBUY_LABELS[rk.kind]} <span className="tabular ml-1 font-mono text-[10px] text-felt-300">+{fmtChips(injectionChips(t, rk.kind))}</span>
                          </span>
                          <span className="block text-[9px] leading-tight text-ink-500">{rk.desc}</span>
                        </button>
                      ))}
                      <button onClick={() => setReturnFor(null)} className="col-span-2 text-center text-[10px] text-ink-500 hover:text-cream-100">
                        <X size={10} className="mr-1 inline" />отмена
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-ink-700 pt-2.5 text-[11px] leading-relaxed text-ink-500">
              Возврат доступен, пока открыта поздняя регистрация ({t.lateRegMinutes} мин после старта).
              Фишки возврата сразу суммируются в банк.
            </p>
          </Card>

          {/* лента */}
          <Card className="flex min-h-0 flex-col p-5 lg:col-span-2">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-500">лента событий</div>
            <div className="grid gap-2 md:grid-cols-2">
              {events.length === 0 && <div className="text-sm text-ink-500">Событий пока нет</div>}
              {events.map((e, i) => (
                <div key={`${e.at}_${e.text}_${i}`} className={cx("flex items-center gap-2.5 rounded-lg bg-ink-800/70 px-3 py-2", i === 0 && "animate-pop")}>
                  {e.kind === "ko" ? <CrosshairIcon size={13} className="shrink-0 text-danger-400" />
                    : e.kind === "bn" ? <Gift size={13} className="shrink-0 text-gold-400" />
                    : <RotateCcw size={13} className="shrink-0 text-felt-300" />}
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-200">{e.text}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-500">{timeAgo(e.at)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* выбивание */}
      <Modal open={modal === "ko"} onClose={() => setModal("")} title="Отметить выбывание">
        <div className="space-y-4">
          <Field label="Кто выбыл">
            <Select value={koVictim} onChange={(e) => setKoVictim(e.target.value)}>
              {seated.map((u) => <option key={u} value={u}>{nick(u)}</option>)}
            </Select>
          </Field>
          <Field label="Кто выбил" hint="для баунти — очки киллеру">
            <Select value={koKiller} onChange={(e) => setKoKiller(e.target.value)}>
              <option value="">Блайнды / не указано</option>
              {seated.filter((u) => u !== koVictim).map((u) => <option key={u} value={u}>{nick(u)}</option>)}
            </Select>
          </Field>
          <Button
            variant="danger" className="w-full" size="lg"
            onClick={() => {
              if (!koVictim) { toast("Выберите игрока", "err"); return; }
              const err = actions.eliminate(t.id, koVictim, koKiller || null);
              if (err) toast(err, "err");
              else toast(`${nick(koVictim)} выбыл — появился в блоке «Выбывшие»`, "info");
              setModal("");
            }}
          >
            <CrosshairIcon size={15} /> Подтвердить выбывание
          </Button>
        </div>
      </Modal>

      {/* бонус */}
      <Modal open={modal === "bonus"} onClose={() => setModal("")} title="Выдать бонус">
        <div className="space-y-4">
          <Field label="Игрок">
            <Select value={bnUser} onChange={(e) => setBnUser(e.target.value)}>
              {seated.map((u) => <option key={u} value={u}>{nick(u)}</option>)}
            </Select>
          </Field>
          {t.bonusDefs.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">Бонусы турнира</div>
              <div className="flex flex-wrap gap-1.5">
                {t.bonusDefs.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => { setBnName(b.name); setBnChips(b.chips); }}
                    className={cx(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                      bnName === b.name ? "border-gold-500/70 bg-gold-500/15 text-gold-200" : "border-ink-600 text-ink-300 hover:border-gold-500/50",
                    )}
                  >
                    {b.name} · <span className="tabular font-mono">+{fmtChips(b.chips)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Наименование">
              <Input value={bnName} onChange={(e) => setBnName(e.target.value)} placeholder="Чип-бонус" />
            </Field>
            <Field label="Фишек">
              <Input type="number" value={bnChips} onChange={(e) => setBnChips(Number(e.target.value) || 0)} className="font-mono" />
            </Field>
          </div>
          <Button
            className="w-full" size="lg"
            onClick={() => {
              if (!bnUser) { toast("Выберите игрока", "err"); return; }
              const err = actions.addBonus(t.id, bnUser, bnName, bnChips);
              if (err) toast(err, "err");
              else toast(`Бонус выдан: +${fmtNum(bnChips)} фишек в банк`);
              setModal("");
            }}
          >
            <Gift size={15} /> Выдать бонус
          </Button>
        </div>
      </Modal>

      {/* завершение */}
      <Modal open={modal === "finish"} onClose={() => setModal("")} title="Завершить турнир?">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-300">
            Места будут присвоены автоматически: оставшиеся игроки — по порядку чекина, выбывшие — в обратном порядке вылета.
            Очки по сетке, статистика и достижения рассчитаются мгновенно.
          </p>
          <div className="rounded-lg border border-gold-500/30 bg-gold-500/8 px-4 py-3 text-sm text-cream-100">
            В игре: <b className="font-mono text-gold-300">{remaining}</b> · выбыло: <b className="font-mono">{t.knockouts.length}</b> · в зачёте: <b className="font-mono">{remaining + t.knockouts.length}</b>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setModal("")}>Отмена</Button>
            <Button
              variant="danger" className="flex-1"
              onClick={() => {
                const err = actions.finishTournament(t.id);
                if (err) toast(err, "err");
                else toast("Результаты опубликованы — очки начислены");
                setModal("");
              }}
            >
              <Flag size={15} /> Опубликовать итоги
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BreakdownRow({ label, value, plus, gold }: { label: string; value: number; plus?: boolean; gold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="truncate text-xs text-ink-300">{label}</span>
      <span className={cx("tabular shrink-0 font-mono text-sm font-bold", gold ? "text-gold-300" : plus ? "text-felt-300" : "text-cream-100")}>
        {plus && "+"}{fmtChips(value)}
      </span>
    </div>
  );
}
