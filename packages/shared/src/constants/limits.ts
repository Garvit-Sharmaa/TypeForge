/**
 * Anti-cheat and human performance bounds.
 * Used in Zod schemas and backend validation.
 */
export const ANTI_CHEAT = {
  /** Absolute ceiling: no human has ever sustained 300 WPM */
  MAX_BELIEVABLE_WPM: 300,

  /** If every keystroke interval is within this band (ms), flag as bot */
  UNIFORM_RHYTHM_VARIANCE_THRESHOLD_MS: 5,

  /** Minimum believable inter-key interval in ms (> 20ms for humans) */
  MIN_KEYSTROKE_INTERVAL_MS: 20,

  /** Max single session duration: 2 hours */
  MAX_SESSION_DURATION_MS: 7_200_000,

  /** Max keystrokes we'll accept in a single submission (10 min × 300 WPM × 5 chars) */
  MAX_KEYSTROKES_PER_SESSION: 90_000,

  /** Max believable latency for a single keystroke (very slow typist) */
  MAX_KEYSTROKE_LATENCY_MS: 10_000,

  /** Fraction of keystrokes that must have variance above threshold */
  MIN_VARIANCE_SAMPLE_FRACTION: 0.8,
} as const;

/** Visual key release delay (ms) — how long a key stays 'pressed' before reverting */
export const KEYBOARD_BRIDGE_RELEASE_DELAY_MS = 80;

/** Human WPM performance bands (for analytics labelling) */
export const WPM_BANDS = {
  BEGINNER:      { min: 0,   max: 30  },
  NOVICE:        { min: 30,  max: 50  },
  INTERMEDIATE:  { min: 50,  max: 70  },
  ADVANCED:      { min: 70,  max: 100 },
  PROFESSIONAL:  { min: 100, max: 130 },
  EXPERT:        { min: 130, max: 160 },
  ELITE:         { min: 160, max: 300 },
} as const;

/** Session time options (seconds) for time mode */
export const TIME_MODE_OPTIONS = [15, 30, 60, 120] as const;

/** Word count options for words mode */
export const WORDS_MODE_OPTIONS = [10, 25, 50, 100] as const;
