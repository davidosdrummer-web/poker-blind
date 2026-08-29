import type { SVGProps } from "react";

/* Фирменные покерные иконки клуба — единый рисованный стиль. */

type P = SVGProps<SVGSVGElement> & { size?: number };

export function Spade({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <path d="M12 2.5c2.6 3.4 6.8 5.9 6.8 9.4 0 2.3-1.8 4-4 4-.9 0-1.7-.3-2.4-.8.3 1.9 1.1 3.6 2.4 5.4H9.2c1.3-1.8 2.1-3.5 2.4-5.4-.7.5-1.5.8-2.4.8-2.2 0-4-1.7-4-4 0-3.5 4.2-6 6.8-9.4z" fill="currentColor" />
    </svg>
  );
}

export function Heart({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <path d="M12 20.5S4 15.3 4 9.9C4 7 6.2 5 8.7 5c1.4 0 2.6.7 3.3 1.7C12.7 5.7 14 5 15.3 5 17.8 5 20 7 20 9.9c0 5.4-8 10.6-8 10.6z" fill="currentColor" />
    </svg>
  );
}

export function Diamond({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <path d="M12 2.8c2 3.4 4.2 6.2 6.5 9.2-2.3 3-4.5 5.8-6.5 9.2-2-3.4-4.2-6.2-6.5-9.2 2.3-3 4.5-5.8 6.5-9.2z" fill="currentColor" />
    </svg>
  );
}

export function Club({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <path d="M12 3a3.6 3.6 0 0 1 3.5 4.5A3.6 3.6 0 1 1 13 14.4c.3 2 1.1 3.8 2.5 5.6H8.5c1.4-1.8 2.2-3.6 2.5-5.6A3.6 3.6 0 1 1 8.5 7.5 3.6 3.6 0 0 1 12 3z" fill="currentColor" />
    </svg>
  );
}

export function ChipIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <circle cx="12" cy="12" r="4.4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4M5.4 5.4l2.4 2.4M16.2 16.2l2.4 2.4M18.6 5.4l-2.4 2.4M7.8 16.2l-2.4 2.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function TrophyIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7 5H4.5v1.5A3.5 3.5 0 0 0 8 10M17 5h2.5v1.5A3.5 3.5 0 0 1 16 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 14v3M8.5 20.5h7M10 17h4v3.5h-4z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CrownIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <path d="M4 8l3.5 3.5L12 5l4.5 6.5L20 8l-1.5 9.5h-13L4 8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7 21h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function CardsIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <rect x="3.2" y="5.5" width="10.5" height="14.5" rx="1.8" transform="rotate(-9 8.5 12.7)" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10.5" y="4" width="10.5" height="14.5" rx="1.8" transform="rotate(8 15.7 11.2)" stroke="currentColor" strokeWidth="1.6" fill="var(--color-ink-900)" />
      <path d="M15.6 8.6c.9 1.2 2.3 2 2.3 3.2 0 .8-.6 1.4-1.4 1.4-.3 0-.6-.1-.9-.3.1.7.4 1.3.8 1.9h-1.7c.4-.6.7-1.2.8-1.9-.2.2-.5.3-.8.3-.8 0-1.4-.6-1.4-1.4 0-1.2 1.4-2 2.3-3.2z" fill="currentColor" />
    </svg>
  );
}

export function CrosshairIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function TableIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <ellipse cx="12" cy="12" rx="9" ry="5.6" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="12" cy="12" rx="4.6" ry="2.4" stroke="currentColor" strokeWidth="1.3" opacity="0.7" />
      <circle cx="12" cy="3.4" r="1.3" fill="currentColor" />
      <circle cx="4" cy="7" r="1.3" fill="currentColor" />
      <circle cx="20" cy="7" r="1.3" fill="currentColor" />
      <circle cx="4" cy="17" r="1.3" fill="currentColor" />
      <circle cx="20" cy="17" r="1.3" fill="currentColor" />
      <circle cx="12" cy="20.6" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function TimerIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 9v4l2.8 1.8M9.5 2.5h5M12 2.5V5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function FlameIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <path d="M12 2.8s1 2.6 3.2 5.2c2 2.4 3.3 4.6 3.3 7.2a6.5 6.5 0 0 1-13 0c0-2 .8-3.7 2-5.2.6 1 1.4 1.7 2.3 2C9.6 9 10.6 5.6 12 2.8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 21a3 3 0 0 1-3-3c0-1.6 1.3-2.8 3-4.5 1.7 1.7 3 2.9 3 4.5a3 3 0 0 1-3 3z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function GemIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <path d="M7 4h10l4 5.5L12 21 3 9.5 7 4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3 9.5h18M9.5 4l1 5.5L12 21l1.5-11.5 1-5.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" opacity="0.75" />
    </svg>
  );
}

export function ShieldIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <path d="M12 2.8l7.5 2.8v6c0 5-3.2 8.2-7.5 9.6-4.3-1.4-7.5-4.6-7.5-9.6v-6L12 2.8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.8 11.8l2.2 2.3 4.4-4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BellIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <path d="M6 16v-5.5a6 6 0 1 1 12 0V16l1.5 2.5h-15L6 16z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 21a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function TvIcon({ size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <rect x="3" y="6" width="18" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 21h6M12 18.5V21M8 2.8L12 6l4-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SuitsRow({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Spade size={size} className="text-cream-100/80" />
      <Heart size={size} className="text-danger-400/90" />
      <Club size={size} className="text-cream-100/80" />
      <Diamond size={size} className="text-danger-400/90" />
    </span>
  );
}
