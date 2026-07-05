'use client';
/**
 * curriculum.ts — Frontend Lesson → Chapter hierarchy definition.
 *
 * ARCHITECTURE:
 *   This file is the single source of truth for the Academy UI structure.
 *   It maps the 10 existing backend LessonConfig IDs (from curriculum.ts on
 *   the API) into 4 pedagogically complete Lesson folders, each following
 *   the full mastery arc:
 *
 *     1. Intro (tutorial)         — what you'll learn and why
 *     2. Isolated Keys (drill)    — one key at a time, pure repetition
 *     3. Bigrams & Trigrams (drill) — two/three-key patterns
 *     4. Word Drills (drill)      — real words using the lesson's key set
 *     5. Sentence Drills (drill)  — natural prose at full speed
 *     6. Final Boss Test (test)   — gating the next Lesson
 *
 * NUMBERING CONVENTION:
 *   Chapter IDs are "<lessonNumber>.<chapterIndex>" — always localized.
 *   Lesson 1: 1.0, 1.1, 1.2, 1.3, 1.4, 1.5  (5 chapters + 1 test)
 *   Lesson 2: 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6  (6 chapters + 1 test)
 *   etc.
 *
 * MAPPING TO BACKEND:
 *   Each chapter has a `lessonConfigId` that references an existing
 *   LessonConfig ID in the API. Multiple chapters within the same Lesson
 *   folder can share the same `lessonConfigId` — the API's generation
 *   engine handles word variety through its random seeding.
 *
 * LOCK LOGIC (computed, not stored here):
 *   isLocked on each Lesson is computed at render time from the server-
 *   persisted completedChapterIds set. This file only defines the static
 *   curriculum shape.
 */

import type { Chapter, Lesson } from '@typing-master/shared';

// ─── Static curriculum skeleton (isCompleted always false here) ───────────────
// The AcademyPage hydrates isCompleted from the server before rendering.

type ChapterTemplate = Omit<Chapter, 'isCompleted'>;

