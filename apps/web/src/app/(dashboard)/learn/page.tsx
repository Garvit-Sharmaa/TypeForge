'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore, selectTokens, selectUser } from '@/store/userStore';
import { useTypingStore } from '@/store/typingStore';
import { lessonsApi, type LessonListItem } from '@/lib/api';
import type { Metadata } from 'next';

// ── Difficulty badge config ────────────────────────────────────────────────────
const DIFFICULTY_META: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Beginner',     color: '#34d399', bg: 'rgba(52,211,153,0.10)' },
  2: { label: 'Easy',         color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' },
  3: { label: 'Intermediate', color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
  4: { label: 'Hard',         color: '#f87171', bg: 'rgba(248,113,113,0.10)' },
  5: { label: 'Expert',       color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
};

// ── Progress line connector ────────────────────────────────────────────────────
function ProgressConnector({ completed }: { completed: boolean }) {
  return (
    <div className="flex justify-center my-1">
      <div className={`w-0.5 h-5 rounded-full transition-colors duration-500
        ${completed ? 'bg-correct/60' : 'bg-surface-3'}`} />
    </div>
  );
}

// ── Single lesson card ─────────────────────────────────────────────────────────
interface LessonCardProps {
  lesson:      LessonListItem;
  index:       number;
  isActive:    boolean;
  isCompleted: boolean;    // true when lessonIndex < completedCount (already passed)
  isLoading:   boolean;
  onStart:     (id: string) => void;
}

function LessonCard({ lesson, index, isActive, isCompleted, isLoading, onStart }: LessonCardProps) {
  const diff   = DIFFICULTY_META[lesson.baseDifficulty] ?? DIFFICULTY_META[1];
  const locked = lesson.locked;

  const statusIcon = locked
    ? '🔒'
    : isActive
      ? '▶'
      : isCompleted
        ? '✓'
        : '▶';

  const cardBg = locked
    ? 'bg-surface-2/40 border-surface-3/50'
    : isActive
      ? 'bg-violet/8 border-violet/30 shadow-[0_0_20px_rgba(124,58,237,0.12)]'
      : isCompleted
        ? 'bg-surface-2 border-surface-3 hover:border-surface-2 hover:bg-surface-3/50'
        : 'bg-surface-2 border-surface-3 hover:border-violet/20 hover:bg-surface-3/30';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.05, ease: 'easeOut' }}
      id={`lesson-card-${lesson.stage}`}
      className={`relative rounded-2xl border p-5 transition-all duration-200
                  ${cardBg} ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onClick={() => !locked && !isLoading && onStart(lesson.id)}
    >
      <div className="flex items-start gap-4">
        {/* Stage number circle */}
        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                         font-mono font-bold text-sm border transition-colors
                         ${isActive
                           ? 'bg-violet/20 border-violet/50 text-violet-light'
                           : locked
                             ? 'bg-surface-3 border-surface-3 text-untyped'
                             : 'bg-correct/10 border-correct/30 text-correct'}`}>
          {isActive ? '▶' : locked ? '🔒' : isCompleted ? `${lesson.stage + 1}` : '🔒'}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className={`font-mono font-semibold text-sm
              ${locked ? 'text-untyped' : isActive ? 'text-violet-light' : isCompleted ? 'text-correct' : 'text-untyped'}`}>
              {lesson.name}
            </h3>
            {/* Difficulty badge */}
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
              style={{ color: diff.color, background: diff.bg,
                       borderColor: `${diff.color}40` }}
            >
              {diff.label}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-untyped mt-1 leading-relaxed line-clamp-2">
            {lesson.description}
          </p>

          {/* Target keys */}
          {lesson.targetKeys.length > 0 && (
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="text-[10px] font-mono text-muted">new keys:</span>
              {lesson.targetKeys.map((k) => (
                <kbd key={k}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3
                             border border-surface-2 text-violet-light tracking-widest">
                  {k === ' ' ? '⎵' : k}
                </kbd>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-2.5">
            <span className="text-[10px] font-mono text-untyped flex items-center gap-1">
              <span>⌨</span>
              <span>{lesson.allowedCount} keys total</span>
            </span>
            <span className="text-[10px] font-mono text-untyped flex items-center gap-1">
              <span>✦</span>
              <span>{lesson.wordCount} words/session</span>
            </span>
          </div>
        </div>

        {/* CTA */}
        {!locked && (
          <div className="shrink-0">
            {isLoading && isActive ? (
              <div className="w-8 h-8 rounded-full border-2 border-violet/40
                              border-t-violet animate-spin" />
            ) : (
              <button
                id={`lesson-start-${lesson.stage}`}
                disabled={isLoading}
                className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border
                            transition-all duration-150 active:scale-95
                            ${isActive
                              ? 'bg-violet border-violet text-white hover:bg-violet/85'
                              : 'bg-surface-3 border-surface-2 text-muted hover:border-violet/30'}`}
              >
                {isActive ? 'start →' : 'practice'}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LearnPage() {
  const router    = useRouter();
  const tokens    = useUserStore(selectTokens);
  const user      = useUserStore(selectUser);
  const initSession = useTypingStore((s) => s.initSession);

  const [lessons,       setLessons]       = useState<LessonListItem[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [startingId,    setStartingId]    = useState<string | null>(null);
  const [error,         setError]         = useState('');
  const [sessionError,  setSessionError]  = useState('');
  // Bug 4 fix: increment on every mount so lessons are always re-fetched
  // when navigating back to /learn (e.g. after completing a lesson).
  const [fetchKey, setFetchKey] = useState(0);
  useEffect(() => { setFetchKey((k) => k + 1); }, []); // mount-only

  // ── Fetch curriculum ──────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    setError('');
    lessonsApi.list(tokens?.accessToken)
      .then((data) => setLessons(data.lessons))
      .catch((err) => setError(err.message ?? 'Failed to load lessons'))
      .finally(() => setIsLoading(false));
  }, [tokens?.accessToken, fetchKey]); // re-fetch on every mount + token change

  // ── Derive active lesson (last non-locked = user's current frontier) ────────
  // IMPORTANT: completed lessons stay unlocked for practice re-runs.
  // find()     → always Lesson 1 (first unlocked) — WRONG ✗
  // findLast() → the furthest unlocked lesson = the true "next up" — CORRECT ✓
  const activeLessonId = [...lessons].reverse().find((l) => !l.locked)?.id
                         ?? lessons[0]?.id;

  // ── Derive active + completed counts ──────────────────────────────────────
  // All lessons *before* the active frontier are completed.
  // If all lessons are unlocked (user finished the curriculum), activeIndex
  // will be the last lesson (index 9) and completedCount = 9 (or lessons.length).
  const activeIndex    = lessons.findIndex((l) => l.id === activeLessonId);
  const completedCount = activeIndex < 0 ? 0 : activeIndex; // lessons before the active
  const handleStart = useCallback(async (lessonId: string) => {
    if (!tokens?.accessToken) {
      router.push('/login');
      return;
    }

    setStartingId(lessonId);
    setSessionError('');

    try {
      const payload = await lessonsApi.generate(lessonId, tokens.accessToken);

      // Wire into typingStore — the TypingArena (on /practice) will pick this up
      initSession(
        {
          mode:        'words',
          duration:    0,           // unused in words mode
          wordCount:   payload.wordCount,
          language:    'english',
          lessonId:    payload.lessonId,
          allowedKeys: payload.config.allowedKeys, // → LiveKeyboard home-zone highlight
        },
        payload.words,
      );

      // Navigate to the arena — the session is already initialized.
      // The ?lessonId= param signals the practice page to enter lesson mode
      // (hides toggles, shows lesson breadcrumb, enables lesson-aware restart).
      router.push(`/practice?lessonId=${encodeURIComponent(payload.lessonId)}`);
    } catch (err: any) {
      setSessionError(err.message ?? 'Failed to generate lesson. Please try again.');
    } finally {
      setStartingId(null);
    }
  }, [tokens, initSession, router]);


  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10 animate-fade-in">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-correct font-mono">
          Academy
          <span className="text-violet-light"> /</span>
          <span className="text-untyped text-lg font-normal"> Curriculum</span>
        </h1>
        <p className="text-muted text-sm mt-1">
          A structured 10-step path from home row to full keyboard mastery.
          Each lesson builds cumulatively on the last.
        </p>

        {/* User progress bar */}
        {user && !isLoading && lessons.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-mono text-untyped">progress</span>
            <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet to-correct rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, (activeIndex / lessons.length) * 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
            <span className="text-xs font-mono text-muted">
              {completedCount}/{lessons.length}
            </span>
          </div>
        )}
      </div>

      {/* Error states */}
      {error && (
        <div className="mb-6 bg-incorrect/10 border border-incorrect/30 text-incorrect
                        text-sm px-4 py-3 rounded-xl font-mono" role="alert">
          {error}
        </div>
      )}
      <AnimatePresence>
        {sessionError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 bg-incorrect/10 border border-incorrect/30 text-incorrect
                       text-sm px-4 py-3 rounded-xl font-mono"
          >
            ⚠ {sessionError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guest sign-in nudge */}
      {!user && !isLoading && (
        <div className="mb-6 glass border border-violet/20 rounded-2xl px-5 py-3
                        flex items-center justify-between gap-4">
          <p className="text-sm text-muted font-mono">
            Sign in for adaptive lessons that target your weak keys.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="text-violet-light text-xs font-mono underline underline-offset-2
                       hover:text-correct transition-colors whitespace-nowrap"
          >
            sign in →
          </button>
        </div>
      )}

      {/* Skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-surface-2 border border-surface-3
                                    animate-pulse" />
          ))}
        </div>
      )}

      {/* Lesson path */}
      {!isLoading && !error && (
        <div className="flex flex-col">
          {lessons.map((lesson, i) => {
            const isLessonActive  = lesson.id === activeLessonId;
            const isLessonDone    = i < completedCount;          // everything before active
            const isThisLoading   = startingId === lesson.id;

            return (
              <React.Fragment key={lesson.id}>
                <LessonCard
                  lesson={lesson}
                  index={i}
                  isActive={isLessonActive}
                  isCompleted={isLessonDone}
                  isLoading={isThisLoading}
                  onStart={handleStart}
                />
                {i < lessons.length - 1 && (
                  <ProgressConnector completed={i < completedCount} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      {!isLoading && !error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-[11px] font-mono text-untyped mt-8"
        >
          lessons adapt to your weak keys after each session • powered by the generation engine
        </motion.p>
      )}
    </div>
  );
}
