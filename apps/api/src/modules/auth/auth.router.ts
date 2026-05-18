import { Router } from 'express';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { requireAuth }      from '../../middleware/authMiddleware';
import { handleRegister, handleLogin, handleRefresh, handleMe } from './auth.controller';

const router = Router();

router.post('/register', authRateLimiter, handleRegister);
router.post('/login',    authRateLimiter, handleLogin);
router.post('/refresh',  authRateLimiter, handleRefresh);
router.get ('/me',       requireAuth,     handleMe);

export default router;
