/**
 * Lesson.ts — Type contracts for the Phase 3 Lesson Composition Engine.
 * Pure data types — no runtime dependencies.
 */

import type { FingerName, Hand } from './Keyboard';

// ─── Lesson Configuration ─────────────────────────────────────────────────────

/** Difficulty tier for curriculum sequencing */
export type LessonDifficulty = 1 | 2 | 3 | 4 | 5;

/** Hand restriction applied to an entire lesson */
export type HandRestriction = 'left' | 'right' | 'both';

/**
 * LessonConfig — the complete specification for one adaptive lesson.
 *
 * The generation engine uses ONLY this object to:
 *   1. Filter the dictionary (allowedKeys)
 *   2. Score and rank words (via DifficultyEngine)
 *   3. Assemble text with controlled key-frequency distribution (targetKeys)
 */
export interface LessonConfig {
  /** Stable unique identifier — also stored in typing_sessions.lesson_id */
  id: string;

  /** Human-readable lesson name, e.g. "Home Row — Left Hand" */
  name: string;

  description?: string;

  // ── Key Constraints ─────────────────────────────────────────────────────────

  /**
   * Complete set of character keys permitted in generated text.
   * MUST be lowercase. Space (' ') is always implicitly allowed.
   * Example: ['a', 's', 'd', 'f', 'g']
   */
  allowedKeys: string[];

  /**
   * Subset of allowedKeys that are NEW in this lesson.
   * These keys appear more frequently (controlled by targetKeyFrequency).
   * Example: ['g'] when the lesson introduces G to an ASDF base.
   */
  targetKeys: string[];

  /**
   * Keys explicitly excluded even if present in the master dictionary.
   * Used to prevent accidental inclusion of keys from future lessons.
   */
  lockedKeys?: string[];

  // ── Finger Targeting ────────────────────────────────────────────────────────

  /**
   * Which fingers this lesson primarily exercises.
   * Used for UI highlighting and adaptive word selection.
   */
  targetFingers: FingerName[];

  /** Optional hand restriction */
  handRestriction?: HandRestriction;

  // ── Difficulty Parameters ───────────────────────────────────────────────────

  /**
   * Lesson tier (1=beginner → 5=expert).
   * Controls which word score range is selected during generation.
   *   tier 1 → words with score 1.0–3.0
   *   tier 5 → words with score 7.0–10.0
   */
  baseDifficulty: LessonDifficulty;

  /**
   * Fraction of slots in the generated text where a targetKey must appear.
   * Range: 0.0–1.0. Default: 0.4
   * Example: 0.5 means every other word must contain a target key.
   */
  targetKeyFrequency?: number;

  // ── Generation Hints ────────────────────────────────────────────────────────

  /** Number of words to generate per session. Default: 50 */
  wordCount?: number;

  /** Max word length to include. Default: 8 */
  maxWordLength?: number;

  /** Min word length to include. Default: 2 */
  minWordLength?: number;

  /** Curriculum stage index (0-indexed, used for lesson ordering in the UI) */
  stage?: number;
}

// ─── Word Scoring ─────────────────────────────────────────────────────────────

/**
 * Detailed penalty/bonus breakdown for a single word.
 * Exposed so the frontend can explain WHY a word is rated difficult.
 */
export interface WordScoreBreakdown {
  /** Sum of abs(rowA − rowB) for every consecutive character pair */
  rowJumpDistance: number;

  /** Number of consecutive character pairs that use the exact same finger */
  sameFingerRepetitions: number;

  /** Number of keystrokes assigned to a pinky finger */
  pinkyCount: number;

  /**
   * Number of consecutive character pairs where the hand switches.
   * High alternation = more coordination required at speed.
   */
  handAlternations: number;

  /**
   * Longest consecutive same-hand run (≥3 triggers a penalty).
   * e.g. "steward" has a long left-hand run.
   */
  maxSameHandRun: number;

  /** Raw character count — drives the length penalty */
  wordLength: number;
}

/**
 * WordScore — the output of the DifficultyEngine for a single word.
 *
 * The score is on a 1–10 scale where:
 *   1–2  : trivial (short, home-row, common fingers, good alternation)
 *   3–4  : easy    (home-row, moderate length, 1–2 pinky)
 *   5–6  : medium  (some row jumps or same-finger repeats)
 *   7–8  : hard    (multiple row jumps, pinky-heavy, same-finger repeats)
 *   9–10 : expert  (number row, multiple same-finger, long same-hand runs)
 *
 * Reference calibration:
 *   "sad"   → ~2.1  (home row, left-only, 1 pinky, length 3)
 *   "flask" → ~3.2  (home row, alternating, 1 pinky, length 5)
 *   "zip"   → ~5.4  (row jump bottom→home, index-index repeat)
 *   "extra" → ~6.1  (top row, row jumps, 5 chars)
 */
export interface WordScore {
  word: string;

  /**
   * Final difficulty score clamped to [1.0, 10.0], one decimal place.
   * Lower = easier to type accurately at speed.
   */
  score: number;

  /** Itemised penalty breakdown — useful for debugging and UI tooltips */
  breakdown: WordScoreBreakdown;
}

// ─── Filtering Results ────────────────────────────────────────────────────────

/** Result of running the WordFilteringEngine */
export interface FilteredWordSet {
  /** Words that passed the allowedKeys constraint, sorted by score ascending */
  words:          WordScore[];
  /** Total dictionary words examined */
  totalExamined:  number;
  /** Words that were excluded */
  totalExcluded:  number;
  /** LessonConfig.id this set was built for */
  lessonId:       string;
  /** Unix ms timestamp — used to validate the cache */
  builtAt:        number;
}
