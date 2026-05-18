/**
 * server.ts — Entry point for the Node.js API.
 *
 * Startup sequence:
 *   1. Validate env (crash fast on bad config)
 *   2. Connect to PostgreSQL + Redis
 *   3. Start BullMQ workers
 *   4. Start HTTP server
 *   5. Schedule nightly archival job
 */

import { env }                   from './config/env';
import { checkDatabaseConnection } from './config/database';
import { checkRedisConnection }    from './config/redis';
import { archivalQueue }           from './config/bullmq';
import { createApp }               from './app';
import { logger }                  from './utils/logger';
import { startAnalyticsWorker }    from './workers/analyticsWorker';
import { startAchievementWorker }  from './workers/achievementWorker';
import { startStreakWorker }        from './workers/streakWorker';
import { startArchivalWorker }     from './workers/archivalWorker';

async function bootstrap(): Promise<void> {
  logger.info(`🚀 Booting TypingMaster API [${env.NODE_ENV}]`);

  // ── 1. Validate infrastructure connections ────────────────────────────────
  await checkDatabaseConnection();
  await checkRedisConnection();

  // ── 2. Start BullMQ workers ───────────────────────────────────────────────
  startAnalyticsWorker();
  startAchievementWorker();
  startStreakWorker();
  startArchivalWorker();

  // ── 3. Schedule nightly archival (repeating BullMQ job) ─────────────────
  await archivalQueue.add(
    'nightly-archival',
    { olderThanDays: 30 },
    {
      repeat: { pattern: '0 2 * * *' }, // 02:00 every night
      jobId:  'nightly-archival-singleton', // prevent duplicates
    },
  );

  // ── 4. Start HTTP server ──────────────────────────────────────────────────
  const app  = createApp();
  const port = env.API_PORT;

  const server = app.listen(port, () => {
    logger.info(`✅ API server listening on http://localhost:${port}`);
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
