import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { handleGetDashboard, handleGetWeakKeys } from './analytics.controller';

const router = Router();

router.get('/dashboard',  requireAuth, handleGetDashboard);
router.get('/weak-keys',  requireAuth, handleGetWeakKeys);

export default router;
