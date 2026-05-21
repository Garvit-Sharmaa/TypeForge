/**
 * lessons.service.ts — Business logic for lesson retrieval and text generation.
 */

import { pool }              from '../../config/database';
import { MASTER_DICTIONARY } from '../../data/dictionary';
import {
  CURRICULUM,
  getLessonById,
  getLessonsWithLockStatus,
} from '../../services/lesson/curriculum';
import { generateSessionPayload } from '../../services/lesson/generationEngine';
import { createError }           from '../../middleware/errorHandler';
import type { LessonConfig }     from '@typing-master/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LessonListItem {
  id:            string;
  name:          string;
  description:   string;
  stage:         number;
  targetKeys:    string[];
  allowedCount:  number;    // length of allowedKeys — useful for progress UI
  baseDifficulty:number;
  wordCount:     number;
  locked:        boolean;
}

export interface GeneratedPayload {
  lessonId:          string;
  text:              string;
  words:             string[];
  wordCount:         number;
  targetKeysCovered: string[];
  weakKeysCovered:   string[];
  config: {
    allowedKeys:   string[];
    targetKeys:    string[];
    baseDifficulty:number;
  };
}

// ── Fetch user's weak key characters from the DB ──────────────────────────────
async function getUserWeakKeyChars(userId: string): Promise<string[]> {
  try {
    const { rows } = await pool.query<{ key_char: string }>(
      `SELECT key_char
         FROM weak_keys
        WHERE user_id = $1
          AND error_rate > 0.05        -- only keys with meaningful error rate
        ORDER BY error_rate DESC
        LIMIT 10`,
      [userId],
    );
    return rows.map((r) => r.key_char);
  } catch {
    // Non-fatal — new users have no weak key data
    return [];
  }
}

// ── Derive the user's max completed stage from lesson progress table ──────────
// Reads from user_lesson_progress (migration 008) which stores TEXT slugs.
// This avoids the broken UUID FK on typing_sessions.lesson_id.
async function getUserMaxStage(userId: string): Promise<number> {
  try {
    const lessonIds = CURRICULUM.map((l) => l.id);
    const { rows } = await pool.query<{ lesson_slug: string }>(
      `SELECT lesson_slug
         FROM user_lesson_progress
        WHERE user_id     = $1
          AND lesson_slug = ANY($2::text[])`,
      [userId, lessonIds],
    );
    const completedSlugs = new Set(rows.map((r) => r.lesson_slug));
    // Sentinel MUST be -1, not 0.
    // Lesson 1 has stage=0. Starting at 0 makes "nothing done" and "L1 done"
    // indistinguishable — getLessonsWithLockStatus(0) runs for both cases,
    // so the L2 lock state never changes after completing L1.
    // With -1: fresh user → only L1 unlocked (stage 0 > -1+1 is false ✓).
    // After L1 done: maxStage=0 → L2 unlocked (stage 1 > 0+1 is false ✓).
    let maxStage = -1;
    for (const lesson of CURRICULUM) {
      if (completedSlugs.has(lesson.id)) maxStage = lesson.stage ?? 0;
    }
    return maxStage;
  } catch {
    return -1; // default: only lesson 1 unlocked (stage 0 > -1+1 is false)
  }
}


// ── Public service functions ──────────────────────────────────────────────────

/** Return the full curriculum with per-user lock status. */
export async function listLessons(userId?: string): Promise<LessonListItem[]> {
  // Use -1 (not 0) as the "nothing completed" sentinel — consistent with
  // getUserMaxStage(). Lesson 1 has stage=0; maxStage=0 would incorrectly
  // unlock Lesson 2 for guests (1 > 0+1 is false). With -1, only L1 is
  // unlocked for guests (0 > 0 is false; 1 > 0 is true → locked ✓).
  const maxStage = userId ? await getUserMaxStage(userId) : -1;
  const withLock = getLessonsWithLockStatus(maxStage);

  return withLock.map((l) => ({
    id:             l.id,
    name:           l.name,
    description:    l.description ?? '',
    stage:          l.stage ?? 0,
    targetKeys:     l.targetKeys,
    allowedCount:   l.allowedKeys.length,
    baseDifficulty: l.baseDifficulty,
    wordCount:      l.wordCount ?? 25,
    locked:         l.locked,
  }));
}

/** Generate an adaptive practice session for a specific lesson. */
export async function generateLesson(
  lessonId: string,
  userId:   string,
): Promise<GeneratedPayload> {
  const config = getLessonById(lessonId);
  if (!config) {
    throw createError(`Lesson "${lessonId}" not found`, 404, 'LESSON_NOT_FOUND');
  }

  // Fetch user-specific weak keys for adaptive weighting
  const weakKeyChars = await getUserWeakKeyChars(userId);

  // For lesson 10 (mastery), treat ALL weak keys as target keys
  // by ensuring the weak pool is populated even when targetKeys is empty.
  const effectiveConfig: LessonConfig =
    config.targetKeys.length === 0 && weakKeyChars.length > 0
      ? { ...config, targetKeys: weakKeyChars }
      : config;

  const result = generateSessionPayload({
    config:       effectiveConfig,
    dictionary:   MASTER_DICTIONARY as string[],
    weakKeyChars,
  });

  return {
    lessonId:          result.lessonId,
    text:              result.text,
    words:             result.words,
    wordCount:         result.words.length,
    targetKeysCovered: result.targetKeysCovered,
    weakKeysCovered:   result.weakKeysCovered,
    config: {
      allowedKeys:    config.allowedKeys,
      targetKeys:     config.targetKeys,
      baseDifficulty: config.baseDifficulty,
    },
  };
}
