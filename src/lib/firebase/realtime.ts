import { database } from './config';
import {
  ref,
  onValue,
  update,
  set,
  onDisconnect,
  serverTimestamp,
  get,
} from 'firebase/database';

// === Состояние турнира ===

// Подписка на состояние турнира (живой турнир)
export function subscribeTournamentState(
  tournamentId: string,
  callback: (state: any | null) => void
) {
  const stateRef = ref(database, `tournaments/${tournamentId}`);
  return onValue(stateRef, (snapshot) => {
    callback(snapshot.val() ?? null);
  });
}

// Обновление состояния турнира (оператор/админ)
export async function updateTournamentState(
  tournamentId: string,
  patch: Record<string, any>
) {
  const stateRef = ref(database, `tournaments/${tournamentId}`);
  await update(stateRef, patch);
}

// Получить состояние турнира (однократно)
export async function getTournamentState(tournamentId: string) {
  const stateRef = ref(database, `tournaments/${tournamentId}`);
  const snapshot = await get(stateRef);
  return snapshot.val() ?? null;
}

// Инициализация состояния нового турнира
export async function initTournamentState(tournamentId: string, initialState: any) {
  const stateRef = ref(database, `tournaments/${tournamentId}`);
  await set(stateRef, initialState);
}

// Удаление состояния турнира
export async function deleteTournamentState(tournamentId: string) {
  const stateRef = ref(database, `tournaments/${tournamentId}`);
  await set(stateRef, null);
}

// === Presence (присутствие) ===

// Установка присутствия пользователя (с onDisconnect)
export function setPresence(userId: string, tournamentId: string | null = null) {
  const presenceRef = ref(database, `presence/${userId}`);
  const connectedRef = ref(database, '.info/connected');

  onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === true) {
      // Пользователь онлайн
      set(presenceRef, {
        status: 'online',
        lastSeen: serverTimestamp(),
        tournamentId,
      });

      // При отключении – помечаем офлайн
      onDisconnect(presenceRef).update({
        status: 'offline',
        lastSeen: serverTimestamp(),
      });
    }
  });
}

// Получение присутствия всех пользователей
export function subscribePresence(callback: (presence: Record<string, any>) => void) {
  const presenceRef = ref(database, 'presence');
  return onValue(presenceRef, (snapshot) => {
    callback(snapshot.val() ?? {});
  });
}

// Получение присутствия конкретного пользователя
export function subscribeUserPresence(
  userId: string,
  callback: (presence: any | null) => void
) {
  const presenceRef = ref(database, `presence/${userId}`);
  return onValue(presenceRef, (snapshot) => {
    callback(snapshot.val() ?? null);
  });
}

// Обновление присутствия (heartbeat)
export async function updatePresence(userId: string, tournamentId: string | null = null) {
  const presenceRef = ref(database, `presence/${userId}`);
  await update(presenceRef, {
    status: 'online',
    lastSeen: serverTimestamp(),
    tournamentId,
  });
}