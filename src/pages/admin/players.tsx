import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Ban, Pencil, Plus, RotateCcw, Search, Swords } from "lucide-react";
import { actions } from "../../lib/store";
import { useAuth, useDB } from "../../lib/hooks";
import type { Role, User } from "../../types";
import { computeBoard, cx, fmtDate, fmtNum, fullName, itmRate, timeAgo } from "../../lib/formulas";
import { Avatar, Badge, Button, EmptyState, Field, Input, Modal, Select, Toggle, toast } from "../../components/ui";
import { PageHeader } from "../../components/shared";
import { CrownIcon } from "../../components/icons";

const ROLES: Array<{ v: Role | "all"; label: string }> = [
  { v: "all", label: "Все роли" },
  { v: "player", label: "Игроки" },
  { v: "operator", label: "Операторы" },
  { v: "admin", label: "Админы" },
];

const HUES = [12, 43, 90, 140, 165, 200, 230, 265, 300, 335];

function roleLabel(r: Role): string {
  return r === "admin" ? "Админ" : r === "operator" ? "Оператор" : "Игрок";
}
function roleTone(r: Role): "gold" | "cream" | "ink" {
  return r === "admin" ? "gold" : r === "operator" ? "cream" : "ink";
}

interface PlayerForm {
  nickname: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  hue: number;
  registeredAt: string; // yyyy-mm-dd
  manualPoints: number;
}

function emptyForm(): PlayerForm {
  return {
    nickname: "", firstName: "", lastName: "", phone: "", email: "", password: "poker123",
    hue: HUES[Math.floor(Math.random() * HUES.length)],
    registeredAt: new Date().toISOString().slice(0, 10), manualPoints: 0,
  };
}

function fromUser(u: User): PlayerForm {
  return {
    nickname: u.nickname, firstName: u.firstName, lastName: u.lastName, phone: u.phone, email: u.email,
    password: u.password, hue: u.hue,
    registeredAt: new Date(u.registeredAt).toISOString().slice(0, 10),
    manualPoints: u.manualPoints,
  };
}

