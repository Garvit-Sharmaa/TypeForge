'use client';
import { create } from 'zustand';
import type { DashboardData, WeakKeyAnalysis } from '@typing-master/shared';

interface AnalyticsState {
  dashboard:   DashboardData | null;
  weakKeys:    WeakKeyAnalysis[];
  isLoading:   boolean;
  lastFetched: number | null;

  setDashboard: (data: DashboardData) => void;
  setWeakKeys:  (keys: WeakKeyAnalysis[]) => void;
  setLoading:   (v: boolean) => void;
  invalidate:   () => void;
}

export const useAnalyticsStore = create<AnalyticsState>()((set) => ({
  dashboard:   null,
  weakKeys:    [],
  isLoading:   false,
  lastFetched: null,

  setDashboard: (data)  => set({ dashboard: data, lastFetched: Date.now(), isLoading: false }),
  setWeakKeys:  (keys)  => set({ weakKeys: keys }),
  setLoading:   (v)     => set({ isLoading: v }),
  invalidate:   ()      => set({ dashboard: null, lastFetched: null }),
}));
