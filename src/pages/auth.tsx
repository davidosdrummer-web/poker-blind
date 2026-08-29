import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MonitorPlay } from "lucide-react";
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tab === "login") {
      const err = await actions.login(email, password);
      if (err) { setError(err); return; }
      const u = getState().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      toast(`Добро пожаловать, ${u?.nickname ?? "игрок"}!`);
      navigate(homeFor(u?.role));
    } else {
      const err = await actions.register({ email, password, firstName, lastName, nickname: nick, phone });
      if (err) { setError(err); return; }
      toast("Аккаунт создан — добро пожаловать в клуб!");
      navigate("/player");
    }
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