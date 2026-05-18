import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

// ── Redis Client ──────────────────────────────────────────────────────────────
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Prevents BullMQ crash
  enableReadyCheck: true,
  // Removed lazyConnect so it connects immediately and automatically
});

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('close', () => logger.warn('Redis connection closed'));

export const checkRedisConnection = async () => {
  try {
    // Just verify the connection is alive. No manual .connect() needed anymore.
    await redis.ping();
    console.log("✅ Redis connection verified");
  } catch (error) {
    console.error("❌ Redis connection failed", error);
    throw error;
  }
};