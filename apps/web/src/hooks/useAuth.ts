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
import type { AuthTokens } from '@keystra/shared';

export function useAuth() {
  const router = useRouter();
  const {
    user, tokens, isHydrated,
    setUser, setLoading, logout: storeLogout,
  } = useUserStore();

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);

  // ── Refresh Logic ─────────────────────────────────────────────────────────
  const doRefresh = useCallback(async (refreshToken: string) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const newTokens = await authApi.refresh(refreshToken);
      document.cookie = `accessToken=${newTokens.accessToken}; path=/; max-age=604800; SameSite=Lax; Secure`;
      const profile = await authApi.me(newTokens.accessToken);
      // Always get fresh user from store instead of closure
      const currentUser = useUserStore.getState().user;
      useUserStore.getState().setUser(
        currentUser ?? {
          id: profile.sub, email: profile.email, username: profile.username,
          rank: profile.rank as any, xp: 0, createdAt: new Date(), updatedAt: new Date(),
        },
        newTokens,
      );
      scheduleRefresh(newTokens.expiresIn, newTokens.refreshToken);
    } catch {
      storeLogout();
      document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure';
      router.push('/login');
    } finally {
      isRefreshingRef.current = false;
    }
  }, [storeLogout, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Schedule automatic token refresh ──────────────────────────────────────
  const scheduleRefresh = useCallback((expiresIn: number, refreshToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max((expiresIn - 60) * 1000, 5000);
    refreshTimerRef.current = setTimeout(() => doRefresh(refreshToken), delay);
  }, [doRefresh]);

  // ── Hydrate from persisted store on mount ─────────────────────────────────
  useEffect(() => {
    if (!isHydrated) return;

    if (!tokens?.refreshToken) {
      document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure';
      return;
    }

    void doRefresh(tokens.refreshToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await authApi.login({ email, password });
      document.cookie = `accessToken=${result.accessToken}; path=/; max-age=604800; SameSite=Lax; Secure`;
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

      document.cookie = `accessToken=${result.accessToken}; path=/; max-age=604800; SameSite=Lax; Secure`;
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
    useAnalyticsStore.getState().invalidate();
    useAnalyticsStore.getState().setWeakKeys([]);
    storeLogout();
    document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure';
    router.push('/login');
  }, [storeLogout, router]);

  // ── Global 401 Listener ───────────────────────────────────────────────────
  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn('[useAuth] Global 401 received.');
      if (isRefreshingRef.current) {
        console.info('[useAuth] Refresh in progress. Ignoring 401.');
        return;
      }
      const currentTokens = useUserStore.getState().tokens;
      if (currentTokens?.refreshToken) {
        console.info('[useAuth] Attempting refresh instead of logout.');
        void doRefresh(currentTokens.refreshToken);
      } else {
        console.warn('[useAuth] No refresh token available. Forcing logout.');
        logout();
      }
    };
    window.addEventListener('auth:401', handleUnauthorized);
    return () => window.removeEventListener('auth:401', handleUnauthorized);
  }, [logout, doRefresh]);

  return {
    user,
    tokens,
    isAuthenticated: !!user && !!tokens?.accessToken,
    login,
    register,
    logout,
  };
}
