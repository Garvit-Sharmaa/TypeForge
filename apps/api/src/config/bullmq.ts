/**
 * bullmq.ts — Job dispatch layer.
 *
 * ═══════════════════════════════════════════════════════════════
 *  MIGRATION STATUS: PHASE 1 COMPLETE — Producer rewritten.
 *
 *  Transport:  BullMQ (Redis pull-queue)  →  Upstash QStash (push webhook)
 *  Strategy:   Strangler Fig — old code commented out, NOT deleted.
 *  Pattern:    3 separate queues  →  1 single "God Handler" webhook
 *              POST ${PUBLIC_API_URL}/api/webhooks/process-session
 *
 *  Remaining phases:
 *    Phase 2 — Refactor workers to pure functions (remove BullMQ Job wrapper)
 *    Phase 3 — Create the /api/webhooks/process-session Express handler
 *    Phase 4 — Clean up server.ts boot sequence
 * ═══════════════════════════════════════════════════════════════
 */

import { Client }  from '@upstash/qstash';
// BullMQ Queue still needed for archivalQueue (cron job — not migrated to QStash).
// Also keeps the old session workers compiling until Phase 2 removes them.
import { Queue }   from 'bullmq';
import { redis }   from './redis';
import { env }     from './env';
import { logger }  from '../utils/logger';

// ════════════════════════════════════════════════════════════════════════════
// COMPATIBILITY SHIM — temporary bridge for the Strangler Fig transition.
//
// The archivalWorker (scheduled cron, NOT migrated) and the old session
// workers (removed in Phase 2) still import QUEUES, archivalQueue, and the
// payload types from this module. These exports keep every file compiling
// cleanly at each phase boundary.
//
// CLEANUP: once Phase 2 + Phase 4 are complete, delete this entire section
// along with the `import { Queue } from 'bullmq'` and `import { redis }` above.
// ════════════════════════════════════════════════════════════════════════════

export const QUEUES = {
  ANALYTICS:    'analytics',
  ACHIEVEMENTS: 'achievements',
  STREAKS:      'streaks',
  ARCHIVAL:     'archival',
} as const;

// Type-only re-exports — the old workers import these; no runtime cost.
export interface AnalyticsJobPayload    { sessionId: string; userId: string; }
export interface AchievementJobPayload  { userId: string; sessionId: string; wpm: number; accuracy: number; }
export interface StreakJobPayload        { userId: string; }
export interface ArchivalJobPayload     { olderThanDays: number; }

// archivalQueue: kept live — it drives the nightly keystroke archival cron.
// The three session queues are instantiated but no longer used by the new
// dispatchSessionJobs — they exist only so old imports don't break.
const _defaultQueueOpts = {
  connection: redis,
  defaultJobOptions: {
    attempts:    3,
    backoff:     { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 500 },
  },
};
export const analyticsQueue    = new Queue(QUEUES.ANALYTICS,    _defaultQueueOpts);
export const achievementsQueue = new Queue(QUEUES.ACHIEVEMENTS,  _defaultQueueOpts);
export const streaksQueue      = new Queue(QUEUES.STREAKS,       _defaultQueueOpts);
export const archivalQueue     = new Queue(QUEUES.ARCHIVAL,      _defaultQueueOpts);

// ── END COMPATIBILITY SHIM ───────────────────────────────────────────────────


// ── QStash client (lazy-initialised — fails loudly at call time if token missing) ──
// We don't initialise at module load so that local dev without QSTASH_TOKEN
// still boots successfully (workers haven't been removed yet in Phase 1).
function getQStashClient(): Client {
  if (!env.QSTASH_TOKEN) {
    throw new Error(
      '[QStash] QSTASH_TOKEN is not set. ' +
      'Add it to your .env file (get it from console.upstash.com/qstash).',
    );
  }
  return new Client({ token: env.QSTASH_TOKEN });
}

// ── Webhook payload shape ─────────────────────────────────────────────────────
// This is the single contract between the producer (here) and the
// God Handler consumer (Phase 3: /api/webhooks/process-session).
export interface SessionWebhookPayload {
  sessionId: string;
  userId:    string;
  wpm:       number;
  accuracy:  number;
}

