/**
 * bullmq.ts — Job dispatch layer.
 *
 * ═══════════════════════════════════════════════════════════════
 *  MIGRATION STATUS: PHASE 5 COMPLETE — BullMQ fully silenced.
 *
 *  This file now contains ONLY:
 *    1. dispatchSessionJobs() — QStash push producer (active)
 *    2. SessionWebhookPayload interface — producer/consumer contract
 *    3. QUEUES const + payload interfaces — kept for archivalWorker.ts import
 *       compatibility (file compiles but startArchivalWorker is disabled)
 *    4. BACKUP blocks for every removed BullMQ component
 *
 *  Zero Redis connections opened by this module.
 * ═══════════════════════════════════════════════════════════════
 */

import { Client }  from '@upstash/qstash';
import { env }     from './env';
import { logger }  from '../utils/logger';

/* === BACKUP: OLD BULLMQ — Queue instances silenced in Phase 5 ===============
   These imports were only needed to instantiate the four Queue objects below.
   Removing them kills the four persistent Redis connections that were
   showing up as 'bull:archival', 'bull:analytics', etc. in Upstash monitor.
   To revert: uncomment these two lines + the Queue instances block below.

import { Queue }   from 'bullmq';
import { redis }   from './redis';
=== END BACKUP ================================================================ */

// ════════════════════════════════════════════════════════════════════════════
// COMPATIBILITY SHIM — import boundary for archivalWorker.ts.
//
// archivalWorker.ts still imports QUEUES and ArchivalJobPayload from this
// module. Those imports must remain live so the file compiles cleanly even
// though startArchivalWorker() is now disabled. If archivalWorker.ts is
// eventually deleted, this entire shim can be removed too.
// ════════════════════════════════════════════════════════════════════════════

export const QUEUES = {
  ANALYTICS:    'analytics',
  ACHIEVEMENTS: 'achievements',
  STREAKS:      'streaks',
  ARCHIVAL:     'archival',
} as const;

// Type-only re-exports — zero runtime cost.
export interface AnalyticsJobPayload    { sessionId: string; userId: string; }
export interface AchievementJobPayload  { userId: string; sessionId: string; wpm: number; accuracy: number; }
export interface StreakJobPayload        { userId: string; }
export interface ArchivalJobPayload     { olderThanDays: number; }

/* === BACKUP: OLD BULLMQ — Queue instances silenced in Phase 5 ===============
   Each `new Queue(...)` call opens a persistent Redis connection that BullMQ
   uses for polling (BRPOP). All four appeared in Upstash Redis monitor.
   The four session queues were already unused; archivalQueue was the last
   active one — silenced here as the final step of the migration.
   To revert: uncomment the opts block + all four Queue lines,
   then also restore the `import { Queue }` and `import { redis }` above.

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
=== END BACKUP ================================================================ */

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
