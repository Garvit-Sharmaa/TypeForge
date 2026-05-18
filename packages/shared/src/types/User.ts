import type { Achievement } from './Achievement';

// ─── User ─────────────────────────────────────────────────────────────────────
export type OAuthProvider = 'google' | 'github' | 'local';
export type UserRank = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master' | 'legend';

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  oauthProvider?: OAuthProvider;
  oauthId?: string;
  rank: UserRank;
  xp: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  statistics: UserStatistics;
  streakDays: number;
  achievements: Achievement[];
}

export interface UserStatistics {
  userId: string;
  totalSessions: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
  totalTimeMs: number;
  xp: number;
  rank: UserRank;
  streakDays: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string; // userId
  email: string;
  username: string;
  rank: UserRank;
  iat: number;
  exp: number;
}
