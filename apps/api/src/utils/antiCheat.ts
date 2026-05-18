/**
 * antiCheat.ts — Server-side session validation.
 *
 * Implements three independent checks, each producing a specific flag reason.
 * All checks are O(n) or O(1) — suitable for the hot path of session submission.
 *
 * Future: anomaly scores can be fed into an ML pipeline for soft flagging.
 */

import { ANTI_CHEAT } from '@typing-master/shared';
import type { SessionSubmitPayload } from '@typing-master/shared';

// ── Result type ───────────────────────────────────────────────────────────────
export interface AntiCheatResult {
  passed:      boolean;
  flagReason?: string;
  /** 0-1 confidence that the session is legitimate */
  confidence:  number;
}

// ── Statistical helpers ───────────────────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], avg: number): number {
  const variance = arr.reduce((a, b) => a + (b - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// ── Check 1: Absolute WPM ceiling ────────────────────────────────────────────
function checkWpmCeiling(wpm: number): AntiCheatResult | null {
  if (wpm > ANTI_CHEAT.MAX_BELIEVABLE_WPM) {
    return {
      passed:     false,
      flagReason: `wpm_exceeds_human_limit:${wpm}`,
      confidence: 0,
    };
  }
  return null;
}

// ── Check 2: WPM ↔ chars/time mathematical alignment ─────────────────────────
// A legitimate session must satisfy:
//   correctChars ≈ wpm × 5 × (durationMs / 60_000)
//
// We allow ±30% tolerance to account for partial last words.
function checkWpmMathAlignment(payload: SessionSubmitPayload['results']): AntiCheatResult | null {
  const { wpm, durationMs, correctChars } = payload;
  const elapsedMin       = durationMs / 60_000;
  const expectedChars    = wpm * 5 * elapsedMin;

  // Guard division by zero
  if (expectedChars === 0) return null;

  const deviation = Math.abs(correctChars - expectedChars) / expectedChars;
  if (deviation > 0.35) {
    return {
      passed:     false,
      flagReason: `wpm_char_misalignment:dev=${deviation.toFixed(2)},expected=${Math.round(expectedChars)},got=${correctChars}`,
      confidence: Math.max(0, 1 - deviation),
    };
  }
  return null;
}

// ── Check 3: Impossible keystroke speed ───────────────────────────────────────
// Human reaction time minimum is ~20 ms. Any keystroke faster than this
// (excluding the very first) indicates programmatic injection.
// We allow up to 5% of keystrokes to be anomalous (measurement noise).
function checkImpossibleSpeed(
  keystrokeEvents: SessionSubmitPayload['keystrokeEvents'],
): AntiCheatResult | null {
  if (keystrokeEvents.length < 10) return null;

  // Skip position 0 (no prior keystroke to measure latency from)
  const latencies = keystrokeEvents
    .filter((k) => k.latencyMs > 0)
    .map((k) => k.latencyMs);

  const tooFast = latencies.filter(
    (l) => l < ANTI_CHEAT.MIN_KEYSTROKE_INTERVAL_MS,
  ).length;

  const fraction = tooFast / latencies.length;
  if (fraction > 0.05) {
    return {
      passed:     false,
      flagReason: `impossible_speed:${(fraction * 100).toFixed(1)}%_keystrokes_under_${ANTI_CHEAT.MIN_KEYSTROKE_INTERVAL_MS}ms`,
      confidence: Math.max(0, 1 - fraction * 4),
    };
  }
  return null;
}

// ── Check 4: Bot uniform rhythm detection ────────────────────────────────────
// Humans have natural rhythm variance. A bot with `setInterval` typing
// produces nearly uniform inter-key intervals.
// Flag: std deviation < 5 ms when mean latency < 200 ms (fast, uniform bot).
function checkUniformRhythm(
  keystrokeEvents: SessionSubmitPayload['keystrokeEvents'],
): AntiCheatResult | null {
  if (keystrokeEvents.length < 20) return null;

  const latencies = keystrokeEvents
    .filter((k) => k.latencyMs > 0)
    .map((k) => k.latencyMs);

  const avg = mean(latencies);
  const sd  = stdDev(latencies, avg);

  if (
    sd < ANTI_CHEAT.UNIFORM_RHYTHM_VARIANCE_THRESHOLD_MS &&
    avg < 200 // fast and robotic
  ) {
    return {
      passed:     false,
      flagReason: `bot_rhythm:stddev=${sd.toFixed(2)}ms,mean=${avg.toFixed(1)}ms`,
      confidence: 0.1,
    };
  }
  return null;
}

// ── Check 5: Session duration sanity ─────────────────────────────────────────
function checkDurationSanity(
  durationMs: number,
  totalChars:  number,
): AntiCheatResult | null {
  // Can't type 10+ chars in under 1 second
  if (durationMs < 1_000 && totalChars > 10) {
    return {
      passed:     false,
      flagReason: `impossible_duration:${durationMs}ms_for_${totalChars}_chars`,
      confidence: 0,
    };
  }
  // Session exceeds max allowed duration
  if (durationMs > ANTI_CHEAT.MAX_SESSION_DURATION_MS) {
    return {
      passed:     false,
      flagReason: `session_too_long:${Math.round(durationMs / 60000)}min`,
      confidence: 0.5,
    };
  }
  return null;
}

// ── Public validator ──────────────────────────────────────────────────────────
export function validateSession(payload: SessionSubmitPayload): AntiCheatResult {
  const { results, keystrokeEvents } = payload;

  // Run all checks — stop at first hard failure
  const checks = [
    checkWpmCeiling(results.wpm),
    checkWpmMathAlignment(results),
    checkImpossibleSpeed(keystrokeEvents),
    checkUniformRhythm(keystrokeEvents),
    checkDurationSanity(results.durationMs, results.totalChars),
  ];

  for (const result of checks) {
    if (result !== null) return result;
  }

  // All checks passed
  return { passed: true, confidence: 1 };
}
