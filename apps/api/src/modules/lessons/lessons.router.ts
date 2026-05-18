import { Router }     from 'express';
import { requireAuth, optionalAuth } from '../../middleware/authMiddleware';
import {
  handleListLessons,
  handleGenerateLesson,
} from './lessons.controller';

const router = Router();

/**
 * GET /api/lessons
 * Returns the full 10-lesson curriculum with per-user lock status.
 * Optional auth: guests see lesson 1 unlocked; authenticated users get
 * personalized unlock state based on session history.
 */
router.get('/', optionalAuth, handleListLessons);

/**
 * GET /api/lessons/:id/generate
 * Generate an adaptive 25-word practice payload for the given lesson.
 * Protected: JWT required — weak key data is fetched for the authenticated user.
 *
 * Response shape:
 *   { success, data: { lessonId, text, words, wordCount,
 *                      targetKeysCovered, weakKeysCovered, config } }
 */
router.get('/:id/generate', requireAuth, handleGenerateLesson);

export default router;
