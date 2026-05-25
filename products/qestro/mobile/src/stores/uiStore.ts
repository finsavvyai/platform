import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ThemeName } from '../theme/tokens';

const storage = createMMKV({ id: 'qestro-ui' });

const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.remove(key),
};

interface UIState {
  themeName: ThemeName | null;
  setThemeName: (theme: ThemeName) => void;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      themeName: null,
      setThemeName: (theme) => set({ themeName: theme }),
      isOffline: false,
      setIsOffline: (offline) => set({ isOffline: offline }),
    }),
    {
      name: 'qestro-ui',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ themeName: state.themeName }),
    },
  ),
);
