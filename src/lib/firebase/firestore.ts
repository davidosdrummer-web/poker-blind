// src/lib/firebase/firestore.ts
import { firestore } from './config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  addDoc,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore';
import type { DB, User, Season, Template, Tournament, Result, Rating, AchievementDef, ClubSettings, DisplayCfg, Notice } from '../../types';
import { defaultScoring, DEFAULT_ACHIEVEMENTS } from '../constants';

// === Вспомогательные функции ===

const col = (name: string) => collection(firestore, name);
const docRef = (name: string, id: string) => doc(firestore, name, id);

// === Users ===

export const users = {
  subscribe: (callback: (users: User[]) => void) => {
    return onSnapshot(col('users'), (snapshot) => {
      const users: User[] = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() } as User);
      });
      callback(users);
    });
  },

  get: async (uid: string): Promise<User | null> => {
    const docSnap = await getDoc(docRef('users', uid));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as User;
  },

  set: async (uid: string, data: Omit<User, 'id'>) => {
    await setDoc(docRef('users', uid), data);
  },

  update: async (uid: string, data: Partial<User>) => {
    await updateDoc(docRef('users', uid), data);
  },

  delete: async (uid: string) => {
    await deleteDoc(docRef('users', uid));
  },

  query: async (constraints: QueryConstraint[] = []) => {
    const q = query(col('users'), ...constraints);
    const snapshot = await getDocs(q);
    const users: User[] = [];
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() } as User);
    });
    return users;
  },
};

// === Seasons ===

export const seasons = {
  subscribe: (callback: (seasons: Season[]) => void) => {
    return onSnapshot(query(col('seasons'), orderBy('startDate', 'desc')), (snapshot) => {
      const seasons: Season[] = [];
      snapshot.forEach((doc) => {
        seasons.push({ id: doc.id, ...doc.data() } as Season);
      });
      callback(seasons);
    });
  },

  get: async (id: string): Promise<Season | null> => {
    const docSnap = await getDoc(docRef('seasons', id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Season;
  },

  set: async (id: string, data: Season) => {
    await setDoc(docRef('seasons', id), { ...data, updatedAt: serverTimestamp() });
  },

  delete: async (id: string) => {
    await deleteDoc(docRef('seasons', id));
  },
};

// === Tournament Templates ===

export const templates = {
  subscribe: (callback: (templates: Template[]) => void) => {
    return onSnapshot(col('tournamentTemplates'), (snapshot) => {
      const templates: Template[] = [];
      snapshot.forEach((doc) => {
        templates.push({ id: doc.id, ...doc.data() } as Template);
      });
      callback(templates);
    });
  },

  get: async (id: string): Promise<Template | null> => {
    const docSnap = await getDoc(docRef('tournamentTemplates', id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Template;
  },

  set: async (id: string, data: Template) => {
    await setDoc(docRef('tournamentTemplates', id), data);
  },

  delete: async (id: string) => {
    await deleteDoc(docRef('tournamentTemplates', id));
  },
};

// === Tournaments Meta ===

export const tournamentsMeta = {
  subscribe: (callback: (tournaments: Tournament[]) => void) => {
    return onSnapshot(
      query(col('tournamentsMeta'), orderBy('date', 'desc')),
      (snapshot) => {
        const tournaments: Tournament[] = [];
        snapshot.forEach((doc) => {
          tournaments.push({ id: doc.id, ...doc.data() } as Tournament);
        });
        callback(tournaments);
      }
    );
  },

  get: async (id: string): Promise<Tournament | null> => {
    const docSnap = await getDoc(docRef('tournamentsMeta', id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Tournament;
  },

  set: async (id: string, data: Tournament) => {
    await setDoc(docRef('tournamentsMeta', id), { ...data, updatedAt: serverTimestamp() });
  },

  update: async (id: string, data: Partial<Tournament>) => {
    // Очищаем undefined значения
    const cleanData: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    }
    if (Object.keys(cleanData).length === 0) return;
    await updateDoc(docRef('tournamentsMeta', id), { ...cleanData, updatedAt: serverTimestamp() });
  },

  delete: async (id: string) => {
    await deleteDoc(docRef('tournamentsMeta', id));
  },

  queryBySeason: (seasonId: string, callback: (tournaments: Tournament[]) => void) => {
    return onSnapshot(
      query(col('tournamentsMeta'), where('seasonId', '==', seasonId), orderBy('date', 'desc')),
      (snapshot) => {
        const tournaments: Tournament[] = [];
        snapshot.forEach((doc) => {
          tournaments.push({ id: doc.id, ...doc.data() } as Tournament);
        });
        callback(tournaments);
      }
    );
  },

  queryActive: (callback: (tournament: Tournament | null) => void) => {
    return onSnapshot(
      query(col('tournamentsMeta'), where('status', 'in', ['active', 'break', 'paused']), limit(1)),
      (snapshot) => {
        if (snapshot.empty) {
          callback(null);
          return;
        }
        const doc = snapshot.docs[0];
        callback({ id: doc.id, ...doc.data() } as Tournament);
      }
    );
  },
};

// === Results ===

export const results = {
  subscribeForTournament: (tournamentId: string, callback: (results: Result[]) => void) => {
    return onSnapshot(
      query(col('results'), where('tournamentId', '==', tournamentId), orderBy('place', 'asc')),
      (snapshot) => {
        const results: Result[] = [];
        snapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() } as Result);
        });
        callback(results);
      }
    );
  },

  batchCreate: async (tournamentId: string, entries: Omit<Result, 'id' | 'tournamentId' | 'createdAt'>[]) => {
    const batch = writeBatch(firestore);
    entries.forEach((entry) => {
      const ref = doc(col('results'));
      batch.set(ref, {
        ...entry,
        tournamentId,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  },

  getForTournament: async (tournamentId: string): Promise<Result[]> => {
    const q = query(col('results'), where('tournamentId', '==', tournamentId), orderBy('place', 'asc'));
    const snapshot = await getDocs(q);
    const results: Result[] = [];
    snapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() } as Result);
    });
    return results;
  },

  getForUser: async (userId: string): Promise<Result[]> => {
    const q = query(col('results'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const results: Result[] = [];
    snapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() } as Result);
    });
    return results;
  },
};

