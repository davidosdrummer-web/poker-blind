import type { ReactNode } from "react";
import { Navigate, NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import {
  SlidersHorizontal, Swords, Users, BarChart3, LayoutTemplate, CalendarRange, MonitorPlay, Settings,
  LogOut, ExternalLink, Wifi,
} from "lucide-react";
import { actions } from "../../lib/store";
import { useAuth, useDB, usePresenceHeartbeat } from "../../lib/hooks";
import { cx, fmtNum } from "../../lib/formulas";
import { Avatar, Badge, toast } from "../../components/ui";
import { Spade } from "../../components/icons";

export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  if (!roles.includes(user.role)) return <Navigate to={user.role === "player" ? "/player" : "/admin"} replace />;
  return <>{children}</>;
}

const NAV = [
  { to: "/admin", label: "Пульт", icon: SlidersHorizontal, end: true },
  { to: "/admin/tournaments", label: "Турниры", icon: Swords },
  { to: "/admin/players", label: "Игроки", icon: Users },
  { to: "/admin/ratings", label: "Рейтинг", icon: BarChart3 },
  { to: "/admin/templates", label: "Шаблоны", icon: LayoutTemplate },
  { to: "/admin/seasons", label: "Сезоны", icon: CalendarRange },
  { to: "/admin/displays", label: "ТВ-экраны", icon: MonitorPlay },
  { to: "/admin/settings", label: "Настройки", icon: Settings, adminOnly: true },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const db = useDB();
  const navigate = useNavigate();
  usePresenceHeartbeat(user);
  const online = Object.values(db.presence).filter((p) => p.status === "online").length;

  if (!user) return null;

  return (
    <div className="bg-stage noise flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[228px] flex-col border-r border-ink-800 bg-ink-900/95 backdrop-blur">
        <Link to="/admin" className="flex items-center gap-2.5 border-b border-ink-800 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold-500/40 bg-ink-800">
            <Spade size={18} className="text-gold-400" />
          </span>
          <span className="leading-none">
            <span className="block font-display text-sm font-extrabold text-cream-100">{db.settings.clubName.toUpperCase()}</span>
            <span className="mt-1 block font-mono text-[8.5px] uppercase tracking-[0.28em] text-gold-500">пульт клуба</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.filter((n) => !n.adminOnly || user.role === "admin").map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end as boolean | undefined}
              className={({ isActive }) => cx(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
                isActive
                  ? "border border-gold-500/30 bg-gold-500/12 text-gold-300 shadow-[inset_2px_0_0_var(--color-gold-500)]"
                  : "border border-transparent text-ink-300 hover:bg-ink-800 hover:text-cream-100",
              )}
            >
              <n.icon size={17} className="shrink-0" />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-800 p-3">
          <div className="mb-2 flex items-center justify-between rounded-lg bg-ink-800/70 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs text-ink-300"><Wifi size={13} className="text-felt-300" /> онлайн</span>
            <span className="tabular font-mono text-sm font-bold text-felt-300">{online}</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Avatar name={`${user.firstName} ${user.lastName}`} hue={user.hue} size={34} online />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-bold text-cream-100">{user.nickname}</div>
              <Badge tone={user.role === "admin" ? "gold" : "felt"} className="mt-0.5">{user.role === "admin" ? "админ" : "оператор"}</Badge>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Link to="/player" className="flex items-center justify-center gap-1.5 rounded-md border border-ink-700 py-1.5 text-xs text-ink-300 transition-colors hover:border-gold-500/50 hover:text-gold-300">
              <ExternalLink size={12} /> Кабинет
            </Link>
            <button
              onClick={() => { actions.logout(); toast("Вы вышли из системы", "info"); navigate("/"); }}
              className="flex items-center justify-center gap-1.5 rounded-md border border-ink-700 py-1.5 text-xs text-ink-300 transition-colors hover:border-danger-500/50 hover:text-danger-300"
            >
              <LogOut size={12} /> Выйти
            </button>
          </div>
        </div>
      </aside>

      <div className="ml-[228px] flex min-h-screen flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-7">
          <Outlet />
        </main>
        <footer className="border-t border-ink-800/70 px-6 py-4">
          <div className="mx-auto flex max-w-[1240px] items-center justify-between text-[11px] text-ink-500">
            <span>{db.settings.clubName} · CRM v1.0 · realtime sync</span>
            <span className="font-mono">{fmtNum(db.users.length)} в базе · {db.tournaments.length} турниров</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
