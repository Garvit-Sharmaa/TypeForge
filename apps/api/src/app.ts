import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { apiRateLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './modules/auth/auth.router';
import sessionsRouter from './modules/sessions/sessions.router';
import analyticsRouter from './modules/analytics/analytics.router';
import lessonsRouter from './modules/lessons/lessons.router';
import { env } from './config/env';

export function createApp(): Application {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(cors({
    origin: [
      'http://localhost:3000',
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Remaining'],
  }));

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '2mb' })); // keystroke payloads can be large
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // ── Observability ─────────────────────────────────────────────────────────
  app.use(requestLogger);

  // ── Global rate limiter ───────────────────────────────────────────────────
  app.use('/api', apiRateLimiter);

  // ── Health check (no auth, no rate limit) ────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
  });

  // ── API routes ────────────────────────────────────────────────────────────
  app.use('/api/auth', authRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/lessons', lessonsRouter);

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { message: 'Route not found', code: 'NOT_FOUND' } });
  });

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandler);

  return app;
}
