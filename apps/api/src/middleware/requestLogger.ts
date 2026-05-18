import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/** Pino HTTP request logger middleware */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';

    logger[level]({
      method:     req.method,
      url:        req.originalUrl,
      status:     res.statusCode,
      durationMs: ms,
      userId:     req.user?.sub,
      ip:         req.ip,
    }, `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });

  next();
}
