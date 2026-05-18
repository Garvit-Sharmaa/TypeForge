import { Worker, Job } from 'bullmq';
import { redis }  from '../config/redis';
import { pool }   from '../config/database';
import { QUEUES } from '../config/bullmq';
import { logger } from '../utils/logger';
import type { ArchivalJobPayload } from '../config/bullmq';

/**
 * archivalWorker
 *
 * Enforces the keystroke archival policy:
 *   — keystroke_payload is kept for 30 days (configurable)
 *   — After 30 days, the payload is NULLed (data is already in weak_keys)
 *   — This runs as a scheduled job (nightly via Bull's repeat)
 *
 * This keeps the typing_sessions table lean over time.
 */
async function processArchival(job: Job<ArchivalJobPayload>): Promise<void> {
  const { olderThanDays } = job.data;

  const { rowCount } = await pool.query(
    `UPDATE typing_sessions
     SET    keystroke_payload = NULL,
            payload_archived  = true
     WHERE  payload_archived  = false
       AND  keystroke_payload IS NOT NULL
       AND  completed_at < NOW() - INTERVAL '${olderThanDays} days'
     RETURNING id`,
  );

  logger.info({ archivedCount: rowCount, olderThanDays }, 'Archival complete');
}

export function startArchivalWorker(): Worker {
  const worker = new Worker<ArchivalJobPayload>(
    QUEUES.ARCHIVAL,
    processArchival,
    { connection: redis, concurrency: 1 },
  );
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err }, 'archivalWorker failed'),
  );
  logger.info('archivalWorker started');
  return worker;
}
