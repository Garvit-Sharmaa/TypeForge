/**
 * qwertyKeyData.ts — Canonical QWERTY physical key properties.
 *
 * Single source of truth for the backend lesson engine.
 * Mirrors the data in /public/layouts/qwerty-ansi.json but as a
 * compile-time constant for O(1) backend lookups without JSON parsing.
 *
 * Row encoding: 0=number, 1=top(QWERTY), 2=home(ASDF), 3=bottom(ZXCV), 4=thumb
 */

export type KeyRow  = 0 | 1 | 2 | 3 | 4;
export type Finger  = 'LP' | 'LR' | 'LM' | 'LI' | 'LT' | 'RT' | 'RI' | 'RM' | 'RR' | 'RP';
export type KeyHand = 'L' | 'R';

/** Biomechanical properties of a single physical key */
export interface PhysicalKey {
  row:    KeyRow;
  finger: Finger;   // LP=left-pinky, LR=left-ring, LM=left-middle, LI=left-index
  hand:   KeyHand;  // RI=right-index, RM=right-middle, RR=right-ring, RP=right-pinky
  /** Is this a pinky key? Pre-computed for hot-path speed */
  isPinky: boolean;
}

/** Complete QWERTY layout key map. Keys are lowercase characters. */
export const QWERTY: Readonly<Record<string, PhysicalKey>> = Object.freeze({
  // ── Number row (row 0) ──────────────────────────────────────────────────────
  '`': { row: 0, finger: 'LP', hand: 'L', isPinky: true  },
  '1': { row: 0, finger: 'LP', hand: 'L', isPinky: true  },
  '2': { row: 0, finger: 'LR', hand: 'L', isPinky: false },
  '3': { row: 0, finger: 'LM', hand: 'L', isPinky: false },
  '4': { row: 0, finger: 'LI', hand: 'L', isPinky: false },
  '5': { row: 0, finger: 'LI', hand: 'L', isPinky: false },
  '6': { row: 0, finger: 'RI', hand: 'R', isPinky: false },
  '7': { row: 0, finger: 'RI', hand: 'R', isPinky: false },
  '8': { row: 0, finger: 'RM', hand: 'R', isPinky: false },
  '9': { row: 0, finger: 'RR', hand: 'R', isPinky: false },
  '0': { row: 0, finger: 'RP', hand: 'R', isPinky: true  },
  '-': { row: 0, finger: 'RP', hand: 'R', isPinky: true  },
  '=': { row: 0, finger: 'RP', hand: 'R', isPinky: true  },
  // ── Top row / QWERTY (row 1) ────────────────────────────────────────────────
  'q': { row: 1, finger: 'LP', hand: 'L', isPinky: true  },
  'w': { row: 1, finger: 'LR', hand: 'L', isPinky: false },
  'e': { row: 1, finger: 'LM', hand: 'L', isPinky: false },
  'r': { row: 1, finger: 'LI', hand: 'L', isPinky: false },
  't': { row: 1, finger: 'LI', hand: 'L', isPinky: false },
  'y': { row: 1, finger: 'RI', hand: 'R', isPinky: false },
  'u': { row: 1, finger: 'RI', hand: 'R', isPinky: false },
  'i': { row: 1, finger: 'RM', hand: 'R', isPinky: false },
  'o': { row: 1, finger: 'RR', hand: 'R', isPinky: false },
  'p': { row: 1, finger: 'RP', hand: 'R', isPinky: true  },
  '[': { row: 1, finger: 'RP', hand: 'R', isPinky: true  },
  ']': { row: 1, finger: 'RP', hand: 'R', isPinky: true  },
  '\\':{ row: 1, finger: 'RP', hand: 'R', isPinky: true  },
  // ── Home row / ASDF (row 2) ─────────────────────────────────────────────────
  'a': { row: 2, finger: 'LP', hand: 'L', isPinky: true  },
  's': { row: 2, finger: 'LR', hand: 'L', isPinky: false },
  'd': { row: 2, finger: 'LM', hand: 'L', isPinky: false },
  'f': { row: 2, finger: 'LI', hand: 'L', isPinky: false },
  'g': { row: 2, finger: 'LI', hand: 'L', isPinky: false },
  'h': { row: 2, finger: 'RI', hand: 'R', isPinky: false },
  'j': { row: 2, finger: 'RI', hand: 'R', isPinky: false },
  'k': { row: 2, finger: 'RM', hand: 'R', isPinky: false },
  'l': { row: 2, finger: 'RR', hand: 'R', isPinky: false },
  ';': { row: 2, finger: 'RP', hand: 'R', isPinky: true  },
  "'": { row: 2, finger: 'RP', hand: 'R', isPinky: true  },
  // ── Bottom row / ZXCV (row 3) ───────────────────────────────────────────────
  'z': { row: 3, finger: 'LP', hand: 'L', isPinky: true  },
  'x': { row: 3, finger: 'LR', hand: 'L', isPinky: false },
  'c': { row: 3, finger: 'LM', hand: 'L', isPinky: false },
  'v': { row: 3, finger: 'LI', hand: 'L', isPinky: false },
  'b': { row: 3, finger: 'LI', hand: 'L', isPinky: false },
  'n': { row: 3, finger: 'RI', hand: 'R', isPinky: false },
  'm': { row: 3, finger: 'RI', hand: 'R', isPinky: false },
  ',': { row: 3, finger: 'RM', hand: 'R', isPinky: false },
  '.': { row: 3, finger: 'RR', hand: 'R', isPinky: false },
  '/': { row: 3, finger: 'RP', hand: 'R', isPinky: true  },
  // ── Thumb row (row 4) ───────────────────────────────────────────────────────
  ' ': { row: 4, finger: 'RT', hand: 'R', isPinky: false },
});

/** Lookup a character's physical properties. Returns null for unmapped chars. */
export function getKeyData(char: string): PhysicalKey | null {
  return QWERTY[char.toLowerCase()] ?? null;
}

/** Map compact finger code → canonical FingerName string */
export const FINGER_NAME_MAP: Readonly<Record<Finger, string>> = {
  LP: 'left-pinky',  LR: 'left-ring',   LM: 'left-middle', LI: 'left-index',
  LT: 'left-thumb',  RT: 'right-thumb', RI: 'right-index', RM: 'right-middle',
  RR: 'right-ring',  RP: 'right-pinky',
};
