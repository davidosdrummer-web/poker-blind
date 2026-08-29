// src/App.tsx
import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useDB } from "./lib/hooks";
import { useSoundEngine } from "./lib/sound";
import { initAuth } from "./lib/firebase/auth";
import { Toaster } from "./components/ui";
import AuthPage from "./pages/auth";
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

function useClubTheme() {
  const db = useDB();
  useEffect(() => {
    const c = db.settings.primary || "#d4a017";
    const bg = db.settings.background || "#0a0a12";
    const root = document.documentElement.style;
    root.setProperty("--color-gold-500", c);
    root.setProperty("--color-gold-400", c);
    root.setProperty("--color-ink-950", bg);
  }, [db.settings.primary, db.settings.background]);
}

export default function App() {
  const db = useDB();
  const [authReady, setAuthReady] = useState(false);
  useClubTheme();
  useSoundEngine(db);

  // Инициализация аутентификации при старте
  useEffect(() => {
    initAuth()
      .then(() => {
        setAuthReady(true);
      })
      .catch(() => {
        // Даже если ошибка — показываем приложение
        setAuthReady(true);
      });
  }, []);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="animate-pulse text-gold-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/display" element={<Navigate to="/display/main" replace />} />
        <Route path="/display/:mode" element={<DisplayShell />} />
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