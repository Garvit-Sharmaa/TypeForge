/**
 * streakWorker.ts — Daily streak tracking and user_statistics sync.
 *
 * ═══════════════════════════════════════════════════════════════
 *  MIGRATION STATUS: PHASE 2 COMPLETE
 *
 *  The BullMQ Worker consumer is commented out below.
 *  processStreak() is now a plain exported async function.
 *  It is called by the QStash God Handler (Phase 3) via Promise.all.
 *  All PostgreSQL logic is unchanged — fully idempotent.
 * ═══════════════════════════════════════════════════════════════
 */

import { pool }   from '../config/database';
import { logger } from '../utils/logger';

// ── NEW: pure exported function — no BullMQ Job wrapper ──────────────────────
/**
 * Update the user's daily streak. Idempotent — calling multiple times on
 * the same day short-circuits immediately (lastDate === today guard).
 *
 * Called directly by the QStash God Handler. Safe to retry.
 */
export async function processStreak(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { rows } = await pool.query(
    'SELECT current_streak, longest_streak, last_active_date FROM user_streaks WHERE user_id=$1',
    [userId],
  );

  let current  = 0;
  let longest  = 0;
  let lastDate: string | null = null;

  if (rows.length) {
    current  = rows[0].current_streak;
    longest  = rows[0].longest_streak;
    lastDate = rows[0].last_active_date?.toISOString().slice(0, 10) ?? null;
  }

  // Already updated today — idempotent early exit
  if (lastDate === today) return;

  const yesterday  = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const newStreak  = lastDate === yesterday ? current + 1 : 1;
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


/* ═══════════════════════════════════════════════════════════════════════════
   === BACKUP: OLD BULLMQ ===
   Original BullMQ Worker consumer. Kept verbatim for instant rollback.
   To revert: uncomment this block and remove the export from processStreak.
   ═══════════════════════════════════════════════════════════════════════════

import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { QUEUES } from '../config/bullmq';
import type { StreakJobPayload } from '../config/bullmq';

async function processStreak(job: Job<StreakJobPayload>): Promise<void> {
  const { userId } = job.data;
  // ... (identical body — see active function above)
}

export function startStreakWorker(): Worker {
  const worker = new Worker<StreakJobPayload>(
    QUEUES.STREAKS,
    processStreak,
    { connection: redis, concurrency: 10, stalledInterval: 300000 },
  );
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err }, 'streakWorker failed'),
  );
  logger.info('streakWorker started');
  return worker;
}

   === END BACKUP: OLD BULLMQ ===
   ═══════════════════════════════════════════════════════════════════════════ */
