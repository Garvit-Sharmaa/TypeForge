import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { createError } from './errorHandler';
import type { JwtPayload } from '@typing-master/shared';

// ── Augment express Request with user payload ─────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Require a valid JWT access token — rejects unauthenticated requests. */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(createError('Missing or malformed authorization header', 401, 'UNAUTHORIZED'));
    }

    const token   = header.slice(7);
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(createError('Access token expired', 401, 'TOKEN_EXPIRED'));
    }
    next(createError('Invalid access token', 401, 'INVALID_TOKEN'));
  }
}

/** Optionally attach user if token present — does not reject if missing. */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(header.slice(7));
    } catch {
      // Ignore invalid/expired tokens for optional auth
    }
  }
  next();
}
