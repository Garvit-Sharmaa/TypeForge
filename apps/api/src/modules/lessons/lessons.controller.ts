import { Request, Response, NextFunction } from 'express';
import { listLessons, generateLesson }     from './lessons.service';

// GET /api/lessons
// Public: returns list with locked status. If authenticated, uses userId for lock resolution.
export async function handleListLessons(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.user is populated by auth middleware when the Authorization header is present.
    // The route is OPTIONAL-AUTH — guests get all lessons locked except lesson 1.
    const userId  = req.user?.sub;
    const lessons = await listLessons(userId);

    res.json({
      success: true,
      data: {
        lessons,
        total: lessons.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/lessons/:id/generate
// Protected: requires valid JWT. Returns an adaptive 25-word practice payload.
export async function handleGenerateLesson(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId   = req.user!.sub;
    const lessonId = req.params.id;

    const payload = await generateLesson(lessonId, userId);

    res.json({
      success: true,
      data:    payload,
    });
  } catch (err) {
    next(err);
  }
}
