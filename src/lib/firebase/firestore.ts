// src/lib/firebase/firestore.ts — только изменённая часть settings

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