import express, { Application, Request } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { apiRateLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import authRouter     from './modules/auth/auth.router';
import sessionsRouter from './modules/sessions/sessions.router';
import analyticsRouter from './modules/analytics/analytics.router';
import lessonsRouter  from './modules/lessons/lessons.router';
import webhooksRouter from './modules/webhooks/webhooks.router';
import { env } from './config/env';

// ── Extend Express.Request with rawBody ─────────────────────────────────────
// The QStash signature verifier needs the raw request buffer (before JSON
// parsing). We capture it in the express.json() verify callback below and
// stash it here so the webhook handler can read it without a second parse.
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

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
  // IMPORTANT — verify callback fires BEFORE body parsing and gives us the
  // raw Buffer. The QStash webhook handler reads req.rawBody to verify the
  // HMAC signature. Do NOT use JSON.stringify(req.body) for this — whitespace
  // / key-order differences will break the signature check every time.
  app.use(express.json({
    limit:  '2mb', // keystroke payloads can be large
    verify: (req: Request, _res, buf) => { req.rawBody = buf; },
  }));
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
  // Webhooks are mounted BEFORE the rate limiter — QStash is a trusted
  // server-to-server caller; rate-limiting its retries would cause cascading
  // failures. Signature verification (inside the router) is the security gate.
  app.use('/api/webhooks', webhooksRouter);

  app.use('/api/auth',      authRouter);
  app.use('/api/sessions',  sessionsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/lessons',   lessonsRouter);

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { message: 'Route not found', code: 'NOT_FOUND' } });
  });

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandler);

  return app;
}