function HuePicker({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">Аватар</div>
      <div className="flex flex-wrap gap-1.5">
        {HUES.map((h) => (
          <button
            key={h}
            onClick={() => onChange(h)}
            className={cx("h-7 w-7 rounded-full border-2 transition-all", value === h ? "scale-110 border-cream-100" : "border-transparent hover:scale-105")}
            style={{ background: `hsl(${h} 55% 45%)` }}
            aria-label={`Оттенок ${h}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function PlayersPage() {
  const db = useDB();
  const { user: me } = useAuth();
  const isAdmin = me?.role === "admin";

  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "all">("all");
  const [inTournament, setInTournament] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PlayerForm>(emptyForm());
  const [editing, setEditing] = useState<User | null>(null);

  /* глобальные очки для колонки «Очки» */
  const board = useMemo(() => computeBoard(db, null), [db]);
  const pointsOf = useMemo(() => {
    const m = new Map<string, number>();
    board.forEach((b) => m.set(b.userId, b.points));
    return m;
  }, [board]);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return db.users
      .filter((u) => (showArchived ? true : !u.archived))
      .filter((u) => (role === "all" ? true : u.role === role))
      .filter((u) => (inTournament ? !!db.presence[u.id]?.tournamentId : true))
      .filter((u) =>
        !query ||
        u.nickname.toLowerCase().includes(query) ||
        fullName(u).toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.phone.toLowerCase().includes(query),
      )
      .sort((a, b) => (pointsOf.get(b.id) ?? 0) - (pointsOf.get(a.id) ?? 0));
  }, [db.users, db.presence, q, role, inTournament, showArchived, pointsOf]);

  const inTournamentCount = Object.values(db.presence).filter((p) => p.status === "online" && p.tournamentId).length;

  const openCreate = () => { setForm(emptyForm()); setCreating(true); };
  const openEdit = (u: User) => { setForm(fromUser(u)); setEditing(u); };

  const set = <K extends keyof PlayerForm>(k: K, v: PlayerForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submitCreate = () => {
    const err = actions.createPlayer({
      email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName,
      nickname: form.nickname, phone: form.phone, hue: form.hue,
      registeredAt: new Date(form.registeredAt).getTime() || Date.now(),
      manualPoints: form.manualPoints,
    });
    if (err) { toast(err, "err"); return; }
    toast(`Игрок ${form.nickname || form.firstName} добавлен в базу клуба${form.manualPoints ? ` (+${fmtNum(form.manualPoints)} очков)` : ""}`);
    setCreating(false);
  };

  const submitEdit = () => {
    if (!editing) return;
    const err = actions.updateProfile(editing.id, {
      nickname: form.nickname, firstName: form.firstName, lastName: form.lastName, phone: form.phone, hue: form.hue,
    });
    if (err) { toast(err, "err"); return; }
    if (isAdmin) {
      actions.setRole(editing.id, "player"); // роль управляется отдельно
      actions.setManualPoints(editing.id, form.manualPoints);
    }
    toast("Профиль обновлён");
    setEditing(null);
  };

  return (
    <div>
      <PageHeader kicker="база клуба" title="Участники">
        <Badge tone="felt" dot>{inTournamentCount} в турнире</Badge>
        <Badge tone="ink">{fmtNum(db.users.filter((u) => !u.archived).length)} в базе</Badge>
        {isAdmin && <Button onClick={openCreate}><Plus size={16} /> Создать игрока</Button>}
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Никнейм, имя, email или телефон…" className="pl-9" />
        </div>
        <Select value={role} onChange={(e) => setRole(e.target.value as Role | "all")} className="w-40">
          {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
        </Select>
        <Toggle checked={inTournament} onChange={setInTournament} label="Только в турнире" />
        <Toggle checked={showArchived} onChange={setShowArchived} label="Показать архив" />
      </div>

      {list.length === 0 && <EmptyState title="Никого не нашли" text="Попробуйте другой запрос или сбросьте фильтры." />}

      <div className="overflow-hidden rounded-xl border border-ink-700/80 bg-ink-850/80">
        <div className="hidden grid-cols-[1.5fr_1fr_0.55fr_0.5fr_0.6fr_0.8fr_130px] items-center gap-3 border-b border-ink-700 bg-ink-800/70 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400 md:grid">
          <span>Участник</span><span>Контакты</span><span className="text-center">Роль</span>
          <span className="text-center">Очки</span><span>Регистрация</span><span>Активность</span>
          <span className="text-right">Действия</span>
        </div>
        {list.map((u) => {
          const p = db.presence[u.id];
          const online = p?.status === "online";
          const inTour = !!p?.tournamentId && online;
          return (
            <div key={u.id} className={cx(
              "grid grid-cols-2 items-center gap-3 border-b border-ink-700/50 px-4 py-3 transition-colors last:border-0 hover:bg-ink-800/50 md:grid-cols-[1.5fr_1fr_0.55fr_0.5fr_0.6fr_0.8fr_130px]",
              (u.isBlocked || u.archived) && "opacity-55",
            )}>
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-2.5">
                  <Avatar name={fullName(u)} hue={u.hue} size={34} online={online} />
                  <div className="min-w-0 leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-cream-100">{u.nickname}</span>
                      {u.manualPoints > 0 && <Badge tone="gold" title="Очки, начисленные администратором">+{fmtNum(u.manualPoints)}</Badge>}
                    </div>
                    <div className="truncate text-[11px] text-ink-400">
                      {fullName(u)}
                      {u.isBlocked && <span className="ml-1.5 text-danger-400">· заблокирован</span>}
                      {u.archived && <span className="ml-1.5 text-ink-500">· архив</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden leading-tight md:block">
                <div className="truncate text-xs text-ink-300">{u.email}</div>
                <div className="text-[11px] text-ink-500">{u.phone || "—"}</div>
              </div>

              <div className="text-center">
                <Badge tone={roleTone(u.role)}>{roleLabel(u.role)}</Badge>
              </div>

              <div className="tabular text-center font-mono text-sm font-bold text-gold-300">{fmtNum(pointsOf.get(u.id) ?? 0)}</div>

              <div className="hidden text-xs text-ink-400 md:block">{fmtDate(u.registeredAt)}</div>

              <div className="hidden text-xs md:block">
                {inTour ? (
                  <span className="inline-flex items-center gap-1.5 text-felt-300">
                    <Swords size={12} /> в турнире
                  </span>
                ) : online ? (
                  <span className="text-ink-300">в сети</span>
                ) : (
                  <span className="text-ink-500">{timeAgo(p?.lastSeen ?? u.registeredAt)}</span>
                )}
              </div>

              <div className="col-span-2 flex items-center justify-end gap-1.5 md:col-span-1">
                {isAdmin && u.id !== me?.id && (
                  <Select
                    value={u.role}
                    onChange={(e) => { actions.setRole(u.id, e.target.value as Role); toast(`${u.nickname}: роль «${roleLabel(e.target.value as Role)}»`, "info"); }}
                    className="h-8 w-28 text-xs"
                    title="Сменить роль"
                  >
                    <option value="player">игрок</option>
                    <option value="operator">оператор</option>
                    <option value="admin">админ</option>
                  </Select>
                )}
                {isAdmin && u.id !== me?.id && (
                  u.isBlocked ? (
                    <Button size="xs" variant="dark" onClick={() => { actions.setBlocked(u.id, false); toast(`${u.nickname} разблокирован`); }} title="Разблокировать">
                      <RotateCcw size={12} />
                    </Button>
                  ) : (
                    <Button size="xs" variant="ghost" onClick={() => { actions.setBlocked(u.id, true); toast(`${u.nickname} заблокирован`, "info"); }} title="Заблокировать">
                      <Ban size={12} />
                    </Button>
                  )
                )}
                {isAdmin && u.id !== me?.id && (
                  u.archived ? (
                    <Button size="xs" variant="dark" onClick={() => { actions.setArchived(u.id, false); toast(`${u.nickname} возвращён из архива`); }} title="Вернуть из архива">
                      <ArchiveRestore size={12} />
                    </Button>
                  ) : (
                    <Button size="xs" variant="ghost" onClick={() => { actions.setArchived(u.id, true); toast(`${u.nickname} в архиве`, "info"); }} title="В архив">
                      <Archive size={12} />
                    </Button>
                  )
                )}
                {isAdmin && (
                  <Button size="xs" variant="outline" onClick={() => openEdit(u)} title="Редактировать">
                    <Pencil size={12} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* создание */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Новый игрок клуба" width="max-w-lg">
        <div className="space-y-4">
          <HuePicker value={form.hue} onChange={(h) => set("hue", h)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Фамилия"><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
            <Field label="Имя"><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
            <Field label="Никнейм"><Input value={form.nickname} onChange={(e) => set("nickname", e.target.value)} /></Field>
            <Field label="Телефон"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+7 ___ ___-__-__" /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Пароль" hint="мин. 6 символов"><Input value={form.password} onChange={(e) => set("password", e.target.value)} /></Field>
            <Field label="Дата регистрации"><Input type="date" value={form.registeredAt} onChange={(e) => set("registeredAt", e.target.value)} /></Field>
            <Field label="Начислить очков" hint="в глобальный рейтинг"><Input type="number" value={form.manualPoints} onChange={(e) => set("manualPoints", Number(e.target.value) || 0)} className="font-mono" /></Field>
          </div>
          <Button className="w-full" size="lg" onClick={submitCreate}><Plus size={15} /> Добавить в базу клуба</Button>
        </div>
      </Modal>

      {/* редактирование */}
      <Modal open={editing != null} onClose={() => setEditing(null)} title={`Профиль: ${editing?.nickname ?? ""}`} width="max-w-lg">
        {editing && (
          <div className="space-y-4">
            <HuePicker value={form.hue} onChange={(h) => set("hue", h)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Фамилия"><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
              <Field label="Имя"><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
              <Field label="Никнейм"><Input value={form.nickname} onChange={(e) => set("nickname", e.target.value)} /></Field>
              <Field label="Телефон"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Дата регистрации"><Input type="date" value={form.registeredAt} onChange={(e) => set("registeredAt", e.target.value)} /></Field>
              {isAdmin && <Field label="Очки (вручную)"><Input type="number" value={form.manualPoints} onChange={(e) => set("manualPoints", Number(e.target.value) || 0)} className="font-mono" /></Field>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Отмена</Button>
              <Button className="flex-1" onClick={submitEdit}>Сохранить</Button>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-ink-800/60 px-3 py-2 text-xs text-ink-400">
              <span>ITM {itmRate(editing.stats)}% · побед {editing.stats.wins}</span>
              {editing.achievements.length > 0 && <Badge tone="gold"><CrownIcon size={10} /> {editing.achievements.length} наград</Badge>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
