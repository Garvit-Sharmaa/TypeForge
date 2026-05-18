import { Worker, Job } from 'bullmq';
import { redis }       from '../config/redis';
import { pool }        from '../config/database';
import { QUEUES }      from '../config/bullmq';
import { logger }      from '../utils/logger';
import type { AnalyticsJobPayload } from '../config/bullmq';

/**
 * analyticsWorker
 *
 * Triggered after every completed session.
 * Reads the compact keystroke_payload from the session,
 * aggregates per-key error stats, then updates:
 *   1. weak_keys       (via upsert_weak_key SQL function)
 *   2. user_statistics (via update_user_statistics SQL function)
 *
 * This is a background job — it does NOT block the HTTP response.
 */

interface CompactKeystroke {
  k: string; e: string; c: 0 | 1; l: number; p: number;
}

interface KeyStat {
  errors:        number;
  total:         number;
  totalLatencyMs:number;
}

async function processAnalytics(job: Job<AnalyticsJobPayload>): Promise<void> {
  const { sessionId, userId } = job.data;

  // ── Fetch session + keystroke payload ────────────────────────────────────
  const { rows } = await pool.query(
    `SELECT wpm, raw_wpm, accuracy, consistency, duration_ms,
            keystroke_payload
     FROM typing_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  );

  if (!rows.length) {
    logger.warn({ sessionId }, 'analyticsWorker: session not found');
    return;
  }

  const session = rows[0];
  const keystrokes: CompactKeystroke[] = session.keystroke_payload ?? [];

  // ── Aggregate per-key stats ──────────────────────────────────────────────
  const keyStats = new Map<string, KeyStat>();
  for (const ks of keystrokes) {
    const key     = ks.e; // always track expected key (what was SUPPOSED to be typed)
    const existing = keyStats.get(key) ?? { errors: 0, total: 0, totalLatencyMs: 0 };
    keyStats.set(key, {
      errors:         existing.errors + (ks.c === 0 ? 1 : 0),
      total:          existing.total  + 1,
      totalLatencyMs: existing.totalLatencyMs + (ks.l ?? 0),
    });
  }

  // ── Upsert weak_keys ────────────────────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [keyChar, stat] of keyStats) {
      const avgLatency = stat.total > 0 ? stat.totalLatencyMs / stat.total : 0;
      await client.query(
        `SELECT upsert_weak_key($1, $2, $3, $4, $5)`,
        [userId, keyChar, stat.errors, stat.total, avgLatency],
      );
    }

    // ── Update user_statistics ─────────────────────────────────────────
    const xpGained = 0; // XP already applied in sessions.service — don't double-count
    await client.query(
      `SELECT update_user_statistics($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        session.wpm,
        session.raw_wpm,
        session.accuracy,
        session.consistency,
        session.duration_ms,
        xpGained,
      ],
    );

    await client.query('COMMIT');
    logger.info({ sessionId, userId, keyCount: keyStats.size }, 'Analytics processed');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function startAnalyticsWorker(): Worker {
  const worker = new Worker<AnalyticsJobPayload>(
    QUEUES.ANALYTICS,
    processAnalytics,
    {
      connection:  redis,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err }, 'analyticsWorker job failed'),
  );

  logger.info('analyticsWorker started');
  return worker;
}
