import { create } from 'zustand';

interface AuthState {
  userId: string | null;
  pendingPath: string | null;
  setUserId: (userId: string | null) => void;
  setPendingPath: (pendingPath: string | null) => void;
  clearPendingPath: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  pendingPath: null,
  setUserId: (userId) => set({ userId }),
  setPendingPath: (pendingPath) => set({ pendingPath }),
  clearPendingPath: () => set({ pendingPath: null }),
}));
