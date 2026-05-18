import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

// ── Redis Client ──────────────────────────────────────────────────────────────
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('close', () => logger.warn('Redis connection closed'));

export const checkRedisConnection = async () => {
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    } else {
      await redis.ping(); // Just verify it's alive
    }
    console.log("✅ Redis connection verified");
  } catch (error) {
    console.error("❌ Redis connection failed", error);
    throw error;
  }
};