const CHAPTER_TEMPLATES: { lesson: Omit<Lesson, 'isLocked' | 'chapters'>; chapters: ChapterTemplate[] }[] = [

  // ══════════════════════════════════════════════════════════════════════════════
  // LESSON 1 — Home Row Foundations
  // Keys: a s d f j k l ;
  // All 6 chapters use 'lesson-01-home-core' for word generation.
  // The boss test uses 'lesson-02-home-reaches' to add G/H pressure.
  // ══════════════════════════════════════════════════════════════════════════════
  {
    lesson: {
      id:          'lesson-1',
      number:      1,
      title:       'Home Row Foundations',
      description: 'Build the bedrock of touch-typing. Your fingers live here. ' +
                   'Master all 8 home-row keys before reaching for anything else.',
    },
    chapters: [
      {
        id:               '1.0',
        title:            'Introduction — The Home Row',
        type:             'tutorial',
        estimatedMinutes: 3,
        lessonConfigId:   'lesson-01-home-core',
      },
      {
        id:               '1.1',
        title:            'Left Hand — A S D F',
        type:             'drill',
        estimatedMinutes: 5,
        lessonConfigId:   'lesson-01-home-core',
      },
      {
        id:               '1.2',
        title:            'Right Hand — J K L ;',
        type:             'drill',
        estimatedMinutes: 5,
        lessonConfigId:   'lesson-01-home-core',
      },
      {
        id:               '1.3',
        title:            'Home Row Bigrams & Trigrams',
        type:             'drill',
        estimatedMinutes: 7,
        lessonConfigId:   'lesson-01-home-core',
      },
      {
        id:               '1.4',
        title:            'Home Row Word Drills',
        type:             'drill',
        estimatedMinutes: 8,
        lessonConfigId:   'lesson-01-home-core',
      },
      {
        id:               '1.5',
        title:            'Sentence Drills — Home Row Prose',
        type:             'drill',
        estimatedMinutes: 10,
        lessonConfigId:   'lesson-02-home-reaches',
      },
      {
        id:               '1.6',
        title:            'Final Boss — Home Row Mastery Test',
        type:             'test',
        estimatedMinutes: 5,
        lessonConfigId:   'lesson-02-home-reaches',
        basePassingWpm:       30,
        basePassingAccuracy:  95,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // LESSON 2 — Upper Row Expansion
  // Keys introduced: e i (vowels) → r u (index) → t y w o (outer) → q p (pinky)
  // The arc spans 4 backend LessonConfigs to keep the allowedKey set cumulative.
  // ══════════════════════════════════════════════════════════════════════════════
  {
    lesson: {
      id:          'lesson-2',
      number:      2,
      title:       'Upper Row Expansion',
      description: 'Reach up to the top row. E, I, R, U, T, W, O, Q, and P unlock ' +
                   'the vast majority of common English vocabulary.',
    },
    chapters: [
      {
        id:               '2.0',
        title:            'Introduction — The Upper Row',
        type:             'tutorial',
        estimatedMinutes: 3,
        lessonConfigId:   'lesson-03-top-vowels',
      },
      {
        id:               '2.1',
        title:            'Left Reach — E (middle finger up)',
        type:             'drill',
        estimatedMinutes: 6,
        lessonConfigId:   'lesson-03-top-vowels',
      },
      {
        id:               '2.2',
        title:            'Right Reach — I (middle finger up)',
        type:             'drill',
        estimatedMinutes: 6,
        lessonConfigId:   'lesson-03-top-vowels',
      },
      {
        id:               '2.3',
        title:            'Index Reaches — R & U',
        type:             'drill',
        estimatedMinutes: 7,
        lessonConfigId:   'lesson-04-top-index',
      },
      {
        id:               '2.4',
        title:            'Outer Keys — T, Y, W & O',
        type:             'drill',
        estimatedMinutes: 7,
        lessonConfigId:   'lesson-05-top-outer',
      },
      {
        id:               '2.5',
        title:            'Pinky Reaches — Q & P',
        type:             'drill',
        estimatedMinutes: 6,
        lessonConfigId:   'lesson-06-top-pinky',
      },
      {
        id:               '2.6',
        title:            'Cross-Row Bigrams & Trigrams',
        type:             'drill',
        estimatedMinutes: 8,
        lessonConfigId:   'lesson-05-top-outer',
      },
      {
        id:               '2.7',
        title:            'Word Drills — Full Upper + Home Row',
        type:             'drill',
        estimatedMinutes: 10,
        lessonConfigId:   'lesson-06-top-pinky',
      },
      {
        id:               '2.8',
        title:            'Sentence Drills — Natural Upper Row Prose',
        type:             'drill',
        estimatedMinutes: 10,
        lessonConfigId:   'lesson-06-top-pinky',
      },
      {
        id:               '2.9',
        title:            'Final Boss — Upper Row Mastery Test',
        type:             'test',
        estimatedMinutes: 5,
        lessonConfigId:   'lesson-06-top-pinky',
        basePassingWpm:       40,
        basePassingAccuracy:  95,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // LESSON 3 — Bottom Row & Completion
  // Keys introduced: v b n m (index) → c x , . (mid/ring) → z / (pinky)
  // Completes the full alphabetic keyboard coverage.
  // ══════════════════════════════════════════════════════════════════════════════
  {
    lesson: {
      id:          'lesson-3',
      number:      3,
      title:       'Bottom Row & Completion',
      description: 'Drop down to the bottom row for the final alphabet keys. ' +
                   'N, M, C, and V are high-frequency — Z and / are the toughest reaches.',
    },
    chapters: [
      {
        id:               '3.0',
        title:            'Introduction — The Bottom Row',
        type:             'tutorial',
        estimatedMinutes: 3,
        lessonConfigId:   'lesson-07-bottom-index',
      },
      {
        id:               '3.1',
        title:            'Index Drops — V, B, N & M',
        type:             'drill',
        estimatedMinutes: 6,
        lessonConfigId:   'lesson-07-bottom-index',
      },
      {
        id:               '3.2',
        title:            'Middle & Ring — C, X, Comma & Period',
        type:             'drill',
        estimatedMinutes: 7,
        lessonConfigId:   'lesson-08-bottom-mid-ring',
      },
      {
        id:               '3.3',
        title:            'Pinky Extremes — Z & /',
        type:             'drill',
        estimatedMinutes: 6,
        lessonConfigId:   'lesson-09-bottom-pinky',
      },
      {
        id:               '3.4',
        title:            'Bottom Row Bigrams & Trigrams',
        type:             'drill',
        estimatedMinutes: 8,
        lessonConfigId:   'lesson-08-bottom-mid-ring',
      },
      {
        id:               '3.5',
        title:            'Word Drills — Full Alphabet',
        type:             'drill',
        estimatedMinutes: 10,
        lessonConfigId:   'lesson-09-bottom-pinky',
      },
      {
        id:               '3.6',
        title:            'Sentence Drills — Complete Alphabet Prose',
        type:             'drill',
        estimatedMinutes: 10,
        lessonConfigId:   'lesson-09-bottom-pinky',
      },
      {
        id:               '3.7',
        title:            'Final Boss — Full Alphabet Mastery Test',
        type:             'test',
        estimatedMinutes: 5,
        lessonConfigId:   'lesson-09-bottom-pinky',
        basePassingWpm:       50,
        basePassingAccuracy:  95,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // LESSON 4 — Numbers (Top Row)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    lesson: {
      id:          'lesson-4',
      number:      4,
      title:       'Numbers (Top Row)',
      description: 'Reach past the letters. Master the number row from 1 to 0 without looking at your hands.',
    },
    chapters: [
      { id: '4.0', title: 'Introduction — The Number Row', type: 'tutorial', estimatedMinutes: 3, lessonConfigId: 'lesson-11-numbers' },
      { id: '4.1', title: 'Left Hand Numbers — 1, 2, 3, 4, 5', type: 'drill', estimatedMinutes: 6, lessonConfigId: 'lesson-11-numbers' },
      { id: '4.2', title: 'Right Hand Numbers — 6, 7, 8, 9, 0', type: 'drill', estimatedMinutes: 6, lessonConfigId: 'lesson-11-numbers' },
      { id: '4.3', title: 'Alphanumeric Drills', type: 'drill', estimatedMinutes: 8, lessonConfigId: 'lesson-11-numbers' },
      { id: '4.4', title: 'Final Boss — Number Row Test', type: 'test', estimatedMinutes: 5, lessonConfigId: 'lesson-11-numbers', basePassingWpm: 45, basePassingAccuracy: 95 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // LESSON 5 — Shift Mastery (Capitalization)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    lesson: {
      id:          'lesson-5',
      number:      5,
      title:       'Shift Mastery (Capitalization)',
      description: 'Learn the proper technique for capital letters using the opposite Shift key.',
    },
    chapters: [
      { id: '5.0', title: 'Introduction — The Shift Keys', type: 'tutorial', estimatedMinutes: 3, lessonConfigId: 'lesson-12-shift' },
      { id: '5.1', title: 'Left Shift (Right Hand Caps)', type: 'drill', estimatedMinutes: 6, lessonConfigId: 'lesson-12-shift' },
      { id: '5.2', title: 'Right Shift (Left Hand Caps)', type: 'drill', estimatedMinutes: 6, lessonConfigId: 'lesson-12-shift' },
      { id: '5.3', title: 'Proper Nouns & Names', type: 'drill', estimatedMinutes: 8, lessonConfigId: 'lesson-12-shift' },
      { id: '5.4', title: 'Final Boss — Capitalization Test', type: 'test', estimatedMinutes: 5, lessonConfigId: 'lesson-12-shift', basePassingWpm: 50, basePassingAccuracy: 95 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // LESSON 6 — Advanced Symbols & Punctuation
  // ══════════════════════════════════════════════════════════════════════════════
  {
    lesson: {
      id:          'lesson-6',
      number:      6,
      title:       'Advanced Symbols & Punctuation',
      description: 'Master brackets, slashes, dashes, and the shifted number-row symbols (!@#$%).',
    },
    chapters: [
      { id: '6.0', title: 'Introduction — Special Symbols', type: 'tutorial', estimatedMinutes: 3, lessonConfigId: 'lesson-13-symbols' },
      { id: '6.1', title: 'Common Punctuation — Dash, Equals & Brackets', type: 'drill', estimatedMinutes: 6, lessonConfigId: 'lesson-13-symbols' },
      { id: '6.2', title: 'Shifted Symbols — ! @ # $ %', type: 'drill', estimatedMinutes: 6, lessonConfigId: 'lesson-13-symbols' },
      { id: '6.3', title: 'Shifted Symbols — ^ & * ( )', type: 'drill', estimatedMinutes: 6, lessonConfigId: 'lesson-13-symbols' },
      { id: '6.4', title: 'Code Syntax Drills', type: 'drill', estimatedMinutes: 10, lessonConfigId: 'lesson-13-symbols' },
      { id: '6.5', title: 'Final Boss — Symbols Mastery Test', type: 'test', estimatedMinutes: 5, lessonConfigId: 'lesson-13-symbols', basePassingWpm: 40, basePassingAccuracy: 96 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // LESSON 7 — Speed & N-Gram Drills
  // ══════════════════════════════════════════════════════════════════════════════
  {
    lesson: {
      id:          'lesson-7',
      number:      7,
      title:       'Speed & N-Gram Drills',
      description: 'Break past your WPM plateaus. Focus on common word fragments and muscle memory bursts.',
    },
    chapters: [
      { id: '7.0', title: 'Introduction — N-Grams and Flow', type: 'tutorial', estimatedMinutes: 3, lessonConfigId: 'lesson-14-speed' },
      { id: '7.1', title: 'Top 50 Common Words', type: 'drill', estimatedMinutes: 8, lessonConfigId: 'lesson-14-speed' },
      { id: '7.2', title: 'Frequent Bigrams (th, er, on)', type: 'drill', estimatedMinutes: 8, lessonConfigId: 'lesson-14-speed' },
      { id: '7.3', title: 'Frequent Trigrams (the, and, ing)', type: 'drill', estimatedMinutes: 8, lessonConfigId: 'lesson-14-speed' },
      { id: '7.4', title: 'Burst Speed Paragraphs', type: 'drill', estimatedMinutes: 10, lessonConfigId: 'lesson-14-speed' },
      { id: '7.5', title: 'Final Boss — Speed Execution Test', type: 'test', estimatedMinutes: 5, lessonConfigId: 'lesson-14-speed', basePassingWpm: 70, basePassingAccuracy: 96 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // LESSON 8 — Adaptive Weak-Key Targeting
  // ══════════════════════════════════════════════════════════════════════════════
  {
    lesson: {
      id:          'lesson-8',
      number:      8,
      title:       'Adaptive Weak-Key Targeting',
      description: 'Use your historical data to forge drills specifically designed to eliminate your weaknesses.',
    },
    chapters: [
      { id: '8.0', title: 'Introduction — The Adaptive Engine', type: 'tutorial', estimatedMinutes: 3, lessonConfigId: 'lesson-10-mastery' },
      { id: '8.1', title: 'Left Hand Weakness Focus', type: 'drill', estimatedMinutes: 10, lessonConfigId: 'lesson-10-mastery' },
      { id: '8.2', title: 'Right Hand Weakness Focus', type: 'drill', estimatedMinutes: 10, lessonConfigId: 'lesson-10-mastery' },
      { id: '8.3', title: 'Dynamic Full-Keyboard Calibration', type: 'drill', estimatedMinutes: 12, lessonConfigId: 'lesson-10-mastery' },
      { id: '8.4', title: 'Final Boss — Adaptive Eradication Test', type: 'test', estimatedMinutes: 5, lessonConfigId: 'lesson-10-mastery', basePassingWpm: 75, basePassingAccuracy: 97 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // LESSON 9 — Grandmaster Speed Run
  // ══════════════════════════════════════════════════════════════════════════════
  {
    lesson: {
      id:          'lesson-9',
      number:      9,
      title:       'Grandmaster Speed Run',
      description: 'The ultimate test of typing proficiency. Sustained accuracy and high speed on complex texts.',
    },
    chapters: [
      { id: '9.0', title: 'Introduction — The Final Gauntlet', type: 'tutorial', estimatedMinutes: 3, lessonConfigId: 'lesson-15-grandmaster' },
      { id: '9.1', title: 'Complex Vocabulary Run', type: 'drill', estimatedMinutes: 12, lessonConfigId: 'lesson-15-grandmaster' },
      { id: '9.2', title: 'Sustained Endurance (10 minutes)', type: 'drill', estimatedMinutes: 15, lessonConfigId: 'lesson-15-grandmaster' },
      { id: '9.3', title: 'Flawless Execution (Zero Errors allowed)', type: 'drill', estimatedMinutes: 10, lessonConfigId: 'lesson-15-grandmaster' },
      { id: '9.4', title: 'Final Boss — TypeForge Grandmaster Test', type: 'test', estimatedMinutes: 5, lessonConfigId: 'lesson-15-grandmaster', basePassingWpm: 80, basePassingAccuracy: 98 },
    ],
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the full Lesson array with completion state hydrated from the
 * server-persisted completedChapterIds set.
 *
 * isLocked logic:
 *   Lesson 1 is always unlocked.
 *   Lesson N is locked until ALL chapters in Lesson N-1 are complete.
 */
export function buildCurriculum(
  completedIds: Set<string>,
): Lesson[] {
  const lessons: Lesson[] = [];

  for (let i = 0; i < CHAPTER_TEMPLATES.length; i++) {
    const { lesson, chapters } = CHAPTER_TEMPLATES[i];

    // Determine lock: Lesson 1 always unlocked; others locked until prev is done
    const prevLesson = lessons[i - 1];
    const isLocked =
      i > 0 &&
      prevLesson !== undefined &&
      !prevLesson.chapters.every((ch) => ch.isCompleted);

    lessons.push({
      ...lesson,
      isLocked,
      chapters: chapters.map((ch) => ({
        ...ch,
        isCompleted: completedIds.has(ch.id),
      })),
    });
  }

  return lessons;
}

/** All chapter IDs across the entire curriculum (for bulk Set construction) */
export const ALL_CHAPTER_IDS: string[] = CHAPTER_TEMPLATES.flatMap(
  ({ chapters }) => chapters.map((ch) => ch.id),
);
