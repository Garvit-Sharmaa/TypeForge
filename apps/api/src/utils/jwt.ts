import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload, UserRank } from '@typing-master/shared';

// ── Token generation ──────────────────────────────────────────────────────────
export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

// ── Token verification ────────────────────────────────────────────────────────
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as { sub: string };
}

// ── Token pair factory ────────────────────────────────────────────────────────
export function issueTokenPair(user: {
  id: string;
  email: string;
  username: string;
  rank: UserRank;
}) {
  const accessToken  = signAccessToken({
    sub:      user.id,
    email:    user.email,
    username: user.username,
    rank:     user.rank,
  });
  const refreshToken = signRefreshToken(user.id);
  return { accessToken, refreshToken, expiresIn: 900 }; // 15 min
}
