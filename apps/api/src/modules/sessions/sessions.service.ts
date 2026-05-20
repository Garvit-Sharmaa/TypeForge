import { PoolClient } from 'pg';
import { pool, withTransaction } from '../../config/database';
import { dispatchSessionJobs }    from '../../config/bullmq';
import { validateSession }        from '../../utils/antiCheat';
import { calculateSessionXp, getRankForXp } from '@typing-master/shared';
import { createError }            from '../../middleware/errorHandler';
import { logger }                 from '../../utils/logger';
import type { SubmitSessionPayload } from './sessions.validator';

// ── Lesson completion thresholds ──────────────────────────────────────────────
const LESSON_PASS_ACCURACY = 80;  // % — adjustable
const LESSON_PASS_WPM      = 10;  // wpm — prevents trivially slow completions

// ── Compact keystroke serialization ───────────────────────────────────────────
interface CompactKeystroke {
  k: string; e: string; c: 0 | 1; l: number; p: number;
}

function compactifyKeystrokes(events: SubmitSessionPayload['keystrokeEvents']): CompactKeystroke[] {
  return events.map((ev) => ({
    k: ev.key, e: ev.expectedKey, c: ev.isCorrect ? 1 : 0,
    l: Math.round(ev.latencyMs), p: ev.position,
  }));
}

// ── Consistency score calculation ─────────────────────────────────────────────
function calculateConsistency(events: SubmitSessionPayload['keystrokeEvents']): number {
  const latencies = events.map((e) => e.latencyMs).filter((l) => l > 0 && l < 2000);
  if (latencies.length < 5) return 0;
  const avg      = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const variance = latencies.reduce((a, b) => a + (b - avg) ** 2, 0) / latencies.length;
  const cv       = Math.sqrt(variance) / avg;
  return Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));
}

// ── Service result type ───────────────────────────────────────────────────────
export interface SubmitSessionResult {
  sessionId:             string;
  xpGained:              number;
  newXp:                 number;
  newLevel:              number;
  leveledUp:             boolean;
  newRank:               string;
  unlockedAchievements:  Array<{ slug: string; xpReward: number }>;
  isFlagged:             boolean;
}

