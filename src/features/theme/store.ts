import AsyncStorage from '@react-native-async-storage/async-storage';
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

// El rediseño está definido en claro; el modo oscuro queda como opción explícita
// del usuario y no se hereda del sistema.
const DEFAULT_PREFERENCE: ThemePreference = 'light';

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: DEFAULT_PREFERENCE,
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
