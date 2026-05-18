import { Worker, Job } from 'bullmq';
import { redis }  from '../config/redis';
import { pool }   from '../config/database';
import { QUEUES } from '../config/bullmq';
import { logger } from '../utils/logger';
import type { StreakJobPayload } from '../config/bullmq';

async function processStreak(job: Job<StreakJobPayload>): Promise<void> {
  const { userId } = job.data;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { rows } = await pool.query(
    'SELECT current_streak, longest_streak, last_active_date FROM user_streaks WHERE user_id=$1',
    [userId],
  );

  let current = 0;
  let longest = 0;
  let lastDate: string | null = null;

  if (rows.length) {
    current  = rows[0].current_streak;
    longest  = rows[0].longest_streak;
    lastDate = rows[0].last_active_date?.toISOString().slice(0, 10) ?? null;
  }

  // Already updated today — idempotent
  if (lastDate === today) return;

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const newStreak = lastDate === yesterday ? current + 1 : 1;
  const newLongest = Math.max(longest, newStreak);

  await pool.query(
    `INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_active_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       current_streak   = $2,
       longest_streak   = $3,
       last_active_date = $4`,
    [userId, newStreak, newLongest, today],
  );

  // Sync streak to user_statistics
  await pool.query(
    'UPDATE user_statistics SET streak_days=$1 WHERE user_id=$2',
    [newStreak, userId],
  );

  logger.info({ userId, streak: newStreak }, 'Streak updated');
}

export function startStreakWorker(): Worker {
  const worker = new Worker<StreakJobPayload>(
    QUEUES.STREAKS,
    processStreak,
    { connection: redis, concurrency: 10 },
  );
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err }, 'streakWorker failed'),
  );
  logger.info('streakWorker started');
  return worker;
}
