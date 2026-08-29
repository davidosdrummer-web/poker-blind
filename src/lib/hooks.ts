// src/lib/hooks.ts
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DB, Tournament, User } from "../types";
import { actions, getSessionUid, getState, getVersion, subscribeStore } from "./store";
import { waitForAuth, getCurrentUser, onAuthState } from "./firebase/auth";

// Подписка на всё хранилище
export function useDB(): DB {
  useSyncExternalStore(subscribeStore, getVersion, getVersion);
  return getState();
}

export function useAuth(): { user: User | null; loading: boolean } {
  const db = useDB();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(() => {
    const uid = getSessionUid();
    return uid ? db.users.find((u) => u.id === uid) ?? null : null;
  });

  useEffect(() => {
    // Восстанавливаем сессию
    const restoreSession = async () => {
      try {
        const firebaseUser = await waitForAuth();
        if (firebaseUser) {
          const dbUser = db.users.find((u) => u.id === firebaseUser.uid) ?? null;
          setUser(dbUser);
          if (dbUser) {
            actions.heartbeat(dbUser.id, null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Ошибка восстановления сессии:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();

    // Подписка на изменения
    const unsubscribe = onAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        const dbUser = db.users.find((u) => u.id === firebaseUser.uid) ?? null;
        setUser(dbUser);
        if (dbUser) {
          actions.heartbeat(dbUser.id, null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db.users]);

  return { user, loading };
}

/** Тикающее «сейчас» — для таймеров и бегущих строк. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useTournament(id: string | undefined): Tournament | undefined {
  const db = useDB();
  if (!id) return undefined;
  return db.tournaments.find((t) => t.id === id);
}

/** Presence: heartbeat каждые 20 c + onDisconnect при закрытии вкладки. */
export function usePresenceHeartbeat(user: User | null, tournamentId: string | null = null) {
  useEffect(() => {
    if (!user) return;
    const beat = () => actions.heartbeat(user.id, tournamentId);
    beat();
    const id = window.setInterval(beat, 20_000);
    const off = () => actions.heartbeat(user.id, null);
    window.addEventListener("beforeunload", off);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", off);
    };
  }, [user?.id, tournamentId]);
}

/** Scroll-reveal: элемент плавно проявляется при входе во вьюпорт. */
export function useReveal<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { setInView(true); obs.disconnect(); }
        });
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/** Горячие клавиши (для пульта турнира). */
export function useHotkeys(map: Record<string, () => void>, enabled = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      const fn = ref.current[e.key.toLowerCase()];
      if (fn && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}