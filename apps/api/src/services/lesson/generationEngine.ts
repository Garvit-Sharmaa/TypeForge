/**
 * generationEngine.ts — Layer 5 & 6: Adaptive Text Generation.
 *
 * GENERATION STRATEGY:
 *   The output string is assembled from three weighted word pools:
 *
 *   Pool A — TARGET KEY words (40%):
 *     Words that contain at least one of LessonConfig.targetKeys.
 *     These introduce the NEW key the lesson focuses on.
 *
 *   Pool B — WEAK KEY words (25%):
 *     Words containing characters identified as weak in the user's analytics.
 *     Adaptive: increases time-on-key for the user's specific error patterns.
 *     Falls back to Pool A if the user has no weak key data.
 *
 *   Pool C — FILL words (35%):
 *     Remaining filtered words. Maintains flow and prevents repetition.
 *
 * COGNITIVE LOAD CONTROLS:
 *   1. No word is repeated until the full pool has been exhausted (shuffle bag).
 *   2. No more than 2 consecutive same-hand-dominant words.
 *   3. Minimum 2-word gap between occurrences of the same word.
 *   4. Word count: 20–30 (configurable via lessonConfig.wordCount).
 *
 * Pure function — no I/O. Accepts pre-built FilteredWordSet + weak keys list.
 * The router layer is responsible for fetching these inputs.
 */

import type { LessonConfig, FilteredWordSet, WordScore } from '@typing-master/shared';
import { buildFilteredWordSet } from './wordFilter';

// ── Cognitive load constants ───────────────────────────────────────────────────
const DEFAULT_WORD_COUNT        = 25;
const MIN_WORD_COUNT            = 20;
const MAX_WORD_COUNT            = 30;
const MAX_CONSECUTIVE_SAME_HAND = 2;    // max same-hand-dominant words in a row
const MIN_REPEAT_GAP            = 2;    // words between re-use of same word

// ── Pool weights ──────────────────────────────────────────────────────────────
const WEIGHT_TARGET = 0.40;
const WEIGHT_WEAK   = 0.25;
// WEIGHT_FILL = 1 - WEIGHT_TARGET - WEIGHT_WEAK = 0.35

// ── Internal types ────────────────────────────────────────────────────────────
export interface GenerationResult {
  /** Space-joined word string — ready to set as the session text */
  text:           string;
  words:          string[];
  /** IDs of target keys that appear in the generated text */
  targetKeysCovered: string[];
  /** IDs of weak keys that appear in the generated text */
  weakKeysCovered:   string[];
  lessonId:       string;
}

// ── Shuffle (Fisher-Yates) ────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ── Hand-dominance heuristic ──────────────────────────────────────────────────
// A quick proxy based on whether more chars are left-hand or right-hand.
// Used for the MAX_CONSECUTIVE_SAME_HAND constraint.
const LEFT_HAND_CHARS  = new Set('qwertasdfgzxcvb');
const RIGHT_HAND_CHARS = new Set('yuiophjklnm');

function dominantHand(word: string): 'L' | 'R' | 'N' {
  let l = 0, r = 0;
  for (const c of word.toLowerCase()) {
    if (LEFT_HAND_CHARS.has(c))  l++;
    if (RIGHT_HAND_CHARS.has(c)) r++;
  }
  if (l === r || (l === 0 && r === 0)) return 'N';
  return l > r ? 'L' : 'R';
}

// ── Pool builder ──────────────────────────────────────────────────────────────
function buildPools(
  wordScores:   WordScore[],
  targetKeys:   string[],
  weakKeyChars: string[],
): { target: WordScore[]; weak: WordScore[]; fill: WordScore[] } {
  const targetSet = new Set(targetKeys.map((k) => k.toLowerCase()));
  const weakSet   = new Set(weakKeyChars.map((k) => k.toLowerCase()));

  const target: WordScore[] = [];
  const weak:   WordScore[] = [];
  const fill:   WordScore[] = [];

  for (const ws of wordScores) {
    const lower = ws.word.toLowerCase();
    const hasTarget = [...lower].some((c) => targetSet.has(c));
    const hasWeak   = [...lower].some((c) => weakSet.has(c));

    if (hasTarget)       target.push(ws);
    else if (hasWeak)    weak.push(ws);
    else                 fill.push(ws);
  }

  return { target, weak, fill };
}

// ── Shuffle-bag word sampler ──────────────────────────────────────────────────
// Ensures we exhaust each pool before repeating.
class ShuffleBag {
  private bag:     WordScore[];
  private used:    WordScore[] = [];
  private fallback: WordScore[];

  constructor(primary: WordScore[], fallback: WordScore[] = []) {
    this.bag      = shuffle(primary);
    this.fallback = shuffle(fallback);
  }

  draw(): WordScore | null {
    if (this.bag.length === 0) {
      if (this.fallback.length > 0) {
        // Refill from fallback
        this.bag = shuffle(this.fallback);
      } else if (this.used.length > 0) {
        // Refill from used (re-shuffle)
        this.bag  = shuffle(this.used);
        this.used = [];
      } else {
        return null;
      }
    }
    const item = this.bag.pop()!;
    this.used.push(item);
    return item;
  }

  get size() { return this.bag.length + this.used.length; }
}

// ── Main generation function ──────────────────────────────────────────────────

