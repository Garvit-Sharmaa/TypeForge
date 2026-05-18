'use client';
/**
 * useWeakKeyHeatmap.ts
 *
 * Fetches per-key analytics from /api/analytics/weak-keys, normalises the
 * data, loads it into the keyboardStore, and auto-enables heatmap mode.
 *
 * ARCHITECTURE NOTE:
 *   This hook is the ONLY place that couples the analytics API with the
 *   keyboard visual store. Components that render the <Keyboard /> don't
 *   need to know anything about data fetching.
 */

import { useEffect, useState, useCallback } from 'react';
import { useKeyboardStore, selectHeatmapData } from '@/store/keyboardStore';
import { useUserStore, selectTokens } from '@/store/userStore';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { analyticsApi, ApiError } from '@/lib/api';

export type HeatmapDimension = 'accuracy' | 'speed';

export interface UseWeakKeyHeatmapReturn {
  isLoading:  boolean;
  error:      string;
  hasData:    boolean;
  /** Current active dimension */
  dimension:  HeatmapDimension;
  /** Switch dimension — instantly re-renders keyboard with same data */
  setDimension: (d: HeatmapDimension) => void;
  /** Force re-fetch (e.g. after a new session completes) */
  refetch:    () => void;
}

export function useWeakKeyHeatmap(
  initialDimension: HeatmapDimension = 'accuracy',
): UseWeakKeyHeatmapReturn {
  const tokens       = useUserStore(selectTokens);
  const lastFetched  = useAnalyticsStore((s) => s.lastFetched);
  const heatmapData  = useKeyboardStore(selectHeatmapData);
  const { setHeatmapData, enableHeatmap, setHeatmapMode } = useKeyboardStore();

  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState('');
  const [dimension,  setDimState]   = useState<HeatmapDimension>(initialDimension);
  const [fetchKey,   setFetchKey]   = useState(0); // increment to force refetch

  const hasData = Object.keys(heatmapData).length > 0;

  // ── Switch dimension without re-fetching ──────────────────────────────────
  const setDimension = useCallback((d: HeatmapDimension) => {
    setDimState(d);
    setHeatmapMode(d);
  }, [setHeatmapMode]);

  // ── Force refetch ─────────────────────────────────────────────────────────
  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  // ── Fetch on mount / auth change / forced refetch ─────────────────────────
  useEffect(() => {
    if (!tokens?.accessToken) return;

    let cancelled = false;
    setIsLoading(true);
    setError('');

    analyticsApi.weakKeys(tokens.accessToken)
      .then((data) => {
        if (cancelled) return;
        // Normalize API response into the store format
        setHeatmapData(
          data.map((k) => ({
            keyChar:      k.keyChar,
            errorRate:    k.errorRate,
            avgLatencyMs: k.avgLatencyMs,
            sampleCount:  k.sampleCount,
          })),
        );
        // Atomically enable heatmap with the current dimension
        enableHeatmap(dimension);
      })
      .catch((err: ApiError | Error) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  // fetchKey in deps triggers forced refetch; lastFetched reacts to post-session invalidation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens?.accessToken, fetchKey]);

  return { isLoading, error, hasData, dimension, setDimension, refetch };
}
