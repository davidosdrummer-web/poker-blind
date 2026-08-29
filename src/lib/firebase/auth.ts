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

// Устанавливаем постоянную сессию (сохраняется даже после перезагрузки)
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log('✅ Auth persistence set to LOCAL'))
  .catch((error) => console.error('❌ Auth persistence error:', error));

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