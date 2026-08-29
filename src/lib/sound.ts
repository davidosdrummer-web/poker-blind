import { useEffect, useRef } from "react";
import type { DB, Tournament } from "../types";

/* ============================================================
   Звуковое сопровождение событий турнира.
   Синтез через WebAudio — без аудиофайлов. Громкость и
   выключатель берутся из настроек клуба (общая БД).
   ============================================================ */

export type SoundKind = "chips" | "level" | "ko" | "bonus" | "win" | "break" | "start";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.7;
let unlocked = false;

export function configureSound(on: boolean, vol: number) {
  enabled = on;
  volume = Math.max(0, Math.min(1, vol / 100)) * 0.85;
  if (master) master.gain.value = volume;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/* разблокировка аудио по первому жесту пользователя (политика автоплея) */
function ensureUnlocked() {
  if (unlocked) return;
  unlocked = true;
  const unlock = () => { ac(); };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}
if (typeof window !== "undefined") ensureUnlocked();

function tone(freq: number, dur: number, opts: { type?: OscillatorType; delay?: number; gain?: number; glide?: number } = {}) {
  const c = ac();
  if (!c || !master) return;
  const { type = "sine", delay = 0, gain = 0.5, glide } = opts;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, glide), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function chipClick(delay: number) {
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(1900 + Math.random() * 1300, t0);
  g.gain.setValueAtTime(0.16, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + 0.06);
}

export function playEvent(kind: SoundKind) {
  if (!enabled) return;
  switch (kind) {
    case "chips":
      for (let i = 0; i < 5; i += 1) chipClick(i * 0.05);
      break;
    case "level":
      tone(523.25, 0.14, { type: "triangle", gain: 0.4 });
      tone(783.99, 0.2, { type: "triangle", delay: 0.12, gain: 0.4 });
      break;
    case "ko":
      tone(180, 0.22, { type: "sawtooth", gain: 0.4, glide: 60 });
      tone(90, 0.3, { type: "sine", delay: 0.03, gain: 0.5, glide: 40 });
      break;
    case "bonus":
      [659.25, 830.61, 987.77].forEach((f, i) => tone(f, 0.16, { type: "triangle", delay: i * 0.07, gain: 0.35 }));
      break;
    case "win":
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.18, { type: "triangle", delay: i * 0.11, gain: 0.4 }));
      break;
    case "break":
      tone(392, 0.3, { type: "sine", gain: 0.3, glide: 330 });
      break;
    case "start":
      tone(440, 0.16, { type: "triangle", gain: 0.4 });
      tone(659.25, 0.3, { type: "triangle", delay: 0.14, gain: 0.45 });
      break;
  }
}

/* ---------------- реактивный движок ---------------- */

interface LiveSnapshot {
  id: string;
  status: Tournament["status"];
  level: number;
  kos: number;
  rebuys: number;
  bonuses: number;
  finished: boolean;
}

function snapOf(t: Tournament | undefined): LiveSnapshot | null {
  if (!t) return null;
  return {
    id: t.id,
    status: t.status,
    level: t.currentLevel,
    kos: t.knockouts.length,
    rebuys: t.rebuys.length,
    bonuses: t.bonuses.length,
    finished: !!t.results,
  };
}

/**
 * Следит за живым турниром в общей БД и озвучивает события:
 * нокауты, ребаи/возвраты, бонусы, смену уровня, перерывы, старт и победу.
 */
export function useSoundEngine(db: DB) {
  const prev = useRef<LiveSnapshot | null>(null);
  const live = db.tournaments.find((t) => ["active", "break", "paused"].includes(t.status));
  const finishedNow = !live ? db.tournaments.find((t) => t.results && Date.now() - (t.createdAt ?? 0) < 2000) : undefined;
  void finishedNow;

  useEffect(() => {
    configureSound(db.settings.soundsEnabled, db.settings.soundVolume);
  }, [db.settings.soundsEnabled, db.settings.soundVolume]);

  useEffect(() => {
    const cur = snapOf(live);
    const p = prev.current;
    prev.current = cur;
    if (!cur) return;
    if (!p || p.id !== cur.id) {
      // впервые видим турнир — не озвучиваем накопленное
      return;
    }
    if (cur.kos > p.kos) playEvent("ko");
    if (cur.rebuys > p.rebuys) playEvent("chips");
    if (cur.bonuses > p.bonuses) playEvent("bonus");
    if (cur.level > p.level) playEvent("level");
    if (cur.status === "break" && p.status !== "break") playEvent("break");
    if (cur.status === "active" && p.status === "registration") playEvent("start");
    if (cur.finished && !p.finished) playEvent("win");
  }, [live?.id, live?.status, live?.currentLevel, live?.knockouts.length, live?.rebuys.length, live?.bonuses.length, live?.results]);
}
