'use client';
/**
 * TypingArena — orchestrator component.
 *
 * RENDER BUDGET:
 *   • Renders once on mount (status idle).
 *   • Renders once on 'running' (caret starts, input enabled).
 *   • Renders every 500 ms for live stats (only the stat bar subtree).
 *   • Renders once on 'finished' (ResultsPanel overlaid).
 *   • NEVER re-renders on individual keystrokes.
 *
 * Tree structure:
 *   TypingArena
 *   ├── LessonBreadcrumb (lesson mode only — renders once per session)
 *   ├── ConfigBar        (practice mode only — renders once, only on config change)
 *   ├── StatsBar         (WPM + ACC — re-renders every 500 ms via selector)
 *   ├── WordDisplay      (word/char grid — renders ONCE, ref-mutated after)
 *   ├── InputCapture     (hidden input — renders once)
 *   ├── SessionTimer     (time — re-renders every 1 s)
 *   └── ResultsPanel     (overlay — renders once on finish)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTypingStore, selectStatus, selectWords, selectLiveStats,
         selectConfig } from '@/store/typingStore';
import { useTypingEngine } from '@/hooks/useTypingEngine';
import { useSessionSubmit } from '@/hooks/useSessionSubmit';
import { useKeyboardBridge } from '@/hooks/useKeyboardBridge';
import { useUserStore, selectTokens } from '@/store/userStore';
import { lessonsApi } from '@/lib/api';
import WordDisplay   from './WordDisplay';
import InputCapture  from './InputCapture';
import SessionTimer  from './SessionTimer';
import ResultsPanel  from './ResultsPanel';
import LiveKeyboard  from './LiveKeyboard';
import { TIME_MODE_OPTIONS, WORDS_MODE_OPTIONS } from '@typing-master/shared';

// ── Live stats bar ─────────────────────────────────────────────────────────────
const StatsBar = React.memo(function StatsBar() {
  const { wpm, accuracy } = useTypingStore(selectLiveStats);
  return (
    <div className="flex items-end justify-center gap-12 h-16">
      <div className="flex flex-col items-center">
        <span id="live-wpm" className="stat-value">{wpm}</span>
        <span className="stat-label">wpm</span>
      </div>
      <div className="flex flex-col items-center">
        <span id="live-accuracy" className="stat-value">{accuracy}<span className="text-xl">%</span></span>
        <span className="stat-label">acc</span>
      </div>
    </div>
  );
});

// ── Config bar (practice mode only) ───────────────────────────────────────────
const ConfigBar = React.memo(function ConfigBar({
  onModeChange,
  onDurationChange,
  onWordCountChange,
}: {
  onModeChange:      (mode: 'time' | 'words') => void;
  onDurationChange:  (s: number)              => void;
  onWordCountChange: (n: number)              => void;
}) {
  const config   = useTypingStore(selectConfig);
  const status   = useTypingStore(selectStatus);
  const disabled = status !== 'idle';

  return (
    <div className="flex items-center justify-center gap-2 text-sm font-mono select-none">
      {/* Mode toggle */}
      {(['time', 'words'] as const).map((m) => (
        <button
          key={m}
          id={`mode-${m}`}
          onClick={() => !disabled && onModeChange(m)}
          className={`px-3 py-1.5 rounded-lg transition-all duration-150 ${
            config.mode === m
              ? 'bg-violet/20 text-violet-light border border-violet/30'
              : 'text-untyped hover:text-muted border border-transparent'
          } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {m}
        </button>
      ))}

      <div className="w-px h-4 bg-surface-3 mx-1" />

      {/* Duration options (time mode) */}
      {config.mode === 'time' &&
        TIME_MODE_OPTIONS.map((s) => (
          <button
            key={s}
            id={`duration-${s}`}
            onClick={() => !disabled && onDurationChange(s)}
            className={`px-3 py-1.5 rounded-lg transition-all duration-150 ${
              config.duration === s
                ? 'bg-violet/20 text-violet-light border border-violet/30'
                : 'text-untyped hover:text-muted border border-transparent'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {s}
          </button>
        ))}

      {/* Word count options (words mode) */}
      {config.mode === 'words' &&
        WORDS_MODE_OPTIONS.map((n) => (
          <button
            key={n}
            id={`wordcount-${n}`}
            onClick={() => !disabled && onWordCountChange(n)}
            className={`px-3 py-1.5 rounded-lg transition-all duration-150 ${
              config.wordCount === n
                ? 'bg-violet/20 text-violet-light border border-violet/30'
                : 'text-untyped hover:text-muted border border-transparent'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {n}
          </button>
        ))}
    </div>
  );
});

// ── Lesson breadcrumb (lesson mode only) ──────────────────────────────────────
const LessonBreadcrumb = React.memo(function LessonBreadcrumb({
  lessonId,
  isRegenerating,
}: {
  lessonId: string;
  isRegenerating: boolean;
}) {
  const router = useRouter();
  // Derive a human-readable label from the slug (e.g. 'lesson-01-home-core' → 'Home Core')
  const label = lessonId
    .replace(/^lesson-\d+-/, '')   // strip 'lesson-01-'
    .replace(/-/g, ' ')            // hyphens → spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case

  return (
    <div className="flex items-center justify-between w-full">
      {/* Back link */}
      <button
        id="lesson-back-btn"
        onClick={() => router.push('/learn')}
        className="text-xs font-mono text-untyped hover:text-muted transition-colors
                   flex items-center gap-1.5"
      >
        ← Academy
      </button>

      {/* Lesson title */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-violet-light bg-violet/10
                         border border-violet/20 px-2 py-0.5 rounded-full">
          lesson
        </span>
        <span className="text-sm font-mono text-correct font-semibold">{label}</span>
        {isRegenerating && (
          <span className="text-[10px] font-mono text-untyped animate-pulse">
            generating…
          </span>
        )}
      </div>

      {/* Spacer to balance the back btn */}
      <div className="w-16" />
    </div>
  );
});

// ── Main Arena ─────────────────────────────────────────────────────────────────
export default function TypingArena({ lessonId }: { lessonId?: string }) {
  const isLesson  = Boolean(lessonId);
  const status    = useTypingStore(selectStatus);
  const words     = useTypingStore(selectWords);
  const config    = useTypingStore(selectConfig);
  const setConfig = useTypingStore((s) => s.setConfig);
  const initSession = useTypingStore((s) => s.initSession);
  const tokens    = useUserStore(selectTokens);

  // Tracks whether we are awaiting a lesson regeneration (Tab restart in lesson mode)
  const [isRegenerating, setIsRegenerating] = useState(false);

  // ── Ghost Keyboard: track the physical key currently held down ─────────────
  // This state updates on every keydown/keyup. It is LOCAL — it does NOT go
  // into Zustand. React batches the setState so it never blocks the typing engine.
  // We deliberately skip e.repeat so held keys don't re-fire the flash.
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip auto-repeat (key held) — we only want the initial press flash
      if (e.repeat) return;
      // Tab is handled by the restart listener below; skip it here to avoid
      // `activeKey = 'tab'` flickering during a restart.
      if (e.key === 'Tab') return;
      setActiveKey(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      // Only clear if the key being released is the one we tracked.
      // This prevents Shift+key combos from leaving a stale activeKey.
      setActiveKey((prev) => (prev === e.key.toLowerCase() ? null : prev));
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, []); // empty deps — listeners are stable, no stale closure risk

  // ── Session submission (fires automatically on status → 'finished') ─────────
  useSessionSubmit();
  // ── Phase 2: keyboard visual bridge ────────────────────────────────────────
  useKeyboardBridge();

  const {
    charRefs, wordRefs, caretRef, wrapperRef, inputRef,
    handleWrapperClick, handleKeyDown, startNewSession,
  } = useTypingEngine();

  // ── Lesson-aware restart ──────────────────────────────────────────────────
  // Bug 1 fix: when in lesson mode, restarting must re-fetch from the backend
  // so only allowedKeys-filtered words are generated.
  // In practice mode, the engine's startNewSession() handles this directly.
  const regenerateLesson = useCallback(async () => {
    if (!lessonId || !tokens?.accessToken) {
      console.warn('[Academy] regenerateLesson: no lessonId or token — falling back to startNewSession');
      startNewSession();
      return;
    }
    setIsRegenerating(true);
    console.log('[Academy] Requesting filtered words for lesson:', lessonId);
    try {
      const payload = await lessonsApi.generate(lessonId, tokens.accessToken);
      console.log('[Academy] Payload received:', {
        lessonId:    payload.lessonId,
        wordCount:   payload.wordCount,
        allowedKeys: payload.config.allowedKeys,
        sample:      payload.words.slice(0, 6),
      });
      initSession(
        {
          mode:        'words',
          duration:    0,
          wordCount:   payload.wordCount,
          language:    'english',
          lessonId:    payload.lessonId,
          allowedKeys: payload.config.allowedKeys, // → LiveKeyboard home-zone highlight
        },
        payload.words,
      );
      console.log('[Academy] initSession called — store now has', payload.words.length, 'filtered words');
      // startNewSession() will now find lessonId set → reuses liveWords (no pickWords)
      startNewSession();
    } catch (err) {
      console.error('[Academy] regenerateLesson failed:', err);
      startNewSession(); // fallback
    } finally {
      setIsRegenerating(false);
    }
  }, [lessonId, tokens, initSession, startNewSession]);

  const handleRestart = useCallback(() => {
    if (isLesson) {
      void regenerateLesson();
    } else {
      startNewSession();
    }
  }, [isLesson, regenerateLesson, startNewSession]);

  // Tab key = restart (global shortcut)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        handleRestart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRestart]);

  // ── Practice mode config handlers ────────────────────────────────────────
  const handleModeChange = useCallback((mode: 'time' | 'words') => {
    setConfig({ mode, lessonId: undefined });
    startNewSession();
  }, [setConfig, startNewSession]);

  const handleDurationChange = useCallback((duration: number) => {
    setConfig({ duration, lessonId: undefined });
    startNewSession();
  }, [setConfig, startNewSession]);

  const handleWordCountChange = useCallback((wordCount: number) => {
    setConfig({ wordCount, lessonId: undefined });
    startNewSession();
  }, [setConfig, startNewSession]);

  return (
    <div
      id="typing-arena"
      className="flex flex-col items-center gap-8 w-full max-w-3xl mx-auto px-4 py-8"
    >
      {/* Bug 2 — conditional header row */}
      {isLesson ? (
        // Lesson mode: breadcrumb with back link, no toggles
        <LessonBreadcrumb
          lessonId={lessonId!}
          isRegenerating={isRegenerating}
        />
      ) : (
        // Practice mode: standard config toggles
        <ConfigBar
          onModeChange={handleModeChange}
          onDurationChange={handleDurationChange}
          onWordCountChange={handleWordCountChange}
        />
      )}

      {/* Stats + Timer */}
      <div className="flex items-center justify-between w-full">
        <StatsBar />
        <div className="flex flex-col items-center">
          <SessionTimer />
          <span className="stat-label">
            {status === 'running' ? 'remaining' : 'time'}
          </span>
        </div>
      </div>

      {/* Typing area — position:relative for caret + results overlay */}
      <div className="relative w-full">
        {/* Word display + caret */}
        <WordDisplay
          key={words.join('-').slice(0, 40)} // remount only on new session
          words={words}
          charRefs={charRefs}
          wordRefs={wordRefs}
          caretRef={caretRef}
          wrapperRef={wrapperRef}
          onWrapperClick={handleWrapperClick}
        />

        {/* Results overlay */}
        {status === 'finished' && (
          <ResultsPanel onRestart={handleRestart} />
        )}
      </div>

      {/* Hidden input */}
      <InputCapture
        inputRef={inputRef as React.RefObject<HTMLInputElement>}
        onKeyDown={handleKeyDown}
        disabled={status === 'finished'}
      />

      {/* ── Ghost Keyboard ────────────────────────────────────────────────────
           Purely visual — observes hardware keystrokes via activeKey prop.
           In lesson mode, illuminates allowed keys with a persistent tint.
           Collapsed (opacity-0 + h-0) when session is finished to keep the
           ResultsPanel clean. No prevent-default, no engine interaction. */}
      <div
        className={`w-full transition-all duration-300 ${
          status === 'finished'
            ? 'opacity-0 pointer-events-none h-0 overflow-hidden'
            : 'opacity-100'
        }`}
      >
        <LiveKeyboard
          mode={isLesson ? 'lesson' : 'practice'}
          allowedKeys={isLesson ? (config.allowedKeys ?? []) : []}
          activeKey={activeKey}
        />
      </div>

      {/* Footer hint */}
      <p className="text-untyped text-xs font-mono">
        {status === 'idle'     && 'start typing to begin · '}
        {status === 'finished' && 'press '}
        {status !== 'running'  && (
          <kbd className="bg-surface-2 border border-surface-3 px-1.5 py-0.5 rounded text-muted">
            tab
          </kbd>
        )}
        {status === 'idle'     && ' to restart'}
        {status === 'finished' && ' to restart'}
      </p>
    </div>
  );
}
