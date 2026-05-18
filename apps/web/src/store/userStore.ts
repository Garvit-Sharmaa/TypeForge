'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, AuthTokens, UserStatistics } from '@typing-master/shared';

interface UserState {
  user:       User | null;
  tokens:     AuthTokens | null;
  stats:      UserStatistics | null;
  isLoading:  boolean;
  isHydrated: boolean;

  setUser:    (user: User, tokens: AuthTokens) => void;
  setStats:   (stats: UserStatistics) => void;
  setLoading: (v: boolean) => void;
  logout:     () => void;
  setHydrated:(v: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user:       null,
      tokens:     null,
      stats:      null,
      isLoading:  false,
      isHydrated: false,

      setUser:    (user, tokens) => set({ user, tokens, isLoading: false }),
      setStats:   (stats)        => set({ stats }),
      setLoading: (v)            => set({ isLoading: v }),
      setHydrated:(v)            => set({ isHydrated: v }),
      logout:     ()             => set({ user: null, tokens: null, stats: null }),
    }),
    {
      name:    'tm-user',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, tokens: s.tokens }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

// Selectors
export const selectUser      = (s: UserState) => s.user;
export const selectTokens    = (s: UserState) => s.tokens;
export const selectIsAuthed  = (s: UserState) => !!s.user;
export const selectUserStats = (s: UserState) => s.stats;
