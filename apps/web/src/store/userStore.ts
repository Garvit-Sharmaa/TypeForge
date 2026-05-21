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
      logout: () => {
        // 1. Clear in-memory Zustand state immediately.
        set({ user: null, tokens: null, stats: null });
        // 2. Wipe the persisted localStorage entry so a new user opening
        //    this device cannot momentarily hydrate the previous user's
        //    identity — which would cause their lessons/progression to
        //    flash visible before the fresh fetch resolves.
        //    useUserStore.persist.clearStorage() is the official Zustand API;
        //    it keeps the key name DRY (no hardcoded 'tm-user' string here).
        try { useUserStore.persist.clearStorage(); } catch { /* SSR guard */ }
      },
    }),
    {
      name:    'tm-user',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, tokens: s.tokens }),
      onRehydrateStorage: () => (state) => {
        // Guard: if the rehydrated user is structurally invalid (missing id),
        // treat the persisted entry as a corrupt/stale write and wipe it.
        // This prevents a deleted or partially-written account from being
        // treated as a valid session on page load.
        if (state?.user && !state.user.id) {
          state.logout();
          return;
        }
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
