import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { pool } from '../config/database';
import { QUEUES } from '../config/bullmq';
import { logger } from '../utils/logger';
import type { AchievementJobPayload } from '../config/bullmq';

/** Evaluate and unlock achievements for a user after session completion. */
async function processAchievements(job: Job<AchievementJobPayload>): Promise<void> {
  const { userId, wpm, accuracy } = job.data;

  // Fetch current user stats + already unlocked achievement slugs
  const [statsResult, unlockedResult, catalogResult] = await Promise.all([
    pool.query(
      'SELECT total_sessions, best_wpm, streak_days FROM user_statistics WHERE user_id=$1',
      [userId],
    ),
    pool.query(
      `SELECT a.slug FROM user_achievements ua
       JOIN achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = $1`,
      [userId],
    ),
    pool.query('SELECT id, slug, condition_json, xp_reward FROM achievements'),
  ]);

  const stats = statsResult.rows[0];
  const unlocked = new Set(unlockedResult.rows.map((r: any) => r.slug));
  const catalog = catalogResult.rows;

  if (!stats) return;

  const context = {
    totalSessions: stats.total_sessions,
    bestWpm: Math.max(stats.best_wpm, wpm),
    currentWpm: wpm,
    accuracy,
    streakDays: stats.streak_days,
  };

  const toUnlock: { id: string; xpReward: number; slug: string }[] = [];

  for (const achievement of catalog) {
    if (unlocked.has(achievement.slug)) continue;

    const cond = achievement.condition_json;
    let earned = false;

    switch (cond.type) {
      case 'wpm_milestone': earned = context.currentWpm >= cond.threshold; break;
      case 'accuracy_milestone': earned = context.accuracy >= cond.threshold; break;
      case 'sessions_count': earned = context.totalSessions >= cond.threshold; break;
      case 'streak_days': earned = context.streakDays >= cond.threshold; break;
    }

    if (earned) toUnlock.push({ id: achievement.id, xpReward: achievement.xp_reward, slug: achievement.slug });
  }

  if (!toUnlock.length) return;

  // Insert unlocked achievements and add XP
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const a of toUnlock) {
      await client.query(
        `INSERT INTO user_achievements (user_id, achievement_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, a.id],
      );
      await client.query(
        `UPDATE user_statistics SET xp = xp + $1 WHERE user_id = $2`,
        [a.xpReward, userId],
      );
      logger.info({ userId, slug: a.slug, xp: a.xpReward }, 'Achievement unlocked');
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function startAchievementWorker(): Worker {
  const worker = new Worker<AchievementJobPayload>(
    QUEUES.ACHIEVEMENTS,
    processAchievements,
    { connection: redis, concurrency: 5, stalledInterval: 300000 },
  );
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err }, 'achievementWorker failed'),
  );
  logger.info('achievementWorker started');
  return worker;
}
