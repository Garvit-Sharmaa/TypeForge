'use client';
/**
 * PracticePage — The Adaptive Forge + Typing Arena
 *
 * Layout:
 *   ┌──────────────┬────────────────────────────────────────────┐
 *   │  ForgePanel  │           TypingArena                      │
 *   │  (288px)     │        (flex-1, centered)                  │
 *   │  collapsible │                                            │
 *   └──────────────┴────────────────────────────────────────────┘
 *
 * Drill launch flow:
 *   1. User clicks a drill button in ForgePanel
 *   2. onLaunchDrill() calls the API to generate a focused lesson payload
 *   3. On success: initSession() → router.push with ?lessonId=forge-drill-*
 *   4. TypingArena picks up lessonId from URL (existing logic)
 *
 * Session tracking (for ForgePanel's "Today" badge):
 *   • Listen to typingStore status transitions idle→finished
 *   • On each finish: increment local sessionCount + accumulate xpToday
 *     (xp comes from the SessionSubmit response via a shared event)
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion }                      from 'framer-motion';
import TypingArena                     from '@/components/typing/TypingArena';
import ForgePanel                      from '@/components/typing/ForgePanel';
import { useTypingStore, selectStatus } from '@/store/typingStore';
import { useUserStore, selectTokens }   from '@/store/userStore';
import { useAnalyticsStore }            from '@/store/analyticsStore';
import { useAcademyProgress }           from '@/hooks/useAcademyProgress';

// ─── Drill word generation ────────────────────────────────────────────────────
// We generate a focused drill by calling analyticsApi.weakKeys and then
// building an ad-hoc lesson-style initSession that fills the word list with
// words biased towards the weak key characters.
// This works without a new API route by generating the word list client-side
// from a curated corpus filtered to the target characters.

/** A compact, common English word list biased toward single-char repetition */
const COMMON_WORDS = [
  'the','and','for','are','but','not','you','all','can','had',
  'her','was','one','our','out','day','get','has','him','his',
  'how','man','new','now','old','see','two','way','who','boy',
  'did','its','let','put','say','she','too','use','dad','far',
  'few','got','let','may','off','ran','red','run','sat','set',
  'six','ten','try','yes','yet','ago','air','art','big','bit',
  'box','bus','car','cat','cup','cut','dog','dry','due','ear',
  'eat','egg','end','eye','fat','fly','fun','gas','gun','gut',
  'hat','hit','hot','hug','ice','key','kid','law','lay','leg',
  'lid','lip','log','lot','low','mix','mud','net','nod','nor',
  'oak','odd','oil','own','pan','pay','per','pet','pie','pit',
  'pop','pot','raw','ray','rib','rid','rip','rod','rot','row',
  'rub','rug','sad','sap','saw','sea','sew','shy','sip','sit',
  'sky','sly','sob','son','sow','spa','spy','sum','sun','tab',
  'tan','tap','tar','tax','tea','tie','tip','toe','top','toy',
  'tug','tun','tux','van','vat','via','vow','wax','web','wed',
  'wet','win','wit','woe','won','woo','wow','yam','yap','yaw',
];

/** Drill-type → word count */
const DRILL_WORD_COUNT: Record<string, number> = {
  precision: 25,
  burst:     40,
  speed:     60,
};

/**
 * Build a drill word list biased toward the target character set.
 * Strategy: prefer words whose chars are a subset of targetChars (union with
 * adjacent QWERTY keys for burst/speed), then pad with any remaining words.
 */
