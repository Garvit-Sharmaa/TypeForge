/**
 * server.ts — Entry point for the Node.js API.
 *
 * ═══════════════════════════════════════════════════════════════
 *  MIGRATION STATUS: PHASE 5 COMPLETE — BullMQ fully silenced.
 *
 *  Final startup sequence:
 *    1. Validate env (crash fast on bad config)
 *    2. Connect to PostgreSQL
 *    3. Start HTTP server (QStash webhook live at /api/webhooks)
 *    4. Graceful shutdown
 *
 *  Zero Redis connections. Zero BullMQ workers.
 *  All background jobs are now push-driven via Upstash QStash:
 *    POST /api/webhooks/process-session  →  God Handler fan-out
 *
 *  The archival cron (keystroke payload cleanup) is the one remaining
 *  TODO — migrate it to a QStash Scheduled Message or Vercel Cron
 *  to eliminate Redis + BullMQ dependencies entirely:
 *    QStash scheduled:  client.schedules.create({ destination, cron })
 *    Vercel Cron:       vercel.json "crons" + a /api/cron/archival route
 * ═══════════════════════════════════════════════════════════════
 */

import { env }                    from './config/env';
import { checkDatabaseConnection } from './config/database';
import { createApp }              from './app';
import { logger }                 from './utils/logger';

/* === BACKUP: OLD BULLMQ — archival worker silenced in Phase 5 ===============
   Redis is no longer checked on boot. The archival cron is disabled.
   To re-enable: uncomment these imports + the boot block below, then
   also re-enable the Queue instances in bullmq.ts (COMPATIBILITY SHIM).

import { checkRedisConnection }   from './config/redis';
import { archivalQueue }          from './config/bullmq';
import { startArchivalWorker }    from './workers/archivalWorker';
=== END BACKUP ================================================================ */

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

  /* === BACKUP: OLD BULLMQ — Redis + archival cron silenced in Phase 5 ========
     The archival worker (nightly keystroke payload cleanup) was the last
     BullMQ consumer. It is now disabled — no Redis connection is opened.
     TODO: migrate to QStash Scheduled Message or Vercel Cron before
           re-enabling keystroke archival in a zero-Redis architecture.

  // ── 2. Redis (required for archival BullMQ cron only) ──────────────────
  await checkRedisConnection();

  // ── 3. Archival worker + nightly cron ──────────────────────────────────
  startArchivalWorker();

  await archivalQueue.add(
    'nightly-archival',
    { olderThanDays: 30 },
    {
      repeat: { pattern: '0 2 * * *' }, // 02:00 UTC every night
      jobId:  'nightly-archival-singleton',
    },
  );
  === END BACKUP ============================================================== */

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
