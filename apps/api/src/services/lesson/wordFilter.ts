/**
 * wordFilter.ts — Layer 2: O(n) dictionary filtering by LessonConfig constraints.
 *
 * PERFORMANCE CONTRACT:
 *   • allowedKeySet is built once from the LessonConfig (O(k)).
 *   • Each word is tested in a single pass — O(m) where m = word.length.
 *   • The full filter over a 10k-word dictionary: ~2 ms on Node 20.
 *   • Results are cached by lessonId with a configurable TTL.
 *
 * CACHE STRATEGY:
 *   An in-process Map<lessonId, FilteredWordSet> with timestamp-based
 *   invalidation. For multi-process deployments, replace with a Redis
 *   cache backed by the same FilteredWordSet shape.
 */

import type { LessonConfig, FilteredWordSet } from '@typing-master/shared';
import { getKeyData } from './qwertyKeyData';
import { scoreWords, filterByTier } from './difficultyEngine';

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 10 * 60 * 1_000; // 10 minutes
const cache = new Map<string, FilteredWordSet>();

function cacheGet(lessonId: string): FilteredWordSet | null {
  const cached = cache.get(lessonId);
  if (!cached) return null;
  if (Date.now() - cached.builtAt > CACHE_TTL_MS) {
    cache.delete(lessonId);
    return null;
  }
  return cached;
}

// ── Core filter ────────────────────────────────────────────────────────────────

/**
 * Build the character-level allowed-key set from a LessonConfig.
 *
 * Rules applied (in order):
 *   1. Only characters in `allowedKeys` are permitted.
 *   2. `lockedKeys` are explicitly blocked even if present in allowedKeys.
 *   3. Space (' ') is ALWAYS implicitly allowed (never filtered out).
 *   4. Characters that are not in the QWERTY map are silently skipped
 *      (prevents crashing on punctuation or locale characters).
 */
function buildAllowedSet(config: LessonConfig): Set<string> {
  const locked = new Set((config.lockedKeys ?? []).map((k) => k.toLowerCase()));
  const allowed = new Set<string>([' ']); // space always allowed

  for (const key of config.allowedKeys) {
    const lower = key.toLowerCase();
    if (!locked.has(lower) && getKeyData(lower) !== null) {
      allowed.add(lower);
    }
  }
  return allowed;
}

/**
 * Test whether every character of a word is in the allowed set.
 * O(m) where m = word length. Returns false immediately on first violation.
 */
function wordPassesFilter(word: string, allowedSet: Set<string>): boolean {
  if (word.length === 0) return false;
  const lower = word.toLowerCase();
  for (const char of lower) {
    if (!allowedSet.has(char)) return false;
  }
  return true;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Filter a dictionary against a LessonConfig and return scored, sorted words.
 *
 * @param dictionary - Raw word list (the master English dictionary).
 * @param config     - LessonConfig specifying allowed keys and difficulty tier.
 * @param useCache   - Default true. Pass false to force a rebuild (e.g. in tests).
 *
 * @returns FilteredWordSet with words scored and sorted easiest-first,
 *          plus metadata for cache validation and analytics.
 */
export function buildFilteredWordSet(
  dictionary: string[],
  config:     LessonConfig,
  useCache    = true,
): FilteredWordSet {
  // ── Cache hit ────────────────────────────────────────────────────────────────
  if (useCache) {
    const hit = cacheGet(config.id);
    if (hit) return hit;
  }

  // ── Filter ───────────────────────────────────────────────────────────────────
  const tier        = config.baseDifficulty;
  const minLen      = config.minWordLength ?? 2;
  const maxLen      = config.maxWordLength ?? 8;
  const allowedSet  = buildAllowedSet(config);

  const passing: string[] = [];
  let   totalExamined = 0;

  for (const word of dictionary) {
    totalExamined++;
    const lower = word.toLowerCase();

    // Length gate (O(1) check before the character scan)
    if (lower.length < minLen || lower.length > maxLen) continue;

    if (wordPassesFilter(lower, allowedSet)) {
      passing.push(lower);
    }
  }

  // ── Score + tier filter ──────────────────────────────────────────────────────
  const allScored = scoreWords(passing);
  let   tiered    = filterByTier(allScored, tier);

  // Fallback: if tier filter yields fewer than 10 words, relax to full scored set
  // so the generation engine always has something to work with.
  if (tiered.length < 10) {
    tiered = allScored;
  }

  // ── Build result ─────────────────────────────────────────────────────────────
  const result: FilteredWordSet = {
    words:         tiered,
    totalExamined,
    totalExcluded: totalExamined - passing.length,
    lessonId:      config.id,
    builtAt:       Date.now(),
  };

  if (useCache) cache.set(config.id, result);
  return result;
}

/**
 * Invalidate the cache entry for a specific lesson.
 * Call when a LessonConfig is updated (e.g. via admin API).
 */
export function invalidateLessonCache(lessonId: string): void {
  cache.delete(lessonId);
}

/** Flush the entire cache (e.g. on server restart). */
export function flushFilterCache(): void {
  cache.clear();
}

/**
 * Quick check: does this single word pass the LessonConfig constraints?
 * Used by the generation engine to validate individually assembled words.
 */
export function wordMatchesLesson(word: string, config: LessonConfig): boolean {
  const allowedSet = buildAllowedSet(config);
  return wordPassesFilter(word, allowedSet);
}