function buildDrillWords(
  weakKeys:  string[],
  drillType: string,
  count:     number,
): string[] {
  const targetSet = new Set(weakKeys.map((k) => k.toLowerCase()));

  // For burst/speed drills, include common adjacent keys
  if (drillType !== 'precision') {
    const adjacent: Record<string, string[]> = {
      a: ['s','q','z'], s: ['a','d','w','x'], d: ['s','f','e','c'],
      f: ['d','g','r','v'], g: ['f','h','t','b'], h: ['g','j','y','n'],
      j: ['h','k','u','m'], k: ['j','l','i'], l: ['k',';','o'],
      e: ['w','r','d'], r: ['e','t','f'], t: ['r','y','g'], y: ['t','u','h'],
      u: ['y','i','j'], i: ['u','o','k'], o: ['i','p','l'],
    };
    for (const k of [...weakKeys]) {
      adjacent[k]?.forEach((adj) => targetSet.add(adj));
    }
  }

  // Score words: ratio of chars that are in the target set
  const scored = COMMON_WORDS.map((word) => {
    const hits = [...word].filter((c) => targetSet.has(c)).length;
    const score = hits / word.length;
    return { word, score };
  });

  // Primary: high-overlap words; Secondary: any remaining words
  const primary   = scored.filter((w) => w.score >= 0.5).map((w) => w.word);
  const secondary = scored.filter((w) => w.score  < 0.5).map((w) => w.word);

  const pool = [...primary, ...secondary];

  // Repeat + shuffle to fill requested count
  const result: string[] = [];
  while (result.length < count) {
    const src = result.length < primary.length * 3 ? primary : pool;
    const idx = Math.floor(Math.random() * src.length);
    result.push(src[idx] ?? pool[0]);
  }

  return result.slice(0, count);
}

// ─── Forge-aware practice content ─────────────────────────────────────────────

function PracticeContent() {
  const params   = useSearchParams();
  const router   = useRouter();
  const lessonId = params.get('lessonId') ?? undefined;

  const tokens      = useUserStore(selectTokens);
  const status      = useTypingStore(selectStatus);
  const initSession = useTypingStore((s) => s.initSession);

  // ── Academy chapter progress ──────────────────────────────────────────
  // Marks chapter complete when session finishes while /practice is mounted.
  // Must be called here (not in /learn) because /learn is unmounted during the session.
  useAcademyProgress();

  // ── Today's Forge stats from analyticsStore (persists across navigation) ──────
  // Using the store means sessionCount/xpToday survive a visit to /academy and back.
  // addTodaySession auto-resets counts at midnight.
  const todaySessions    = useAnalyticsStore((s) => s.todaySessions);
  const todayXp          = useAnalyticsStore((s) => s.todayXp);
  const addTodaySession  = useAnalyticsStore((s) => s.addTodaySession);

  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === 'running' && status === 'finished') {
      const results = useTypingStore.getState().results;
      const xpEarned = results
        ? Math.round(results.wpm * 0.8 + results.accuracy * 0.5)
        : 0;
      addTodaySession(xpEarned);
    }
    prevStatus.current = status;
  }, [status, addTodaySession]);

  // ── Drill launcher ─────────────────────────────────────────────────────────
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunchDrill = useCallback(async (
    weakKeys:  string[],
    drillType: string,
  ) => {
    setIsLaunching(true);
    try {
      const count = DRILL_WORD_COUNT[drillType] ?? 30;
      const words = buildDrillWords(weakKeys, drillType, count);

      // Synthesise a forge lesson ID so TypingArena enters "lesson mode"
      // (shows breadcrumb, hides config bar, enables Tab-restart)
      const forgeId = `forge-${drillType}-${weakKeys.join('')}`;

      initSession(
        {
          mode:        'words',
          duration:    0,
          wordCount:   words.length,
          language:    'english',
          lessonId:    forgeId,
          allowedKeys: weakKeys, // LiveKeyboard will highlight these
        },
        words,
      );

      router.push(`/practice?lessonId=${encodeURIComponent(forgeId)}`);
    } finally {
      setIsLaunching(false);
    }
  }, [initSession, router]);

  return (
    <div className="flex h-full min-h-[calc(100dvh-52px)]">

      {/* ── Adaptive Forge rail ─────────────────────────────────────────────── */}
      <ForgePanel
        onLaunchDrill={handleLaunchDrill}
        isLaunching={isLaunching}
        sessionCount={todaySessions}
        xpToday={todayXp}
      />

      {/* ── Main Arena ──────────────────────────────────────────────────────── */}
      <motion.main
        className="flex-1 flex items-center justify-center overflow-auto"
        layout
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      >
        <TypingArena lessonId={lessonId} />
      </motion.main>

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// useSearchParams() requires a Suspense boundary in Next.js App Router

export default function PracticePage() {
  return (
    <Suspense fallback={
      <div className="flex h-full min-h-[calc(100dvh-52px)] items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet/40
                        border-t-violet animate-spin" />
      </div>
    }>
      <PracticeContent />
    </Suspense>
  );
}
