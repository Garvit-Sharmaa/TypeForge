'use client';
/**
 * LearnPage — The Academy: Chapter-based curriculum with strict linear gating.
 *
 * ARCHITECTURE:
 *   1. On mount: fetch server-persisted chapter progress from /api/lessons/progress
 *   2. Build curriculum via buildCurriculum(completedIds) — lock logic runs here
 *   3. Render LessonAccordion for each Lesson (accordion open = active lesson)
 *   4. On chapter click:
 *        - non-test: generate + initSession + navigate to /practice?lessonId=...
 *        - test:     open DifficultySelector modal first, then generate + navigate
 *   5. On return from TypingArena (status=finished):
 *        - evaluate results against difficulty-scaled thresholds
 *        - if pass: POST /api/lessons/progress, optimistically update local state
 *        - toast pass/fail feedback
 *
 * PRESERVATION: Zero modifications to TypingArena, ForgePanel, or any store/hook.
 */

import React, { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams }    from 'next/navigation';
import { motion }       from 'framer-motion';
import { GraduationCap, RefreshCw } from 'lucide-react';

import { useUserStore, selectTokens, selectUser } from '@/store/userStore';
import { useTypingStore }                          from '@/store/typingStore';
import { lessonsApi }                              from '@/lib/api';
import { buildCurriculum }                         from '@/lib/curriculum';
import { DifficultyModifiers }                     from '@typing-master/shared';
import type { Chapter, Lesson, Difficulty }        from '@typing-master/shared';

import LessonAccordion    from '@/components/academy/LessonAccordion';
import DifficultySelector from '@/components/academy/DifficultySelector';

// ─── Toast (inline, no external lib) ─────────────────────────────────────────

interface ToastState {
  type:    'pass' | 'fail';
  message: string;
}

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: 16, scale: 0.98 }}
      className={[
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'px-5 py-3 rounded-2xl border font-mono text-sm font-semibold',
        'shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-sm',
        toast.type === 'pass'
          ? 'bg-correct/10 border-correct/30 text-correct'
          : 'bg-incorrect/10 border-incorrect/30 text-incorrect',
      ].join(' ')}
    >
      {toast.type === 'pass' ? '✓ ' : '✗ '}{toast.message}
    </motion.div>
  );
}

// ─── Overall progress bar ─────────────────────────────────────────────────────

