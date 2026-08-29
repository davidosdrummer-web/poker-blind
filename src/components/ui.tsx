import {
  useEffect, useId, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { X } from "lucide-react";
import { cx, fullName } from "../lib/formulas";
import { useReveal } from "../lib/hooks";
import type { User } from "../types";

/* ---------------- Button ---------------- */

type BtnVariant = "primary" | "dark" | "outline" | "ghost" | "danger" | "felt";
export function Button({
  variant = "primary", size = "md", className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "xs" | "sm" | "md" | "lg" }) {
  const v: Record<BtnVariant, string> = {
    primary: "bg-gold-500 text-ink-950 hover:bg-gold-400 shadow-[0_6px_18px_rgba(212,160,23,0.25)]",
    dark: "bg-ink-700 text-cream-100 hover:bg-ink-600",
    outline: "border border-ink-600 text-ink-200 hover:border-gold-500/60 hover:text-gold-300 bg-transparent",
    ghost: "text-ink-300 hover:bg-ink-800 hover:text-cream-100",
    danger: "bg-danger-500 text-cream-50 hover:bg-danger-400 shadow-[0_6px_18px_rgba(217,79,67,0.25)]",
    felt: "bg-felt-500 text-cream-50 hover:bg-felt-400 shadow-[0_6px_18px_rgba(31,122,80,0.3)]",
  };
  const s = {
    xs: "h-7 px-2.5 text-[11px] gap-1",
    sm: "h-8.5 px-3.5 text-sm gap-1.5",
    md: "h-10 px-4 text-sm gap-2",
    lg: "h-11.5 px-5 text-[15px] gap-2",
  }[size];
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center rounded-lg font-bold tracking-tight transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        v[variant], s, className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Card ---------------- */

export function Card({ className, children, lift }: { className?: string; children: ReactNode; lift?: boolean }) {
  return (
    <div className={cx("rounded-xl border border-ink-700 bg-ink-850/85 shadow-[0_10px_30px_rgba(0,0,0,0.35)]", lift && "card-lift", className)}>
      {children}
    </div>
  );
}

/* ---------------- Badge ---------------- */

export function Badge({
  tone = "ink", className, children, dot, title,
}: { tone?: "gold" | "felt" | "danger" | "ink" | "cream"; className?: string; children: ReactNode; dot?: boolean; title?: string }) {
  const t = {
    gold: "bg-gold-500/15 text-gold-300 border-gold-500/40",
    felt: "bg-felt-500/15 text-felt-300 border-felt-400/40",
    danger: "bg-danger-500/12 text-danger-300 border-danger-500/40",
    ink: "bg-ink-700/50 text-ink-200 border-ink-600",
    cream: "bg-cream-100/10 text-cream-100 border-cream-100/25",
  }[tone];
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold", t, className)}>
      {dot && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------------- поля ---------------- */

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-lg border border-ink-600 bg-ink-800/80 px-3 text-sm text-cream-100 outline-none transition-all placeholder:text-ink-500 focus:border-gold-500/70 focus:ring-2 focus:ring-gold-500/20",
        className,
      )}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-10 w-full cursor-pointer rounded-lg border border-ink-600 bg-ink-800/80 px-2.5 text-sm text-cream-100 outline-none transition-all focus:border-gold-500/70 focus:ring-2 focus:ring-gold-500/20",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-ink-300">
        {label}
        {hint && <span className="normal-case tracking-normal text-ink-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="group inline-flex items-center gap-2.5" role="switch" aria-checked={checked}>
      <span className={cx("relative h-5.5 w-10 rounded-full border transition-all", checked ? "border-gold-500/60 bg-gold-500/30" : "border-ink-600 bg-ink-700")}>
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full transition-all", checked ? "left-5 bg-gold-400" : "left-0.5 bg-ink-400 group-hover:bg-ink-300")} />
      </span>
      {label && <span className={cx("text-sm font-semibold", checked ? "text-cream-100" : "text-ink-400")}>{label}</span>}
    </button>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({ open, onClose, title, children, width = "max-w-md" }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cx("animate-pop relative w-full rounded-xl border border-ink-600 bg-ink-850 p-5 shadow-2xl", width)}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="font-display text-base font-bold text-cream-100">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-700 hover:text-cream-100" aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Tabs ---------------- */

export function Tabs({ value, onChange, items }: {
  value: string; onChange: (v: string) => void; items: Array<{ id: string; label: ReactNode }>;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-ink-700 bg-ink-900/70 p-1">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={cx(
            "rounded-md px-3.5 py-1.5 text-sm font-semibold transition-all",
            value === it.id ? "bg-gold-500 text-ink-950 shadow" : "text-ink-300 hover:bg-ink-700/70 hover:text-cream-100",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Bar / Stat / Ring ---------------- */

export function Bar({ value, max, tone = "gold" }: { value: number; max: number; tone?: "gold" | "felt" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
      <div
        className={cx("h-full rounded-full transition-all duration-700", tone === "gold" ? "bg-gradient-to-r from-gold-600 to-gold-400" : "bg-gradient-to-r from-felt-600 to-felt-300")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Stat({ label, value, icon, tone = "ink" }: { label: string; value: ReactNode; icon?: ReactNode; tone?: "ink" | "gold" | "felt" | "danger" }) {
  const t = {
    ink: "text-cream-100",
    gold: "text-gold-300",
    felt: "text-felt-300",
    danger: "text-danger-300",
  }[tone];
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850/85 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
        {icon}{label}
      </div>
      <div className={cx("tabular mt-1 font-mono text-2xl font-bold", t)}>{value}</div>
    </div>
  );
}

export function Ring({ ratio, size = 200, stroke = 10, critical, children }: {
  ratio: number; size?: number; stroke?: number; critical?: boolean; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ink-700)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={critical ? "var(--color-danger-500)" : "var(--color-gold-500)"}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clamped)}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className={cx("absolute inset-0 flex flex-col items-center justify-center text-center", critical && "timer-critical")}>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Avatar ---------------- */

export function Avatar({ name, hue, size = 32, online, photo, className }: {
  name: string; hue: number; size?: number; online?: boolean | null; photo?: string | null; className?: string;
}) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return (
    <span className={cx("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-bold", className)}
      style={{
        width: size, height: size,
        fontSize: Math.max(10, size * 0.36),
        background: `linear-gradient(135deg, hsl(${hue} 42% 26%), hsl(${hue} 50% 16%))`,
        color: `hsl(${hue} 75% 74%)`,
        border: `1.5px solid hsl(${hue} 45% 38%)`,
      }}
    >
      {photo
        ? <img src={photo} alt={name} className="h-full w-full object-cover" />
        : (initials || "?")}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 block rounded-full border-2 border-ink-900 bg-felt-300" style={{ width: size * 0.32, height: size * 0.32 }} />
      )}
    </span>
  );
}

/** Читает изображение, обрезает по центру и даунскейлит до 128px (dataURL для БД). */
export function readAvatarFile(file: File, cb: (dataUrl: string) => void): string | null {
  if (!file.type.startsWith("image/")) return "Выберите файл изображения (JPG/PNG)";
  if (file.size > 4 * 1024 * 1024) return "Файл больше 4 МБ — возьмите фото поменьше";
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) { URL.revokeObjectURL(url); return; }
    const min = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
    URL.revokeObjectURL(url);
    cb(canvas.toDataURL("image/jpeg", 0.82));
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
  return null;
}

export function UserChip({ user, online, sub }: { user: User; online?: boolean | null; sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Avatar name={fullName(user)} hue={user.hue} size={30} online={online} photo={user.photoURL} />
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-cream-100">{user.nickname}</span>
        <span className="block text-[11px] text-ink-400">{sub ?? fullName(user)}</span>
      </span>
    </span>
  );
}

/* ---------------- Reveal / SectionHead / EmptyState ---------------- */

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={cx("reveal", inView && "is-in", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function SectionHead({ kicker, title, right }: { kicker?: string; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.24em] text-gold-500">{kicker}</div>}
        <h2 className="font-display text-lg font-bold text-cream-100">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon?: ReactNode; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-600 bg-ink-850/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-500">{icon}</div>}
      <div className="font-display text-sm font-bold text-cream-100">{title}</div>
      {text && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-400">{text}</p>}
    </div>
  );
}

/* ---------------- toast ---------------- */

export type ToastKind = "ok" | "err" | "info";
interface ToastItem { id: number; text: string; kind: ToastKind; }

const toastListeners = new Set<(t: ToastItem) => void>();
let toastId = 0;
export function toast(text: string, kind: ToastKind = "ok") {
  toastId += 1;
  toastListeners.forEach((fn) => fn({ id: toastId, text, kind }));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const fn = (t: ToastItem) => {
      setItems((prev) => [...prev.slice(-3), t]);
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3800);
    };
    toastListeners.add(fn);
    return () => { toastListeners.delete(fn); };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[320px] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cx(
            "animate-pop pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur",
            t.kind === "ok" && "border-felt-400/50 bg-felt-900/90 text-felt-200",
            t.kind === "err" && "border-danger-500/50 bg-[#3a1512]/95 text-danger-300",
            t.kind === "info" && "border-gold-500/40 bg-ink-800/95 text-cream-100",
          )}
        >
          <span className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", t.kind === "ok" ? "bg-felt-300" : t.kind === "err" ? "bg-danger-400" : "bg-gold-400")} />
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------------- id для форм ---------------- */

export function useFieldId(): string {
  return useId();
}
