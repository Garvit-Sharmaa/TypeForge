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

/** Dispatch all post-session jobs (fan-out on USER_COMPLETED_SESSION) */
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
