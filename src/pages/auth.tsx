import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Clapperboard, MonitorPlay, ShieldCheck, User as UserIcon } from "lucide-react";
import { actions, getState } from "../lib/store";
import { useDB } from "../lib/hooks";
import { Button, Card, Field, Input, Tabs, toast } from "../components/ui";
import { SuitsRow, Spade } from "../components/icons";

export function homeFor(role: string | undefined): string {
  return role === "player" ? "/player" : "/admin";
}

export function ClubLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const db = useDB();
  const s = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  const box = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`flex ${box} items-center justify-center rounded-lg border border-gold-500/40 bg-ink-800`}>
        <Spade size={size === "lg" ? 26 : size === "sm" ? 16 : 20} className="text-gold-400" />
      </span>
      <span className="leading-none">
        <span className={`block font-display font-extrabold tracking-tight text-cream-100 ${s}`}>
          {db.settings.clubName.toUpperCase()}
        </span>
        <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.3em] text-gold-500">poker club crm</span>
      </span>
    </span>
  );
}

const DEMO = [
  { email: "admin@tuz.club", label: "Администратор", desc: "полный доступ", icon: ShieldCheck },
  { email: "op@tuz.club", label: "Оператор", desc: "турниры и экраны", icon: Clapperboard },
  { email: "player@tuz.club", label: "Игрок", desc: "личный кабинет", icon: UserIcon },
];

/** Простая страница входа: только форма входа или регистрации. */
export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [nick, setNick] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tab === "login") {
      const err = actions.login(email, password);
      if (err) { setError(err); return; }
      const u = getState().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      toast(`Добро пожаловать, ${u?.nickname ?? "игрок"}!`);
      navigate(homeFor(u?.role));
    } else {
      const err = actions.register({ email, password, firstName, lastName, nickname: nick, phone });
      if (err) { setError(err); return; }
      toast("Аккаунт создан — добро пожаловать в клуб!");
      navigate("/player");
    }
  };

  const quick = (demoEmail: string) => {
    const err = actions.login(demoEmail, "poker123");
    if (err) { setError(err); return; }
    const u = getState().users.find((x) => x.email === demoEmail);
    toast(`Вход выполнен: ${u?.nickname}`);
    navigate(homeFor(u?.role));
  };

  return (
    <div className="bg-stage suit-pattern noise flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex justify-center"><ClubLogo /></Link>

        <Card className="shine-wrap p-6 sm:p-7">
          <div className="mb-1 flex items-center justify-between">
            <h1 className="font-display text-xl font-bold text-cream-100">
              {tab === "login" ? "Вход в клуб" : "Регистрация"}
            </h1>
            <SuitsRow size={13} />
          </div>
          <p className="mb-5 text-sm text-ink-400">
            {tab === "login" ? "Введите email и пароль" : "Новый игрок попадает в единую базу клуба"}
          </p>

          <Tabs
            value={tab}
            onChange={(id) => { setTab(id); setError(null); }}
            items={[
              { id: "login", label: "Вход" },
              { id: "register", label: "Регистрация" },
            ]}
          />

          <form onSubmit={submit} className="mt-5 space-y-4">
            {tab === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Фамилия">
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Петров" autoComplete="family-name" />
                  </Field>
                  <Field label="Имя">
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Иван" autoComplete="given-name" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Никнейм">
                    <Input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="RiverRat" />
                  </Field>
                  <Field label="Телефон">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 ___ ___-__-__" autoComplete="tel" />
                  </Field>
                </div>
              </>
            )}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="player@tuz.club" autoComplete="email" />
            </Field>
            <Field label="Пароль" hint={tab === "register" ? "минимум 6 символов" : undefined}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </Field>

            {error && (
              <div className="animate-pop rounded-lg border border-danger-500/40 bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-300">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg">
              {tab === "login" ? "Войти" : "Создать аккаунт"} <ArrowRight size={15} />
            </Button>
          </form>

          <div className="mt-6">
            <div className="mb-2.5 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink-700" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">быстрый вход</span>
              <span className="h-px flex-1 bg-ink-700" />
            </div>
            <div className="grid gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  onClick={() => quick(d.email)}
                  className="group flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-800/60 px-3.5 py-2.5 text-left transition-all hover:border-gold-500/50 hover:bg-ink-800"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-700 text-gold-300 transition-colors group-hover:bg-gold-500/15">
                    <d.icon size={15} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-cream-100">{d.label}</span>
                    <span className="block text-[11px] text-ink-400">{d.desc} · {d.email}</span>
                  </span>
                  <ArrowRight size={14} className="text-ink-500 transition-all group-hover:translate-x-0.5 group-hover:text-gold-400" />
                </button>
              ))}
            </div>
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-ink-500">
          ТВ-экраны открыты без входа:{" "}
          <Link to="/display/main" className="text-gold-500 underline-offset-2 hover:underline">главный</Link> ·{" "}
          <Link to="/display/final" className="text-gold-500 underline-offset-2 hover:underline">финальный стол</Link> ·{" "}
          <Link to="/display/results" className="text-gold-500 underline-offset-2 hover:underline">результаты</Link>
        </p>
      </div>
    </div>
  );
}