function GlobalProgressBar({
  completed, total,
}: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : (completed / total) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono text-untyped shrink-0">overall progress</span>
      <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-violet to-correct rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, pct)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
        />
      </div>
      <span className="text-xs font-mono text-muted shrink-0">
        {completed}/{total}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function LearnContent() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const autoLaunch  = searchParams.get('autoLaunch');
  const tokens      = useUserStore(selectTokens);
  const user        = useUserStore(selectUser);
  const isHydrated  = useUserStore((s) => s.isHydrated);
  const initSession = useTypingStore((s) => s.initSession);

  // ── Server progress state ────────────────────────────────────────────────
  const [completedIds,  setCompletedIds]  = useState<Set<string>>(new Set());
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState('');

  // ── Chapter launch state ─────────────────────────────────────────────────
  const [startingId,    setStartingId]    = useState<string | null>(null);
  const [sessionError,  setSessionError]  = useState('');

  // ── Difficulty modal state ───────────────────────────────────────────────
  const [pendingChapter, setPendingChapter] = useState<Chapter | null>(null);
  const [pendingLesson,  setPendingLesson]  = useState<Lesson  | null>(null);
  const [isLaunching,    setIsLaunching]    = useState(false);

  // ── Toast state ──────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState | null>(null);

  // ── Difficulty used in the last launched test (for pass/fail eval) ───────
  const pendingDifficultyRef = useRef<Difficulty | null>(null);
  const pendingChapterIdRef  = useRef<string | null>(null);

  // ── Build curriculum from progress ──────────────────────────────────────
  const curriculum = buildCurriculum(completedIds);

  // ── Fetch server progress ────────────────────────────────────────────────
  const fetchProgress = useCallback(async () => {
    if (!isHydrated) return;
    setIsLoading(true);
    setError('');

    try {
      if (tokens?.accessToken) {
        const { chapters } = await lessonsApi.getProgress(tokens.accessToken);
        setCompletedIds(new Set(chapters.map((c) => c.chapterId)));
      } else {
        // Guest: no progress
        setCompletedIds(new Set());
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to load curriculum progress');
    } finally {
      setIsLoading(false);
    }
  }, [tokens?.accessToken, isHydrated]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // ── Auto Launch (Next Chapter Flow) ──────────────────────────────────────
  useEffect(() => {
    if (autoLaunch && !isLoading && !isLaunching && !startingId && !pendingChapter) {
      const lesson = curriculum.find((l) => l.chapters.some((c) => c.id === autoLaunch));
      const chapter = lesson?.chapters.find((c) => c.id === autoLaunch);

      if (lesson && chapter && !lesson.isLocked) {
        // Clean URL so it doesn't loop
        router.replace('/learn');
        handleChapterStart(chapter, lesson);
      }
    }
  }, [autoLaunch, isLoading, isLaunching, startingId, pendingChapter, curriculum, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear progress when user changes (multi-account on same tab) ─────────
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== currentId) {
      setCompletedIds(new Set());
    }
    prevUserIdRef.current = currentId;
  }, [user?.id]);

  // ── Listen for session finish to evaluate pass/fail ──────────────────────
  const prevStatus = useRef(useTypingStore.getState().status);
  useEffect(() => {
    const unsub = useTypingStore.subscribe(
      (s) => s.status,
      (status) => {
        if (prevStatus.current === 'running' && status === 'finished') {
          void evaluateResult();
        }
        prevStatus.current = status;
      },
    );
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  async function evaluateResult() {
    const chapterId  = pendingChapterIdRef.current;
    const difficulty = pendingDifficultyRef.current;
    if (!chapterId || !difficulty) return;

    const results = useTypingStore.getState().results;
    if (!results) return;

    // Find chapter in curriculum
    const chapter = curriculum
      .flatMap((l) => l.chapters)
      .find((ch) => ch.id === chapterId);

    if (!chapter || chapter.type !== 'test') {
      // Non-test chapters always "pass" — mark complete immediately
      if (chapter && tokens?.accessToken) {
        const roundedWpm = Math.round(results.wpm);
        const roundedAcc = Math.round(results.accuracy);
        await safeMarkComplete(chapterId, 'easy', roundedWpm, roundedAcc);
      }
      return;
    }

    // Test: check against difficulty thresholds
    const mod         = DifficultyModifiers[difficulty];
    const reqWpm      = Math.round((chapter.basePassingWpm ?? 0) * mod.wpmMultiplier);
    const reqAccuracy = mod.accuracyReq;

    const achievedWpm = Math.round(results.wpm);
    const achievedAcc = Math.round(results.accuracy);

    const passed = achievedWpm >= reqWpm && achievedAcc >= reqAccuracy;

    if (passed) {
      setToast({
        type:    'pass',
        message: `Chapter ${chapterId} passed! ${achievedWpm} WPM · ${achievedAcc}% acc ✓`,
      });
      if (tokens?.accessToken) {
        await safeMarkComplete(chapterId, difficulty, achievedWpm, achievedAcc);
      }
    } else {
      setToast({
        type:    'fail',
        message: `${achievedWpm} WPM / ${achievedAcc}% — need ${reqWpm} WPM / ${reqAccuracy}%. Try again!`,
      });
    }

    // Clear pending refs
    pendingChapterIdRef.current  = null;
    pendingDifficultyRef.current = null;
  }

  async function safeMarkComplete(
    chapterId:  string,
    difficulty: Difficulty,
    wpm:        number,
    accuracy:   number,
  ) {
    // Optimistic local update (instant UI unlock)
    setCompletedIds((prev) => new Set([...prev, chapterId]));

    try {
      if (tokens?.accessToken) {
        await lessonsApi.markProgress(
          { chapterId, difficulty, wpmAchieved: wpm, accuracyAchieved: accuracy },
          tokens.accessToken,
        );
      }
      // Force Next.js cache invalidation
      router.refresh();
    } catch (err: any) {
      console.error('[Academy] markProgress failed:', err.message);
      // Revert optimistic update on failure
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(chapterId);
        return next;
      });
    }
  }

  // ── Chapter start handler ────────────────────────────────────────────────
  const handleChapterStart = useCallback((chapter: Chapter, lesson: Lesson) => {
    if (chapter.type === 'test') {
      // Open difficulty selector modal
      setPendingChapter(chapter);
      setPendingLesson(lesson);
    } else {
      // Direct launch
      void launchChapter(chapter, lesson, 'easy');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function launchChapter(
    chapter:    Chapter,
    _lesson:    Lesson,
    difficulty: Difficulty,
  ) {
    if (!tokens?.accessToken) {
      router.push('/login');
      return;
    }

    setStartingId(chapter.id);
    setIsLaunching(true);
    setSessionError('');

    // Store refs for post-session evaluation
    pendingChapterIdRef.current  = chapter.id;
    pendingDifficultyRef.current = difficulty;

    try {
      const payload = await lessonsApi.generate(chapter.lessonConfigId, tokens.accessToken);

      initSession(
        {
          mode:        'words',
          duration:    0,
          wordCount:   payload.wordCount,
          language:    'english',
          lessonId:    payload.lessonId,
          allowedKeys: payload.config.allowedKeys,
        },
        payload.words,
      );

      // Compute nextRoute
      const allChapters = curriculum.flatMap(l => l.chapters);
      const currentIndex = allChapters.findIndex(ch => ch.id === chapter.id);
      const nextChapter = currentIndex !== -1 && currentIndex + 1 < allChapters.length 
        ? allChapters[currentIndex + 1] 
        : null;
      
      const nextRoute = nextChapter 
        ? `/learn?autoLaunch=${nextChapter.id}`
        : `/learn`;

      const isTest = chapter.type === 'test';
      const mod = DifficultyModifiers[difficulty];
      const reqWpm = isTest ? Math.round((chapter.basePassingWpm ?? 0) * mod.wpmMultiplier) : 0;
      const reqAcc = isTest ? mod.accuracyReq : 0;

      router.push(`/practice?lessonId=${encodeURIComponent(payload.lessonId)}&isAcademy=1&nextRoute=${encodeURIComponent(nextRoute)}&reqWpm=${reqWpm}&reqAcc=${reqAcc}`);

    } catch (err: any) {
      setSessionError(err.message ?? 'Failed to start chapter. Please try again.');
      pendingChapterIdRef.current  = null;
      pendingDifficultyRef.current = null;
    } finally {
      setStartingId(null);
      setIsLaunching(false);
    }
  }

  // ── Difficulty modal confirm ─────────────────────────────────────────────
  const handleDifficultyConfirm = useCallback(async (difficulty: Difficulty) => {
    if (!pendingChapter || !pendingLesson) return;
    const chapter = pendingChapter;
    const lesson  = pendingLesson;
    setPendingChapter(null);
    setPendingLesson(null);
    await launchChapter(chapter, lesson, difficulty);
  }, [pendingChapter, pendingLesson]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDifficultyCancel = useCallback(() => {
    setPendingChapter(null);
    setPendingLesson(null);
  }, []);

  // ── Derived stats ────────────────────────────────────────────────────────
  const allChapterCount   = curriculum.flatMap((l) => l.chapters).length;
  const completedChapterCount = completedIds.size;

  // Active lesson = first non-complete, non-locked
  const activeLesson = curriculum.find(
    (l) => !l.isLocked && !l.chapters.every((ch) => ch.isCompleted),
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10 animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <GraduationCap size={20} className="text-violet-light" strokeWidth={2} />
          <h1 className="text-2xl font-semibold text-correct font-mono">
            Academy
            <span className="text-violet-light"> /</span>
            <span className="text-untyped text-lg font-normal"> Curriculum</span>
          </h1>
        </div>
        <p className="text-muted text-sm mt-1 font-mono">
          {curriculum.length} lessons · {allChapterCount} chapters · complete each lesson's Boss Test to advance.
        </p>

        {/* Global progress bar */}
        {!isLoading && (
          <div className="mt-4">
            <GlobalProgressBar
              completed={completedChapterCount}
              total={allChapterCount}
            />
          </div>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 flex items-center gap-3 bg-incorrect/10 border border-incorrect/30
                        text-incorrect text-sm px-4 py-3 rounded-xl font-mono" role="alert">
          <span className="flex-1">{error}</span>
          <button onClick={fetchProgress} className="flex items-center gap-1 text-xs underline opacity-70">
            <RefreshCw size={11} /> retry
          </button>
        </div>
      )}

      {sessionError && (
        <div className="mb-6 bg-incorrect/10 border border-incorrect/30 text-incorrect
                        text-sm px-4 py-3 rounded-xl font-mono" role="alert">
          ⚠ {sessionError}
        </div>
      )}

      {/* ── Guest nudge ─────────────────────────────────────────────────── */}
      {!user && !isLoading && (
        <div className="mb-6 glass border border-violet/20 rounded-2xl px-5 py-3
                        flex items-center justify-between gap-4">
          <p className="text-sm text-muted font-mono">
            Sign in to save chapter progress across devices.
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

      {/* ── Skeleton ────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-surface-2 border border-surface-3 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Lesson accordions ────────────────────────────────────────────── */}
      {!isLoading && !error && (
        <div className="flex flex-col gap-4">
          {curriculum.map((lesson) => (
            <LessonAccordion
              key={lesson.id}
              lesson={lesson}
              defaultOpen={activeLesson?.id === lesson.id}
              startingId={startingId}
              onStart={handleChapterStart}
            />
          ))}
        </div>
      )}

      {/* ── Footer note ──────────────────────────────────────────────────── */}
      {!isLoading && !error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center text-[11px] font-mono text-untyped mt-8"
        >
          complete every chapter in a lesson · defeat the boss · unlock the next level
        </motion.p>
      )}

      {/* ── Difficulty selector modal ─────────────────────────────────────── */}
      {pendingChapter && (
        <DifficultySelector
          chapter={pendingChapter}
          onConfirm={handleDifficultyConfirm}
          onCancel={handleDifficultyCancel}
          isLaunching={isLaunching}
        />
      )}

      {/* ── Pass/fail toast ──────────────────────────────────────────────── */}
      {toast && (
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

export default function LearnPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100dvh-52px)] items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet/40 border-t-violet animate-spin" />
      </div>
    }>
      <LearnContent />
    </Suspense>
  );
}
