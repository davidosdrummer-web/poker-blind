import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useDB } from "./lib/hooks";
import { Toaster } from "./components/ui";
import AuthPage, { Lobby } from "./pages/auth";
import DisplayShell from "./pages/display";
import AdminLayout, { RequireRole } from "./pages/admin/layout";
import ConsolePage from "./pages/admin/console";
import TournamentsPage from "./pages/admin/tournaments";
import TournamentEditorPage from "./pages/admin/editor";
import ControlPage from "./pages/admin/control";
import PlayersPage from "./pages/admin/players";
import RatingsPage from "./pages/admin/ratings";
import { TemplatesPage, SeasonsPage } from "./pages/admin/catalog";
import TemplateEditorPage from "./pages/admin/templateEditor";
import SeasonPage from "./pages/admin/season";
import { DisplaysPage, SettingsPage } from "./pages/admin/ops";
import PlayerCabinet from "./pages/player";

/** Акцентный цвет клуба применяется к CSS-переменным темы вживую. */
function useClubTheme() {
  const db = useDB();
  useEffect(() => {
    const c = db.settings.primary || "#d4a017";
    const root = document.documentElement.style;
    root.setProperty("--color-gold-500", c);
    root.setProperty("--color-gold-400", c);
  }, [db.settings.primary]);
}

export default function App() {
  useClubTheme();
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* ТВ-экраны: анонимный доступ */}
        <Route path="/display" element={<Navigate to="/display/main" replace />} />
        <Route path="/display/:mode" element={<DisplayShell />} />

        {/* админ-панель: admin + operator */}
        <Route
          path="/admin"
          element={
            <RequireRole roles={["admin", "operator"]}>
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<ConsolePage />} />
          <Route path="console" element={<ConsolePage />} />
          <Route path="tournaments" element={<TournamentsPage />} />
          <Route path="tournaments/new" element={<TournamentEditorPage />} />
          <Route path="tournaments/:id/edit" element={<TournamentEditorPage />} />
          <Route path="tournaments/:id" element={<ControlPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="ratings" element={<RatingsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="templates/new" element={<TemplateEditorPage />} />
          <Route path="templates/:id/edit" element={<TemplateEditorPage />} />
          <Route path="seasons" element={<SeasonsPage />} />
          <Route path="seasons/:id" element={<SeasonPage />} />
          <Route path="displays" element={<DisplaysPage />} />
          <Route
            path="settings"
            element={
              <RequireRole roles={["admin"]}>
                <SettingsPage />
              </RequireRole>
            }
          />
        </Route>

        {/* личный кабинет: любая авторизованная роль */}
        <Route
          path="/player"
          element={
            <RequireRole roles={["admin", "operator", "player"]}>
              <PlayerCabinet />
            </RequireRole>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </HashRouter>
  );
}
