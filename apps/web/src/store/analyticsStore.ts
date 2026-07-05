'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DashboardData, WeakKeyAnalysis } from '@typing-master/shared';

/** ISO date string: 'YYYY-MM-DD' */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AnalyticsState {
  dashboard:   DashboardData | null;
  weakKeys:    WeakKeyAnalysis[];
  isLoading:   boolean;
  lastFetched: number | null;

  // ── Today's Forge stats (persist across page navigations, auto-reset at midnight) ───
  todayDate:    string;    // 'YYYY-MM-DD' — when this != todayStr() the counts reset
  todaySessions: number;
  todayXp:       number;

  setDashboard:    (data: DashboardData) => void;
  setWeakKeys:     (keys: WeakKeyAnalysis[]) => void;
  setLoading:      (v: boolean) => void;
  invalidate:      () => void;
  addTodaySession: (xpEarned: number) => void;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      dashboard:    null,
      weakKeys:     [],
      isLoading:    false,
      lastFetched:  null,
      todayDate:    todayStr(),
      todaySessions: 0,
      todayXp:       0,

      setDashboard: (data)  => set({ dashboard: data, lastFetched: Date.now(), isLoading: false }),
      setWeakKeys:  (keys)  => set({ weakKeys: keys }),
      setLoading:   (v)     => set({ isLoading: v }),
      invalidate:   ()      => set({ dashboard: null, lastFetched: null }),

      addTodaySession: (xpEarned: number) => {
        const today = todayStr();
        const prev  = get();
        // Auto-reset counts if the day has rolled over
        if (prev.todayDate !== today) {
          set({ todayDate: today, todaySessions: 1, todayXp: xpEarned });
        } else {
          set({ todaySessions: prev.todaySessions + 1, todayXp: prev.todayXp + xpEarned });
        }
      },
    }),
    {
      name:    'tm-analytics-today',
      storage: createJSONStorage(() => localStorage),
      // Only persist today's forge stats — not the full dashboard cache
      partialize: (s) => ({
        todayDate:     s.todayDate,
        todaySessions: s.todaySessions,
        todayXp:       s.todayXp,
      }),
    },
  ),
);
