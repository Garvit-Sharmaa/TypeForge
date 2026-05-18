import { Request, Response, NextFunction } from 'express';
import { SubmitSessionSchema } from './sessions.validator';
import { submitSession, getUserSessions } from './sessions.service';
import { createError } from '../../middleware/errorHandler';

// POST /api/sessions
export async function handleSubmitSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.sub;

    // ── Schema validation ─────────────────────────────────────────────────
    const parsed = SubmitSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(createError(
        `Validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      ));
    }

    const result = await submitSession(userId, parsed.data);

    res.status(201).json({
      success: true,
      data: {
        sessionId:             result.sessionId,
        isFlagged:             result.isFlagged,
        // ── Gamification ────────────────────────────────────────
        xpGained:              result.xpGained,
        newXp:                 result.newXp,
        newLevel:              result.newLevel,
        leveledUp:             result.leveledUp,
        newRank:               result.newRank,
        unlockedAchievements:  result.unlockedAchievements,
        message: result.isFlagged
          ? 'Session recorded with anomaly flag'
          : result.leveledUp
            ? `Level up! You are now Level ${result.newLevel}`
            : 'Session recorded successfully',
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/sessions?limit=20&offset=0
export async function handleGetSessions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.sub;
    const limit  = Math.min(Number(req.query.limit  ?? 20), 100);
    const offset = Number(req.query.offset ?? 0);

    const sessions = await getUserSessions(userId, limit, offset);
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
}
