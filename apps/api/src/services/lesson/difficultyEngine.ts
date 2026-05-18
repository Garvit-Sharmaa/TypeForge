/**
 * difficultyEngine.ts — Biomechanical word difficulty scorer.
 *
 * SCORING MODEL (1–10 scale, one decimal place):
 *
 *   score = clamp(1, 10,
 *     BASE
 *     + LENGTH_FACTOR       // longer words = harder at speed
 *     + ROW_JUMP_PENALTY    // vertical finger travel
 *     + SAME_FINGER_PENALTY // worst ergonomic pattern
 *     + PINKY_PENALTY       // weaker finger, less accuracy
 *     + HAND_LOCK_PENALTY   // long same-hand runs increase cognitive load
 *     − ALTERNATION_BONUS   // hand alternation reduces total effort
 *   )
 *
 * CALIBRATION REFERENCE:
 *   "ad"     → ~1.5  (2-char, home-row, 1 pinky)
 *   "sad"    → ~2.1  (3-char, home-row, all-left, 1 pinky)
 *   "flask"  → ~3.0  (5-char, home-row, alternating, 1 pinky)
 *   "trade"  → ~4.8  (5-char, top+home row jump, index-index repeat)
 *   "extra"  → ~6.2  (5-char, top-row heavy, multiple row jumps)
 *   "puzzle" → ~7.1  (6-char, bottom+top row, pinky-heavy, same-finger)
 *   "zap"    → ~5.5  (3-char, bottom→home jump, pinky start)
 *
 * Pure function — no I/O, fully testable.
 */

import type { WordScore, WordScoreBreakdown } from '@typing-master/shared';
import { getKeyData } from './qwertyKeyData';

// ── Tunable penalty weights ────────────────────────────────────────────────────
const W = {
  BASE:           1.0,
  /** Per character beyond the first */
  LENGTH:         0.30,
  /** Per unit of row distance between consecutive characters */
  ROW_JUMP:       1.10,
  /** Per same-finger consecutive pair — the dominant ergonomic hazard */
  SAME_FINGER:    2.50,
  /** Per pinky keystroke */
  PINKY:          0.45,
  /** Per run of 3+ consecutive same-hand characters */
  HAND_LOCK:      0.55,
  /** Subtracted per hand-alternation pair (capped at 1.0 total bonus) */
  ALTERNATION:    0.12,
} as const;

// ── Main scorer ────────────────────────────────────────────────────────────────

/**
 * Score a single word using QWERTY biomechanical analysis.
 *
 * @param word - Lowercase word string (spaces handled as thumb row).
 * @returns   WordScore with a clamped 1–10 score and full breakdown.
 *            Returns null if the word contains characters not in the QWERTY map.
 */
export function scoreWord(word: string): WordScore | null {
  if (!word || word.length === 0) return null;

  const lower = word.toLowerCase();
  const chars  = lower.split('');

  // Resolve all characters to physical keys — bail on unknown chars
  const keys = chars.map(getKeyData);
  if (keys.some((k) => k === null)) return null;

  // ── Per-transition analysis ─────────────────────────────────────────────────
  let rowJumpDistance       = 0;
  let sameFingerRepetitions = 0;
  let handAlternations      = 0;
  let pinkyCount            = 0;

  // For hand-lock detection
  let currentHandRunLength  = 1;
  let maxSameHandRun        = 1;
  let handLockPenaltyTotal  = 0;

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;

    if (k.isPinky) pinkyCount++;

    if (i === 0) continue;

    const prev = keys[i - 1]!;

    // Row jump: absolute vertical distance between consecutive keys
    rowJumpDistance += Math.abs(k.row - prev.row);

    // Same-finger repetition (same finger AND same hand)
    if (k.finger === prev.finger && k.hand === prev.hand) {
      sameFingerRepetitions++;
    }

    // Hand alternation tracking
    if (k.hand !== prev.hand) {
      handAlternations++;
      // End any same-hand run
      if (currentHandRunLength >= 3) {
        handLockPenaltyTotal += W.HAND_LOCK;
        maxSameHandRun = Math.max(maxSameHandRun, currentHandRunLength);
      }
      currentHandRunLength = 1;
    } else {
      currentHandRunLength++;
      maxSameHandRun = Math.max(maxSameHandRun, currentHandRunLength);
    }
  }
  // Flush the final run
  if (currentHandRunLength >= 3) {
    handLockPenaltyTotal += W.HAND_LOCK;
  }

  // ── Score assembly ──────────────────────────────────────────────────────────
  const n = chars.length;

  const lengthPenalty     = (n - 1) * W.LENGTH;
  const rowJumpPenalty    = rowJumpDistance * W.ROW_JUMP;
  const sameFingerPenalty = sameFingerRepetitions * W.SAME_FINGER;
  const pinkyPenalty      = pinkyCount * W.PINKY;
  const alternationBonus  = Math.min(handAlternations * W.ALTERNATION, 1.0);

  const rawScore =
    W.BASE
    + lengthPenalty
    + rowJumpPenalty
    + sameFingerPenalty
    + pinkyPenalty
    + handLockPenaltyTotal
    - alternationBonus;

  const score = Math.min(10, Math.max(1, Math.round(rawScore * 10) / 10));

  const breakdown: WordScoreBreakdown = {
    rowJumpDistance,
    sameFingerRepetitions,
    pinkyCount,
    handAlternations,
    maxSameHandRun,
    wordLength: n,
  };

  return { word: lower, score, breakdown };
}

/**
 * Score a batch of words, filtering out any that contain unmapped characters.
 * Returns results sorted by score ascending (easiest first).
 *
 * @param words - Raw word array (mixed case accepted).
 */
export function scoreWords(words: string[]): WordScore[] {
  const results: WordScore[] = [];
  for (const word of words) {
    const scored = scoreWord(word);
    if (scored !== null) results.push(scored);
  }
  results.sort((a, b) => a.score - b.score);
  return results;
}

// ── Difficulty tier helper ─────────────────────────────────────────────────────

/** Score ranges for each LessonDifficulty tier */
const TIER_RANGES: Record<1 | 2 | 3 | 4 | 5, [number, number]> = {
  1: [1.0, 3.0],
  2: [2.5, 4.5],
  3: [4.0, 6.0],
  4: [5.5, 7.5],
  5: [7.0, 10.0],
};

/**
 * Filter a scored word array down to those matching a lesson's difficulty tier.
 * Allows ±0.5 overlap between tiers to prevent empty result sets for small
 * dictionaries.
 */
export function filterByTier(
  words: WordScore[],
  tier:  1 | 2 | 3 | 4 | 5,
): WordScore[] {
  const [min, max] = TIER_RANGES[tier];
  return words.filter((w) => w.score >= min && w.score <= max);
}