// ── Service: submit session ───────────────────────────────────────────────────
export async function submitSession(
  userId:  string,
  payload: SubmitSessionPayload,
): Promise<SubmitSessionResult> {
  const { results, config, keystrokeEvents } = payload;

  // ── 1. Anti-cheat validation ──────────────────────────────────────────────
  const antiCheatResult = validateSession(payload);
  logger.info({
    userId,
    wpm:       results.wpm,
    accuracy:  results.accuracy,
    anticheat: antiCheatResult,
  }, 'Session submission anti-cheat check');

  // Hard reject only on zero confidence (definitive bots)
  // Soft flag everything else for manual review
  const isFlagged  = !antiCheatResult.passed;
  const flagReason = antiCheatResult.flagReason;

  if (antiCheatResult.confidence === 0 && isFlagged) {
    throw createError(
      'Session rejected: anti-cheat validation failed',
      422,
      'ANTICHEAT_REJECTED',
    );
  }

  // ── 2. Compute derived metrics ────────────────────────────────────────────
  const consistency = calculateConsistency(keystrokeEvents);
  const xpGained    = isFlagged ? 0 : calculateSessionXp({
    wpm:        results.wpm,
    accuracy:   results.accuracy,
    durationMs: results.durationMs,
    mode:       config.mode,
  });

  const compactPayload = compactifyKeystrokes(keystrokeEvents);

  // ── 3. Persist + gamification in one atomic transaction ─────────────────
  const { sessionId, newXp, newLevel, leveledUp, unlockedAchievements } =
    await withTransaction(async (client: PoolClient) => {

      // 3a. Insert session row
      // NOTE: lesson_id column is UUID FK referencing the lessons stub table.
      // Curriculum lesson slugs (e.g. 'lesson-01-home-core') are TEXT identifiers,
      // not UUIDs, so we pass NULL here and track progression separately in
      // user_lesson_progress (migration 008) using the slug directly.
      const { rows: sessionRows } = await client.query<{ id: string }>(
        `INSERT INTO typing_sessions
           (user_id, wpm, raw_wpm, accuracy, consistency, duration_ms,
            mode, language, word_count, correct_words,
            correct_chars, total_chars, is_flagged, flag_reason, keystroke_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id`,
        [
          userId,
          Math.round(results.wpm),
          Math.round(results.rawWpm),
          Math.round(results.accuracy),
          consistency,
          Math.round(results.durationMs),   // safety net: DB column is integer
          config.mode,
          config.language,
          results.totalWords,
          results.correctWords,
          results.correctChars,
          results.totalChars,
          isFlagged, flagReason ?? null, JSON.stringify(compactPayload),
        ],
      );
      const sid = sessionRows[0].id;

      // 3b. Award XP (skip for flagged sessions)
      let newXp    = 0;
      let newLevel = 1;
      let leveledUp = false;

      if (!isFlagged && xpGained > 0) {
        const { rows: xpRows } = await client.query<{
          new_xp: number; new_level: number; leveled_up: boolean;
        }>('SELECT * FROM award_xp($1, $2)', [userId, xpGained]);

        if (xpRows[0]) {
          newXp    = xpRows[0].new_xp;
          newLevel = xpRows[0].new_level;
          leveledUp = xpRows[0].leveled_up;
        }
      } else {
        // Read current XP without modifying
        const { rows: uRows } = await client.query<{ xp: number; level: number }>(
          'SELECT xp, level FROM users WHERE id = $1', [userId],
        );
        newXp    = uRows[0]?.xp    ?? 0;
        newLevel = uRows[0]?.level ?? 1;
      }

      // 3c. Check achievements (non-fatal if it fails)
      let achievements: Array<{ slug: string; xp_reward: number }> = [];
      try {
        const { rows: sCount } = await client.query<{ count: string }>(
          'SELECT COUNT(*) FROM typing_sessions WHERE user_id = $1 AND is_flagged = false',
          [userId],
        );
        const totalSessions = parseInt(sCount[0].count, 10);

        const { rows: achRows } = await client.query<{ slug: string; xp_reward: number }>(
          'SELECT slug, xp_reward FROM check_session_achievements($1, $2, $3, $4)',
          [userId, results.wpm, results.accuracy, totalSessions],
        );
        achievements = achRows;

        // Award XP for newly unlocked achievements
        const achievementXp = achievements.reduce((s, a) => s + a.xp_reward, 0);
        if (achievementXp > 0) {
          const { rows: bonusRows } = await client.query<{ new_xp: number; new_level: number; leveled_up: boolean }>(
            'SELECT * FROM award_xp($1, $2)', [userId, achievementXp],
          );
          if (bonusRows[0]) {
            newXp     = bonusRows[0].new_xp;
            newLevel  = bonusRows[0].new_level;
            leveledUp = leveledUp || bonusRows[0].leveled_up;
          }
        }
      } catch (achErr) {
        logger.warn({ achErr }, 'Achievement check failed (non-fatal)');
      }

      return {
        sessionId: sid,
        newXp,
        newLevel,
        leveledUp,
        unlockedAchievements: achievements.map((a) => ({
          slug: a.slug, xpReward: a.xp_reward,
        })),
      };
    });

  // ── 4. Dispatch async jobs ────────────────────────────────────────────────
  if (!isFlagged || antiCheatResult.confidence > 0.5) {
    await dispatchSessionJobs(sessionId, userId, results.wpm, results.accuracy);
  }

  // ── 5. Lesson progression ─────────────────────────────────────────────────
  // If this was a lesson session that meets the pass threshold, record it
  // in user_lesson_progress. The lessons API reads from this table to derive
  // each user's unlock state. Upsert is idempotent — replaying is safe.
  const lessonSlug = config.lessonId;
  if (
    lessonSlug &&
    !isFlagged &&
    results.accuracy >= LESSON_PASS_ACCURACY &&
    results.wpm      >= LESSON_PASS_WPM
  ) {
    try {
      await pool.query(
        `INSERT INTO user_lesson_progress (user_id, lesson_slug)
         VALUES ($1, $2)
         ON CONFLICT (user_id, lesson_slug) DO NOTHING`,
        [userId, lessonSlug],
      );
      logger.info({ userId, lessonSlug }, 'Lesson progress recorded');
    } catch (progressErr) {
      // Non-fatal: log and continue — don't fail the whole request
      logger.warn({ progressErr, lessonSlug }, 'Failed to record lesson progress (non-fatal)');
    }
  }

  logger.info({
    sessionId, userId, wpm: results.wpm, xpGained,
    newLevel, leveledUp, unlockedAchievements, isFlagged,
  }, 'Session submitted');

  return {
    sessionId, xpGained, newXp, newLevel, leveledUp,
    newRank: getRankForXp(newXp),
    unlockedAchievements,
    isFlagged,
  };
}

// ── Service: get user sessions (paginated) ────────────────────────────────────
export async function getUserSessions(
  userId: string,
  limit   = 20,
  offset  = 0,
): Promise<object[]> {
  const { rows } = await pool.query(
    `SELECT id, wpm, raw_wpm, accuracy, consistency, duration_ms,
            mode, language, correct_words, total_words_count,
            word_count, is_flagged, completed_at
     FROM typing_sessions
     WHERE user_id = $1 AND is_flagged = false
     ORDER BY completed_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  return rows;
}
