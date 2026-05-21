/**
 * server.ts — Entry point for the Node.js API.
 *
 * ═══════════════════════════════════════════════════════════════
 *  MIGRATION STATUS: PHASE 4 COMPLETE — All four phases done.
 *
 *  Post-migration startup sequence:
 *    1. Validate env (crash fast on bad config)
 *    2. Connect to PostgreSQL
 *    3. Connect to Redis (still required for archival BullMQ cron)
 *    4. Start archival BullMQ worker + schedule nightly cron
 *    5. Start HTTP server (webhook endpoint live at /api/webhooks)
 *    6. Graceful shutdown
 *
 *  Session worker fate (analytics / achievements / streaks):
 *    Removed from this boot sequence. They are now stateless pure
 *    functions in their respective worker files, invoked on-demand
 *    by the QStash God Handler at POST /api/webhooks/process-session.
 *    No polling, no idle Redis connections for session jobs.
 *
 *  What still uses BullMQ / Redis:
 *    - archivalWorker: nightly keystroke-payload archival cron (02:00 UTC)
 *    - Redis is kept alive solely for this purpose.
 *    - If archival is later migrated to a cron-as-a-service (e.g. QStash
 *      scheduled messages), Redis and BullMQ can be removed entirely.
 * ═══════════════════════════════════════════════════════════════
 */

import { env }                    from './config/env';
import { checkDatabaseConnection } from './config/database';
import { checkRedisConnection }   from './config/redis';
import { archivalQueue }          from './config/bullmq';
import { createApp }              from './app';
import { logger }                 from './utils/logger';
import { startArchivalWorker }    from './workers/archivalWorker';

/* === BACKUP: OLD BULLMQ — session workers removed in Phase 2 ================
   These are now stateless pure functions called by the QStash God Handler.
   To revert: uncomment here AND restore the start*Worker() exports in each
   worker file (see the BACKUP blocks inside each worker).

import { startAnalyticsWorker }   from './workers/analyticsWorker';
import { startAchievementWorker } from './workers/achievementWorker';
import { startStreakWorker }       from './workers/streakWorker';
=== END BACKUP ================================================================ */

async function bootstrap(): Promise<void> {
  logger.info(`🚀 Booting TypingMaster API [${env.NODE_ENV}]`);

  // ── 1. PostgreSQL ──────────────────────────────────────────────────────────
  await checkDatabaseConnection();

  // ── 2. Redis (required for archival BullMQ cron only) ────────────────────
  // Session job workers (analytics / achievements / streaks) no longer poll
  // Redis — they are invoked directly by the QStash webhook. Redis stays alive
  // exclusively for the nightly archival scheduled job below.
  await checkRedisConnection();

  // ── 3. Archival worker + nightly cron ────────────────────────────────────
  // This is the ONLY BullMQ worker still active after the QStash migration.
  // It nulls out keystroke_payload on sessions older than 30 days to keep
  // the typing_sessions table lean (data already aggregated into weak_keys).
  startArchivalWorker();

  await archivalQueue.add(
    'nightly-archival',
    { olderThanDays: 30 },
    {
      repeat: { pattern: '0 2 * * *' }, // 02:00 UTC every night
      jobId:  'nightly-archival-singleton', // idempotent — no duplicate jobs
    },
  );

  /* === BACKUP: OLD BULLMQ — session workers no longer started here ==========
  startAnalyticsWorker();
  startAchievementWorker();
  startStreakWorker();
  === END BACKUP ============================================================== */

  // ── 4. HTTP server ────────────────────────────────────────────────────────
  // The QStash webhook endpoint is live at POST /api/webhooks/process-session
  // the moment the server starts accepting connections.
  const app  = createApp();
  const port = env.API_PORT;

  const server = app.listen(port, () => {
    logger.info(`✅ API server listening on http://localhost:${port}`);
    logger.info(`✅ QStash webhook ready at POST http://localhost:${port}/api/webhooks/process-session`);
  });

  // ── 5. Graceful shutdown ──────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10 s if graceful shutdown stalls
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Unhandled rejections — log and exit
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
