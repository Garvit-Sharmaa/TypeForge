import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, refreshTokens } from './auth.service';
import { verifyRefreshToken } from '../../utils/jwt';
import { createError }        from '../../middleware/errorHandler';

// ── Schemas ───────────────────────────────────────────────────────────────────
const RegisterSchema = z.object({
  email:    z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(100),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
export async function handleRegister(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(createError(
        parsed.error.issues.map((i) => i.message).join('; '),
        400, 'VALIDATION_ERROR',
      ));
    }
    const result = await registerUser(parsed.data);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export async function handleLogin(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(createError('Invalid email or password', 400, 'VALIDATION_ERROR'));
    }
    const result = await loginUser(parsed.data);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
export async function handleRefresh(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(createError('Refresh token required', 400, 'MISSING_TOKEN'));

    const payload = verifyRefreshToken(refreshToken);
    const tokens  = await refreshTokens(payload.sub);
    res.json({ success: true, data: tokens });
  } catch (err: any) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(createError('Invalid or expired refresh token', 401, 'INVALID_REFRESH'));
    }
    next(err);
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
export async function handleMe(
  req: Request, res: Response,
): Promise<void> {
  res.json({ success: true, data: req.user });
}
