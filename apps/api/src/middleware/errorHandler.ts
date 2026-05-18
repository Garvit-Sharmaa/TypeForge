import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?:       string;
  isOperational?: boolean;
}

export function createError(
  message: string,
  statusCode: number,
  code?: string,
): AppError {
  const err = new Error(message) as AppError;
  err.statusCode     = statusCode;
  err.code           = code;
  err.isOperational  = true;
  return err;
}

/** Global Express error handler — must have 4 params */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const isInternal = statusCode >= 500;

  // Log with appropriate level
  if (isInternal) {
    logger.error({
      err,
      method: req.method,
      url:    req.originalUrl,
      userId: (req as any).user?.sub,
    }, 'Internal server error');
  } else {
    logger.warn({
      code:    err.code,
      message: err.message,
      method:  req.method,
      url:     req.originalUrl,
    }, 'Request error');
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: isInternal && process.env.NODE_ENV === 'production'
        ? 'An internal error occurred'
        : err.message,
      code: err.code,
    },
  });
}
