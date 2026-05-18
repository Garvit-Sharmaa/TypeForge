/**
 * curriculum.ts — 10-step professional touch-typing curriculum.
 *
 * CUMULATIVE PROGRESSION RULE (invariant):
 *   lesson[n].allowedKeys = lesson[n-1].allowedKeys ∪ lesson[n].targetKeys
 *
 * This ensures the generation engine always has the full reachable character
 * set, while targetKeys contains ONLY the new keys for weighted sampling.
 *
 * FINGER ASSIGNMENT CONVENTION:
 *   targetFingers lists the fingers introduced/exercised by targetKeys.
 *   Used by the SVG keyboard to highlight focus fingers in the UI.
 */

import type { LessonConfig } from '@typing-master/shared';

// ── Helper: build cumulative allowedKeys without mutation ─────────────────────
function cumulative(...sets: string[][]): string[] {
  const seen = new Set<string>();
  for (const set of sets) for (const k of set) seen.add(k);
  return [...seen].sort();
}

// ── Stage key groups (single source of truth) ─────────────────────────────────
const HOME_CORE    = ['a','s','d','f','j','k','l',';'];
const HOME_REACHES = ['g','h'];
const TOP_VOWELS   = ['e','i'];
const TOP_INDEX    = ['r','u'];
const TOP_OUTER    = ['t','y','w','o'];
const TOP_PINKY    = ['q','p'];
const BOT_INDEX    = ['v','b','n','m'];
const BOT_MID_RING = ['c','x',',','.'];
const BOT_PINKY    = ['z','/'];
const MASTERY_EXTRA= ["'",'-','=','[',']','\\','`']; // optional punctuation

// ── Cumulative key sets per lesson ────────────────────────────────────────────
const ALLOW_1  = cumulative(HOME_CORE);
const ALLOW_2  = cumulative(ALLOW_1,  HOME_REACHES);
const ALLOW_3  = cumulative(ALLOW_2,  TOP_VOWELS);
const ALLOW_4  = cumulative(ALLOW_3,  TOP_INDEX);
const ALLOW_5  = cumulative(ALLOW_4,  TOP_OUTER);
const ALLOW_6  = cumulative(ALLOW_5,  TOP_PINKY);
const ALLOW_7  = cumulative(ALLOW_6,  BOT_INDEX);
const ALLOW_8  = cumulative(ALLOW_7,  BOT_MID_RING);
const ALLOW_9  = cumulative(ALLOW_8,  BOT_PINKY);
const ALLOW_10 = cumulative(ALLOW_9,  MASTERY_EXTRA);