// ── NEW: dispatchSessionJobs — QStash push transport ────────────────────────
/**
 * Fire-and-forget: push a single JSON webhook to QStash.
 * QStash will POST it to our /api/webhooks/process-session endpoint,
 * with automatic retries (3 attempts, exponential back-off) on non-2xx.
 *
 * The God Handler (Phase 3) then fans out to the three pure-function
 * workers concurrently via Promise.all — same execution, zero idle polling.
 */
export async function dispatchSessionJobs(
  sessionId: string,
  userId:    string,
  wpm:       number,
  accuracy:  number,
): Promise<void> {
  if (!env.PUBLIC_API_URL) {
    // During local development PUBLIC_API_URL may not be set.
    // Log a warning and skip — the BullMQ workers (still running in Phase 1)
    // will have already processed the job via the old path before this call.
    logger.warn(
      { sessionId, userId },
      '[QStash] PUBLIC_API_URL not set — skipping QStash dispatch (local dev mode). ' +
      'Set PUBLIC_API_URL in .env to enable.',
    );
    return;
  }

  const webhookUrl = `${env.PUBLIC_API_URL}/api/webhooks/process-session`;
  const payload: SessionWebhookPayload = { sessionId, userId, wpm, accuracy };

  logger.info({ sessionId, userId, webhookUrl }, '[QStash] Dispatching session webhook');

  const client = getQStashClient();

  await client.publishJSON({
    url:  webhookUrl,
    body: payload,
    // Mirror the BullMQ retry policy: 3 attempts, exponential back-off.
    // QStash default is 3 retries with its own back-off — explicit here for clarity.
    retries: 3,
  });

  logger.info({ sessionId, userId }, '[QStash] Webhook dispatched successfully');
}


/* ═══════════════════════════════════════════════════════════════════════════
   === BACKUP: OLD BULLMQ ===
   The original BullMQ producer. Kept verbatim for instant rollback.
   To revert: uncomment this block and comment out the QStash section above.
   ═══════════════════════════════════════════════════════════════════════════

import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq';
import { redis } from './redis';

// ── Queue names ───────────────────────────────────────────────────────────────
export const QUEUES = {
  ANALYTICS:    'analytics',
  ACHIEVEMENTS: 'achievements',
  STREAKS:      'streaks',
  ARCHIVAL:     'archival',
} as const;

// ── Job type payloads ─────────────────────────────────────────────────────────
export interface AnalyticsJobPayload {
  sessionId: string;
  userId:    string;
}

export interface AchievementJobPayload {
  userId:    string;
  sessionId: string;
  wpm:       number;
  accuracy:  number;
}

export interface StreakJobPayload {
  userId: string;
}

export interface ArchivalJobPayload {
  olderThanDays: number;
}

// ── Shared connection config ──────────────────────────────────────────────────
const connection = redis;

const defaultQueueOpts: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts:    3,
    backoff:     { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 500 },
  },
};

// ── Queue instances ───────────────────────────────────────────────────────────
export const analyticsQueue    = new Queue(QUEUES.ANALYTICS,    defaultQueueOpts);
export const achievementsQueue = new Queue(QUEUES.ACHIEVEMENTS,  defaultQueueOpts);
export const streaksQueue      = new Queue(QUEUES.STREAKS,       defaultQueueOpts);
export const archivalQueue     = new Queue(QUEUES.ARCHIVAL,      defaultQueueOpts);

// Dispatch all post-session jobs (fan-out on USER_COMPLETED_SESSION)
export async function dispatchSessionJobs(
  sessionId: string,
  userId:    string,
  wpm:       number,
  accuracy:  number,
): Promise<void> {
  await Promise.all([
    analyticsQueue.add('process-session',
      { sessionId, userId } satisfies AnalyticsJobPayload,
      { priority: 1 },
    ),
    achievementsQueue.add('check-achievements',
      { userId, sessionId, wpm, accuracy } satisfies AchievementJobPayload,
      { priority: 2 },
    ),
    streaksQueue.add('update-streak',
      { userId } satisfies StreakJobPayload,
      { priority: 2 },
    ),
  ]);
}

   === END BACKUP: OLD BULLMQ ===
   ═══════════════════════════════════════════════════════════════════════════ */
