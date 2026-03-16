import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  hasHydrated: boolean;
  setPreference: (preference: ThemePreference) => void;
  togglePreference: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

const getDefaultPreference = (): ThemePreference => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: getDefaultPreference(),
      hasHydrated: false,
      setPreference: (preference) => set({ preference }),
      togglePreference: () => set({ preference: get().preference === 'dark' ? 'light' : 'dark' }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'nossa-clima-theme',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({ preference: state.preference }),
    },
  ),
);
