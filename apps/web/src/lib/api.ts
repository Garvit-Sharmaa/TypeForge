'use client';
/**
 * api.ts — Typed fetch wrapper for the TypingMaster API.
 *
 * Design decisions:
 * • Token passed explicitly (not read from store here — avoids circular deps)
 * • ApiError is a typed error class for consumer-level handling
 * • Automatic token-expiry retry is handled in useAuth via the refresh endpoint
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ── Typed API error ───────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    credentials: 'include', // <── THIS ALLOWS PORT 3000 TO KEEP THE COOKIE
  });

  // Parse body regardless — error responses also return JSON
  const body = await response.json().catch(() => ({
    success: false,
    error: { message: 'Unexpected non-JSON response', code: 'PARSE_ERROR' },
  }));

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? `HTTP ${response.status}`,
      response.status,
      body?.error?.code,
    );
  }

  return body.data as T;
}

// ── Domain-specific API functions ─────────────────────────────────────────────

/** Auth */
export const authApi = {
  register: (body: { email: string; username: string; password: string }) =>
    apiFetch<{ accessToken: string; refreshToken: string; expiresIn: number; userId: string }>(
      '/api/auth/register', { method: 'POST', body: JSON.stringify(body) },
    ),

  login: (body: { email: string; password: string }) =>
    apiFetch<{ accessToken: string; refreshToken: string; expiresIn: number; userId: string }>(
      '/api/auth/login', { method: 'POST', body: JSON.stringify(body) },
    ),

  refresh: (refreshToken: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      '/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) },
    ),

  me: (token: string) =>
    apiFetch<{ sub: string; email: string; username: string; rank: string }>(
      '/api/auth/me', { token },
    ),
};

/** Sessions */
export const sessionsApi = {
  submit: (payload: unknown, token: string) =>
    apiFetch<{ sessionId: string; xpGained: number; isFlagged: boolean }>(
      '/api/sessions', { method: 'POST', body: JSON.stringify(payload), token },
    ),

  list: (token: string, limit = 20, offset = 0) =>
    apiFetch<object[]>(
      `/api/sessions?limit=${limit}&offset=${offset}`, { token },
    ),
};

/** Analytics */
export const analyticsApi = {
  dashboard: (token: string) =>
    apiFetch<{
      stats: {
        totalSessions: number; avgWpm: number; bestWpm: number;
        avgRawWpm: number; avgAccuracy: number; streakDays: number;
        totalTimeMs: number; xp: number; rank: string;
      };
      wpmHistory: { sessionIndex: number; wpm: number; accuracy: number; completedAt: string }[];
    }>('/api/analytics/dashboard', { token }),

  weakKeys: (token: string) =>
    apiFetch<{
      keyChar: string; errorRate: number; avgLatencyMs: number; sampleCount: number;
    }[]>('/api/analytics/weak-keys', { token }),
};

/** Lessons / Academy */
export interface LessonListItem {
  id: string;
  name: string;
  description: string;
  stage: number;
  targetKeys: string[];
  allowedCount: number;
  baseDifficulty: number;
  wordCount: number;
  locked: boolean;
}

export interface LessonPayload {
  lessonId: string;
  text: string;
  words: string[];
  wordCount: number;
  targetKeysCovered: string[];
  weakKeysCovered: string[];
  config: {
    allowedKeys: string[];
    targetKeys: string[];
    baseDifficulty: number;
  };
}

export const lessonsApi = {
  list: (token?: string) =>
    apiFetch<{ lessons: LessonListItem[]; total: number }>(
      '/api/lessons', token ? { token } : {},
    ),

  generate: (lessonId: string, token: string) =>
    apiFetch<LessonPayload>(
      `/api/lessons/${lessonId}/generate`, { token },
    ),
};