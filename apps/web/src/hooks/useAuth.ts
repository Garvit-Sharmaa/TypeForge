'use client';
/**
 * useAuth.ts — Auth hook for hydration, login, register, logout, and
 *              automatic access token refresh before expiry.
 *
 * Token strategy:
 *   • Access token:  in-memory (Zustand userStore) — not in localStorage,
 *                   protected from XSS script access.
 *   • Refresh token: persisted in Zustand (localStorage via persist middleware)
 *                   so sessions survive page refresh.
 *   • Automatic refresh: a setInterval fires at (expiresIn - 60)s to get a
 *                        new access token before expiry.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { authApi, ApiError } from '@/lib/api';
import type { AuthTokens } from '@typing-master/shared';

export function useAuth() {
  const router = useRouter();
  const {
    user, tokens, isHydrated,
    setUser, setLoading, logout: storeLogout,
  } = useUserStore();

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Schedule automatic token refresh ──────────────────────────────────────
  const scheduleRefresh = useCallback((expiresIn: number, refreshToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Refresh 60 seconds before expiry
    const delay = Math.max((expiresIn - 60) * 1000, 5000);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const newTokens = await authApi.refresh(refreshToken);

        document.cookie = `accessToken=${newTokens.accessToken}; path=/; max-age=${newTokens.expiresIn}; SameSite=Lax; Secure`;
        // Re-fetch user profile with new token
        const profile = await authApi.me(newTokens.accessToken);
        setUser(
          {
            id: profile.sub, email: profile.email, username: profile.username,
            rank: profile.rank as any, xp: 0, createdAt: new Date(), updatedAt: new Date(),
          },
          newTokens,
        );
        scheduleRefresh(newTokens.expiresIn, newTokens.refreshToken);
      } catch {
        storeLogout();
        router.push('/login');
      }
    }, delay);
  }, [setUser, storeLogout, router]);

  // ── Hydrate from persisted store on mount ─────────────────────────────────
  useEffect(() => {
    if (!isHydrated || !tokens?.refreshToken) return;
    // Validate the stored refresh token by refreshing immediately
    authApi.refresh(tokens.refreshToken)
      .then((newTokens) => {
        if (user) {
          setUser(user, newTokens);
          scheduleRefresh(newTokens.expiresIn, newTokens.refreshToken);
        }
      })
      .catch(() => {
        storeLogout(); // stale refresh token — clear store
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await authApi.login({ email, password });
      document.cookie = `accessToken=${result.accessToken}; path=/; max-age=${result.expiresIn}; SameSite=Lax; Secure`;
      const profile = await authApi.me(result.accessToken);
      setUser(
        {
          id: profile.sub, email: profile.email, username: profile.username,
          rank: profile.rank as any, xp: 0, createdAt: new Date(), updatedAt: new Date(),
        },
        result,
      );
      scheduleRefresh(result.expiresIn, result.refreshToken);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [setUser, setLoading, scheduleRefresh, router]);

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (
    email: string, username: string, password: string,
  ) => {
    setLoading(true);
    try {
      const result = await authApi.register({ email, username, password });

      document.cookie = `accessToken=${result.accessToken}; path=/; max-age=${result.expiresIn}; SameSite=Lax; Secure`;
      const profile = await authApi.me(result.accessToken);
      setUser(
        {
          id: profile.sub, email: profile.email, username: profile.username,
          rank: profile.rank as any, xp: 0, createdAt: new Date(), updatedAt: new Date(),
        },
        result,
      );
      scheduleRefresh(result.expiresIn, result.refreshToken);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [setUser, setLoading, scheduleRefresh, router]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    // Wipe ALL in-memory derived state so no previous user's data is
    // visible even for a single render cycle after logout.
    // userStore.logout() also calls persist.clearStorage() to wipe localStorage.
    useAnalyticsStore.getState().invalidate();       // clears dashboard cache
    useAnalyticsStore.getState().setWeakKeys([]);    // clears weak-key heatmap
    storeLogout();                                   // clears user + tokens + localStorage

    document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure';

    router.push('/login');
  }, [storeLogout, router]);

  return {
    user,
    tokens,
    isAuthenticated: !!user && !!tokens?.accessToken,
    login,
    register,
    logout,
  };
}