/* ---------------- публичное лобби ---------------- */

export function Lobby() {
  const db = useDB();
  const live = db.tournaments.find((t) => ["active", "break", "paused"].includes(t.status));
  const upcoming = db.tournaments.filter((t) => t.status === "registration");
  const online = Object.values(db.presence).filter((p) => p.status === "online").length;

  return (
    <div className="bg-stage suit-pattern noise min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <ClubLogo />
        <nav className="flex items-center gap-2">
          <Link to="/display/main" className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200 transition-colors hover:border-gold-500/60 hover:text-gold-300">
            <MonitorPlay size={15} /> ТВ-экран
          </Link>
          <Link to="/auth"><Button size="sm">Войти <ArrowRight size={14} /></Button></Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-14">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-gold-500">спортивный покер-клуб</div>
            <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.08] text-cream-100 sm:text-5xl">
              Фишки уже <span className="text-gold-400">в игре</span>.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-300">
              {db.settings.tagline}. Пульт турнира, рассадка, банк фишек, очки сезона и ТВ-экраны зала —
              всё синхронизируется в реальном времени.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { v: db.users.filter((u) => u.role === "player").length, l: "игроков" },
                { v: db.tournaments.filter((t) => t.results).length, l: "сыграно" },
                { v: online, l: "онлайн" },
              ].map((x) => (
                <div key={x.l} className="rounded-lg border border-ink-700 bg-ink-850/70 px-2 py-3">
                  <div className="tabular font-mono text-xl font-bold text-gold-300">{x.v}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-400">{x.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {live && (
              <div className="shine-wrap overflow-hidden rounded-xl border border-gold-500/30 bg-ink-850/85 p-5">
                <div className="flex items-center justify-between">
                  <div className="font-display text-sm font-bold text-cream-100">{live.name}</div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-felt-400/40 bg-felt-500/15 px-2.5 py-0.5 text-[11px] font-bold text-felt-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-felt-300" /> в игре
                  </span>
                </div>
                <div className="mt-2 text-xs text-ink-400">{db.seasons.find((s) => s.id === live.seasonId)?.name}</div>
                <Link to="/display/main" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-gold-400 hover:text-gold-300">
                  Смотреть на ТВ-экране <ArrowRight size={13} />
                </Link>
              </div>
            )}
            <div className="rounded-xl border border-ink-700 bg-ink-850/85 p-5">
              <div className="mb-3 font-display text-sm font-bold text-cream-100">Открытая регистрация</div>
              <div className="space-y-2">
                {upcoming.length === 0 && <div className="text-sm text-ink-400">Новые турниры скоро появятся</div>}
                {upcoming.map((t) => {
                  const regs = t.registrations.filter((r) => r.status !== "refunded").length;
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-800/60 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-cream-100">{t.name}</div>
                        <div className="text-[11px] text-ink-400">
                          {new Date(t.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <span className="tabular shrink-0 font-mono text-xs font-bold text-felt-300">{regs}/{t.maxPlayers}</span>
                    </div>
                  );
                })}
              </div>
              <Link to="/auth" className="mt-4 block">
                <Button variant="outline" className="w-full">Записаться на турнир <ArrowRight size={14} /></Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-ink-800/80 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 text-xs text-ink-500">
          <span>© 2026 {db.settings.clubName} · спортивный покер</span>
          <span className="font-mono">realtime sync · demo</span>
        </div>
      </footer>
    </div>
  );
}
