// src/lib/firebase/auth.ts
import { auth } from './config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

// Устанавливаем постоянную сессию
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log('✅ Auth persistence set to LOCAL'))
  .catch((error) => console.error('❌ Auth persistence error:', error));

// Переменная для хранения состояния готовности
let authReady = false;
let authUser: FirebaseUser | null = null;
const authListeners: ((user: FirebaseUser | null) => void)[] = [];

// Инициализация с восстановлением сессии
export function initAuth() {
  return new Promise<void>((resolve) => {
    if (authReady) {
      resolve();
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authUser = user;
      authReady = true;
      authListeners.forEach((cb) => cb(user));
      unsubscribe();
      resolve();
    });
  });
}

// Вход
export async function login(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
}

// Регистрация
export async function register(email: string, password: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
}

// Выход
export async function logout() {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Подписка на состояние аутентификации
export function onAuthState(callback: (user: FirebaseUser | null) => void) {
  if (authReady) {
    callback(authUser);
  }
  authListeners.push(callback);
  return onAuthStateChanged(auth, callback);
}

// Получить текущего пользователя
export function getCurrentUser() {
  return auth.currentUser;
}

// Проверка, авторизован ли пользователь
export function isAuthenticated(): boolean {
  return auth.currentUser !== null;
}

// Ожидание готовности аутентификации
export function waitForAuth(): Promise<FirebaseUser | null> {
  return new Promise((resolve) => {
    if (authReady) {
      resolve(authUser);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authReady = true;
      authUser = user;
      unsubscribe();
      resolve(user);
    });
  });
}