// ── Curriculum definition ─────────────────────────────────────────────────────
export const CURRICULUM: Readonly<LessonConfig[]> = Object.freeze([

  // ── Lesson 1: Home Row Core ──────────────────────────────────────────────────
  {
    id:                 'lesson-01-home-core',
    name:               'Lesson 1 — Home Row Core',
    description:        'Master the 8 home-row keys. Your fingers rest here by default. '
                      + 'Build muscle memory for the foundation of all touch-typing.',
    stage:              0,
    allowedKeys:        ALLOW_1,
    targetKeys:         HOME_CORE,
    lockedKeys:         [],
    targetFingers:      ['left-pinky','left-ring','left-middle','left-index',
                         'right-index','right-middle','right-ring','right-pinky'],
    handRestriction:    'both',
    baseDifficulty:     1,
    wordCount:          25,
    minWordLength:      2,
    maxWordLength:      5,
    targetKeyFrequency: 0.9,   // almost every word must use a target key
  },

  // ── Lesson 2: Home Row Index Reaches ─────────────────────────────────────────
  {
    id:                 'lesson-02-home-reaches',
    name:               'Lesson 2 — Home Row: G & H',
    description:        'Extend your index fingers inward to G (left) and H (right). '
                      + 'These are the most-used keys outside the anchor positions.',
    stage:              1,
    allowedKeys:        ALLOW_2,
    targetKeys:         HOME_REACHES,
    lockedKeys:         [],
    targetFingers:      ['left-index','right-index'],
    handRestriction:    'both',
    baseDifficulty:     1,
    wordCount:          25,
    minWordLength:      2,
    maxWordLength:      6,
    targetKeyFrequency: 0.6,
  },

  // ── Lesson 3: Top Row Vowels ──────────────────────────────────────────────────
  {
    id:                 'lesson-03-top-vowels',
    name:               'Lesson 3 — Top Row: E & I',
    description:        'Reach up to the two most-common vowels in English. '
                      + 'E and I appear in nearly every word — this lesson is a major milestone.',
    stage:              2,
    allowedKeys:        ALLOW_3,
    targetKeys:         TOP_VOWELS,
    lockedKeys:         [],
    targetFingers:      ['left-middle','right-middle'],
    handRestriction:    'both',
    baseDifficulty:     2,
    wordCount:          25,
    minWordLength:      2,
    maxWordLength:      6,
    targetKeyFrequency: 0.7,
  },

  // ── Lesson 4: Top Row Index Reaches ──────────────────────────────────────────
  {
    id:                 'lesson-04-top-index',
    name:               'Lesson 4 — Top Row: R & U',
    description:        'Your index fingers extend upward to R (left) and U (right). '
                      + 'Combined with E and I, you can now type the majority of common words.',
    stage:              3,
    allowedKeys:        ALLOW_4,
    targetKeys:         TOP_INDEX,
    lockedKeys:         [],
    targetFingers:      ['left-index','right-index'],
    handRestriction:    'both',
    baseDifficulty:     2,
    wordCount:          25,
    minWordLength:      3,
    maxWordLength:      7,
    targetKeyFrequency: 0.6,
  },

  // ── Lesson 5: Top Row Outer Keys ──────────────────────────────────────────────
  {
    id:                 'lesson-05-top-outer',
    name:               'Lesson 5 — Top Row: T, Y, W & O',
    description:        'Complete the top row with T, Y, W and O. '
                      + 'T and W are high-frequency consonants; O is the third most common vowel.',
    stage:              4,
    allowedKeys:        ALLOW_5,
    targetKeys:         TOP_OUTER,
    lockedKeys:         [],
    targetFingers:      ['left-index','right-index','left-ring','right-ring'],
    handRestriction:    'both',
    baseDifficulty:     2,
    wordCount:          25,
    minWordLength:      3,
    maxWordLength:      7,
    targetKeyFrequency: 0.55,
  },

  // ── Lesson 6: Top Row Pinky Keys ──────────────────────────────────────────────
  {
    id:                 'lesson-06-top-pinky',
    name:               'Lesson 6 — Top Row: Q & P',
    description:        'Pinky fingers reach up to Q (left) and P (right). '
                      + 'These are weaker fingers — focus on accuracy over speed.',
    stage:              5,
    allowedKeys:        ALLOW_6,
    targetKeys:         TOP_PINKY,
    lockedKeys:         [],
    targetFingers:      ['left-pinky','right-pinky'],
    handRestriction:    'both',
    baseDifficulty:     3,
    wordCount:          25,
    minWordLength:      3,
    maxWordLength:      8,
    targetKeyFrequency: 0.45,
  },

  // ── Lesson 7: Bottom Row Index Keys ──────────────────────────────────────────
  {
    id:                 'lesson-07-bottom-index',
    name:               'Lesson 7 — Bottom Row: V, B, N & M',
    description:        'Drop to the bottom row for the index fingers. '
                      + 'N and M are high-frequency; V and B complete common consonant clusters.',
    stage:              6,
    allowedKeys:        ALLOW_7,
    targetKeys:         BOT_INDEX,
    lockedKeys:         [],
    targetFingers:      ['left-index','right-index'],
    handRestriction:    'both',
    baseDifficulty:     3,
    wordCount:          25,
    minWordLength:      3,
    maxWordLength:      8,
    targetKeyFrequency: 0.55,
  },

  // ── Lesson 8: Bottom Row Middle & Ring ────────────────────────────────────────
  {
    id:                 'lesson-08-bottom-mid-ring',
    name:               'Lesson 8 — Bottom Row: C, X, , & .',
    description:        'C and X add two important consonants. Comma and period '
                      + 'introduce punctuation rhythm — essential for natural sentence typing.',
    stage:              7,
    allowedKeys:        ALLOW_8,
    targetKeys:         BOT_MID_RING,
    lockedKeys:         [],
    targetFingers:      ['left-middle','left-ring','right-middle','right-ring'],
    handRestriction:    'both',
    baseDifficulty:     3,
    wordCount:          30,
    minWordLength:      3,
    maxWordLength:      8,
    targetKeyFrequency: 0.45,
  },

  // ── Lesson 9: Bottom Row Pinky Keys ──────────────────────────────────────────
  {
    id:                 'lesson-09-bottom-pinky',
    name:               'Lesson 9 — Bottom Row: Z & /',
    description:        'The hardest reaches: Z (left pinky, bottom-left) and / (right pinky, bottom-right). '
                      + 'Uncommon in everyday text, but critical for full keyboard coverage.',
    stage:              8,
    allowedKeys:        ALLOW_9,
    targetKeys:         BOT_PINKY,
    lockedKeys:         [],
    targetFingers:      ['left-pinky','right-pinky'],
    handRestriction:    'both',
    baseDifficulty:     4,
    wordCount:          25,
    minWordLength:      3,
    maxWordLength:      8,
    targetKeyFrequency: 0.35,
  },

  // ── Lesson 10: Mastery ────────────────────────────────────────────────────────
  {
    id:                 'lesson-10-mastery',
    name:               'Lesson 10 — Full Keyboard Mastery',
    description:        'The complete alphabet plus common punctuation. '
                      + 'Adaptive: sessions are assembled from your personal weak-key data '
                      + 'to target exactly where you need the most practice.',
    stage:              9,
    allowedKeys:        ALLOW_10,
    targetKeys:         [],          // no single "new" keys — engine uses weakKeys instead
    lockedKeys:         [],
    targetFingers:      ['left-pinky','left-ring','left-middle','left-index',
                         'right-index','right-middle','right-ring','right-pinky'],
    handRestriction:    'both',
    baseDifficulty:     5,
    wordCount:          30,
    minWordLength:      4,
    maxWordLength:      10,
    targetKeyFrequency: 0.0,        // 100% adaptive (all slots go to weakKey pool)
  },

]) as unknown as LessonConfig[];

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** O(1) lesson lookup by id */
const CURRICULUM_MAP = new Map<string, LessonConfig>(
  CURRICULUM.map((l) => [l.id, l]),
);

export function getLessonById(id: string): LessonConfig | null {
  return CURRICULUM_MAP.get(id) ?? null;
}

/** Return lessons in stage order, with the lesson at `stage` unlocked
 *  if the user has completed the previous lesson.
 *  For simplicity, all lessons up to and including userMaxStage are unlocked. */
export function getLessonsWithLockStatus(userMaxStage: number): Array<LessonConfig & { locked: boolean }> {
  return CURRICULUM.map((lesson) => ({
    ...lesson,
    locked: (lesson.stage ?? 0) > userMaxStage,
  }));
}
