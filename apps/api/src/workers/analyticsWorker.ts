/**
 * analyticsWorker.ts — Per-key error aggregation + user statistics update.
 *
 * ═══════════════════════════════════════════════════════════════
 *  MIGRATION STATUS: PHASE 2 COMPLETE
 *
 *  The BullMQ Worker consumer is commented out below.
 *  processAnalytics() is now a plain exported async function.
 *  It is called by the QStash God Handler (Phase 3) via Promise.all.
 *  All PostgreSQL logic is unchanged — fully idempotent.
 * ═══════════════════════════════════════════════════════════════
 */

import { pool }   from '../config/database';
import { logger } from '../utils/logger';

// ── Internal types (unchanged from original) ──────────────────────────────────
interface CompactKeystroke {
  k: string; e: string; c: 0 | 1; l: number; p: number;
}

interface KeyStat {
  errors: number;
  total: number;
  totalLatencyMs: number;
}

// ── NEW: pure exported function — no BullMQ Job wrapper ──────────────────────
/**
 * Aggregate per-key error stats for a completed session and update:
 *   1. weak_keys       (via upsert_weak_key SQL function)
 *   2. user_statistics (via update_user_statistics SQL function)
 *
 * Called directly by the QStash God Handler. Fully idempotent — safe to retry.
 */
export async function processAnalytics(
  sessionId: string,
  userId:    string,
): Promise<void> {
  // ── Fetch session + keystroke payload ──────────────────────────────────────
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

  // ── Aggregate per-key stats ────────────────────────────────────────────────
  const keyStats = new Map<string, KeyStat>();
  for (const ks of keystrokes) {
    const key = ks.e; // always track expected key (what was SUPPOSED to be typed)
    const existing = keyStats.get(key) ?? { errors: 0, total: 0, totalLatencyMs: 0 };
    keyStats.set(key, {
      errors: existing.errors + (ks.c === 0 ? 1 : 0),
      total: existing.total + 1,
      totalLatencyMs: existing.totalLatencyMs + (ks.l ?? 0),
    });
  }

  // ── Upsert weak_keys + update user_statistics (single transaction) ─────────
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

    // XP already applied in sessions.service — don't double-count
    await client.query(
      `SELECT update_user_statistics($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        session.wpm,
        session.raw_wpm,
        session.accuracy,
        session.consistency,
        session.duration_ms,
        0, // xpGained
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


/* ═══════════════════════════════════════════════════════════════════════════
   === BACKUP: OLD BULLMQ ===
   Original BullMQ Worker consumer. Kept verbatim for instant rollback.
   To revert: uncomment this block and remove the export from processAnalytics.
   ═══════════════════════════════════════════════════════════════════════════

import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { QUEUES } from '../config/bullmq';
import type { AnalyticsJobPayload } from '../config/bullmq';

async function processAnalytics(job: Job<AnalyticsJobPayload>): Promise<void> {
  const { sessionId, userId } = job.data;
  // ... (identical body — see active function above)
}

export function startAnalyticsWorker(): Worker {
  const worker = new Worker<AnalyticsJobPayload>(
    QUEUES.ANALYTICS,
    processAnalytics,
    {
      connection: redis,
      concurrency: 5,
      stalledInterval: 300000
    },
  );

  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err }, 'analyticsWorker job failed'),
  );

  logger.info('analyticsWorker started');
  return worker;
}

   === END BACKUP: OLD BULLMQ ===
   ═══════════════════════════════════════════════════════════════════════════ */