/**
 * Generate an adaptive session text from a pre-built FilteredWordSet.
 *
 * @param config        - LessonConfig for this lesson.
 * @param filteredSet   - Output of buildFilteredWordSet() (may be cached).
 * @param weakKeyChars  - User's weak key characters from analytics
 *                        (e.g. ['a', 'p', 'z']). Pass [] for new users.
 * @returns             GenerationResult with the assembled text.
 */
export function generateSessionText(
  config:       LessonConfig,
  filteredSet:  FilteredWordSet,
  weakKeyChars: string[] = [],
): GenerationResult {
  const wordCount = Math.min(
    MAX_WORD_COUNT,
    Math.max(MIN_WORD_COUNT, config.wordCount ?? DEFAULT_WORD_COUNT),
  );

  const { target, weak, fill } = buildPools(
    filteredSet.words,
    config.targetKeys,
    weakKeyChars,
  );

  // Slot allocation per pool
  const targetSlots = Math.round(wordCount * WEIGHT_TARGET);
  const weakSlots   = Math.round(wordCount * WEIGHT_WEAK);
  const fillSlots   = wordCount - targetSlots - weakSlots;

  // Bags — weak bag falls back to target if weak pool is empty
  const targetBag = new ShuffleBag(target, fill);
  const weakBag   = new ShuffleBag(weak.length > 0 ? weak : target, fill);
  const fillBag   = new ShuffleBag(fill, target);

  // Build ordered plan: [T, T, W, F, T, W, F, ...] interleaved
  type PoolLabel = 'T' | 'W' | 'F';
  const plan: PoolLabel[] = [];
  for (let i = 0; i < wordCount; i++) {
    if (i < targetSlots)                       plan.push('T');
    else if (i < targetSlots + weakSlots)      plan.push('W');
    else                                       plan.push('F');
  }
  // Interleave rather than grouping (sort: T,W,F,T,W,F...)
  const interleaved: PoolLabel[] = [];
  let ti = 0, wi = 0, fi = 0;
  const tArr = plan.filter((p) => p === 'T');
  const wArr = plan.filter((p) => p === 'W');
  const fArr = plan.filter((p) => p === 'F');
  while (ti < tArr.length || wi < wArr.length || fi < fArr.length) {
    if (ti < tArr.length) { interleaved.push('T'); ti++; }
    if (wi < wArr.length) { interleaved.push('W'); wi++; }
    if (fi < fArr.length) { interleaved.push('F'); fi++; }
  }

  // ── Assemble words with cognitive-load constraints ─────────────────────────
  const result:     string[]    = [];
  const recentWords = new Set<string>(); // for MIN_REPEAT_GAP tracking
  const recentQueue: string[]   = [];
  let sameHandCount = 0;
  let lastHand: 'L' | 'R' | 'N' = 'N';

  const getBag = (label: PoolLabel) =>
    label === 'T' ? targetBag : label === 'W' ? weakBag : fillBag;

  for (const label of interleaved) {
    if (result.length >= wordCount) break;

    let candidate: WordScore | null = null;
    const bag = getBag(label);

    // Attempt up to 5 times to satisfy constraints
    for (let attempt = 0; attempt < 5; attempt++) {
      const drawn = bag.draw();
      if (!drawn) break;

      const hand = dominantHand(drawn.word);

      // Repeat-gap constraint
      if (recentWords.has(drawn.word)) continue;

      // Same-hand consecutive constraint
      if (
        hand !== 'N' &&
        hand === lastHand &&
        sameHandCount >= MAX_CONSECUTIVE_SAME_HAND
      ) {
        // Put it back conceptually (we can't with ShuffleBag, but try next)
        continue;
      }

      candidate = drawn;
      lastHand  = hand;
      sameHandCount = (hand !== 'N' && hand === lastHand) ? sameHandCount + 1 : 1;
      break;
    }

    if (!candidate) {
      // Fallback: take anything from fillBag
      candidate = fillBag.draw();
    }
    if (!candidate) continue;

    result.push(candidate.word);

    // Track recent words
    recentQueue.push(candidate.word);
    recentWords.add(candidate.word);
    if (recentQueue.length > MIN_REPEAT_GAP) {
      const oldest = recentQueue.shift()!;
      recentWords.delete(oldest);
    }
  }

  // ── Coverage reporting ─────────────────────────────────────────────────────
  const joined = result.join(' ');
  const targetKeysCovered = config.targetKeys.filter((k) =>
    joined.includes(k.toLowerCase()),
  );
  const weakKeysCovered = weakKeyChars.filter((k) =>
    joined.includes(k.toLowerCase()),
  );

  return {
    text:    joined,
    words:   result,
    targetKeysCovered,
    weakKeysCovered,
    lessonId: config.id,
  };
}

// ── Top-level orchestrator (called by the route handler) ─────────────────────

export interface GeneratePayloadInput {
  config:        LessonConfig;
  dictionary:    string[];
  weakKeyChars?: string[];
}

/**
 * Full pipeline: filter dictionary → score → generate text.
 * Results from buildFilteredWordSet() are cached automatically.
 */
export function generateSessionPayload(
  input: GeneratePayloadInput,
): GenerationResult {
  const { config, dictionary, weakKeyChars = [] } = input;

  // Layer 2: filter + score (uses 10-min TTL cache internally)
  const filteredSet = buildFilteredWordSet(dictionary, config);

  if (filteredSet.words.length === 0) {
    throw new Error(
      `No words available for lesson "${config.id}" with ` +
      `allowedKeys=[${config.allowedKeys.join(',')}]`,
    );
  }

  // Layer 5 & 6: generate adaptive text
  return generateSessionText(config, filteredSet, weakKeyChars);
}
