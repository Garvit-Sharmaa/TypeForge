import { Router } from 'express';
import { requireAuth }          from '../../middleware/authMiddleware';
import { sessionSubmitLimiter } from '../../middleware/rateLimiter';
import { handleSubmitSession, handleGetSessions } from './sessions.controller';

const router = Router();

/**
 * POST /api/sessions
 * Submit a completed typing session.
 * Protected: JWT required. Rate limited: 3 req/10s.
 */
router.post(
  '/',
  requireAuth,
  sessionSubmitLimiter,
  handleSubmitSession,
);

/**
 * GET /api/sessions
 * Get paginated session history for the authenticated user.
 */
router.get(
  '/',
  requireAuth,
  handleGetSessions,
);

export default router;