// === Ratings ===

export const ratings = {
  subscribe: (seasonId: string | null, callback: (ratings: Rating[]) => void) => {
    const seasonIdToUse = seasonId || 'global';
    return onSnapshot(
      query(col('ratings'), where('seasonId', '==', seasonIdToUse), orderBy('points', 'desc')),
      (snapshot) => {
        const ratings: Rating[] = [];
        snapshot.forEach((doc) => {
          ratings.push({ id: doc.id, ...doc.data() } as Rating);
        });
        callback(ratings);
      }
    );
  },

  updateBatch: async (seasonId: string, entries: Array<{ userId: string; points: number; events: number; wins: number; top3: number; finalTables: number; knockouts: number; returns: number; bestPoints: number }>) => {
    const batch = writeBatch(firestore);
    for (const entry of entries) {
      const existing = await getDocs(
        query(col('ratings'), where('seasonId', '==', seasonId), where('userId', '==', entry.userId))
      );
      if (existing.empty) {
        const ref = doc(col('ratings'));
        batch.set(ref, {
          ...entry,
          seasonId,
          updatedAt: serverTimestamp(),
        });
      } else {
        const doc = existing.docs[0];
        const data = doc.data();
        batch.update(doc.ref, {
          points: data.points + entry.points,
          events: data.events + entry.events,
          wins: data.wins + entry.wins,
          top3: data.top3 + entry.top3,
          finalTables: data.finalTables + entry.finalTables,
          knockouts: data.knockouts + entry.knockouts,
          returns: data.returns + entry.returns,
          bestPoints: Math.max(data.bestPoints, entry.bestPoints),
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  },
};

// === Achievements ===

export const achievements = {
  subscribe: (callback: (achievements: AchievementDef[]) => void) => {
    return onSnapshot(col('achievements'), (snapshot) => {
      const achievements: AchievementDef[] = [];
      snapshot.forEach((doc) => {
        achievements.push({ id: doc.id, ...doc.data() } as AchievementDef);
      });
      callback(achievements);
    });
  },

  set: async (id: string, data: AchievementDef) => {
    await setDoc(docRef('achievements', id), data);
  },

  delete: async (id: string) => {
    await deleteDoc(docRef('achievements', id));
  },
};

// === Settings (ИСПРАВЛЕННАЯ ВЕРСИЯ) ===

export const settings = {
  subscribe: (callback: (settings: ClubSettings) => void) => {
    return onSnapshot(docRef('settings', 'club'), (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as ClubSettings);
      } else {
        // Если документа нет, создаём дефолтные настройки
        const defaultSettings: ClubSettings = {
          clubName: 'Золотой Туз',
          tagline: 'Спортивный покер-клуб · турниры, рейтинги, сезоны',
          language: 'ru',
          primary: '#d4a017',
          background: '#0a0a12',
          soundsEnabled: true,
          soundVolume: 70,
          defaultScoring: defaultScoring(),
        };
        setDoc(docRef('settings', 'club'), defaultSettings)
          .then(() => callback(defaultSettings))
          .catch((error) => console.error('❌ Ошибка создания настроек:', error));
      }
    });
  },

  get: async (): Promise<ClubSettings | null> => {
    const docSnap = await getDoc(docRef('settings', 'club'));
    if (!docSnap.exists()) {
      // Если документа нет, создаём дефолтные настройки
      const defaultSettings: ClubSettings = {
        clubName: 'Золотой Туз',
        tagline: 'Спортивный покер-клуб · турниры, рейтинги, сезоны',
        language: 'ru',
        primary: '#d4a017',
        background: '#0a0a12',
        soundsEnabled: true,
        soundVolume: 70,
        defaultScoring: defaultScoring(),
      };
      await setDoc(docRef('settings', 'club'), defaultSettings);
      return defaultSettings;
    }
    return docSnap.data() as ClubSettings;
  },

  update: async (data: Partial<ClubSettings>) => {
    const ref = docRef('settings', 'club');
    try {
      const docSnap = await getDoc(ref);
      if (!docSnap.exists()) {
        // Если нет — создаём с дефолтными значениями + обновлением
        const defaultSettings: ClubSettings = {
          clubName: 'Золотой Туз',
          tagline: 'Спортивный покер-клуб · турниры, рейтинги, сезоны',
          language: 'ru',
          primary: '#d4a017',
          background: '#0a0a12',
          soundsEnabled: true,
          soundVolume: 70,
          defaultScoring: defaultScoring(),
        };
        await setDoc(ref, { ...defaultSettings, ...data });
      } else {
        await updateDoc(ref, data);
      }
    } catch (error) {
      console.error('❌ Ошибка обновления настроек:', error);
      throw error;
    }
  },

  set: async (data: ClubSettings) => {
    await setDoc(docRef('settings', 'club'), data);
  },
};

// === Displays ===

export const displays = {
  subscribe: (callback: (displays: DisplayCfg[]) => void) => {
    return onSnapshot(col('displays'), (snapshot) => {
      const displays: DisplayCfg[] = [];
      snapshot.forEach((doc) => {
        displays.push({ id: doc.id, ...doc.data() } as DisplayCfg);
      });
      callback(displays);
    });
  },

  set: async (id: string, data: DisplayCfg) => {
    await setDoc(docRef('displays', id), data);
  },

  delete: async (id: string) => {
    await deleteDoc(docRef('displays', id));
  },
};

// === Notices ===

export const notices = {
  subscribeForUser: (userId: string, callback: (notices: Notice[]) => void) => {
    return onSnapshot(
      query(col('notices'), where('userId', 'in', ['all', userId]), orderBy('at', 'desc')),
      (snapshot) => {
        const notices: Notice[] = [];
        snapshot.forEach((doc) => {
          notices.push({ id: doc.id, ...doc.data() } as Notice);
        });
        callback(notices);
      }
    );
  },

  add: async (notice: Omit<Notice, 'id'>) => {
    await addDoc(col('notices'), notice);
  },

  markRead: async (userId: string) => {
    await updateDoc(docRef('users', userId), {
      lastReadNoticesAt: serverTimestamp(),
    });
  },
};