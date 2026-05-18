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
 *   ├── ConfigBar        (mode selector — renders once, only on config change)
 *   ├── StatsBar         (WPM + ACC — re-renders every 500 ms via selector)
 *   ├── WordDisplay      (word/char grid — renders ONCE, ref-mutated after)
 *   ├── InputCapture     (hidden input — renders once)
 *   ├── SessionTimer     (time — re-renders every 1 s)
 *   └── ResultsPanel     (overlay — renders once on finish)
 */

'use client';

import React, { useCallback, useEffect } from 'react';
import { useTypingStore, selectStatus, selectWords, selectLiveStats,
         selectConfig } from '@/store/typingStore';
import { useTypingEngine } from '@/hooks/useTypingEngine';
import { useSessionSubmit } from '@/hooks/useSessionSubmit';
import { useKeyboardBridge } from '@/hooks/useKeyboardBridge';
import WordDisplay   from './WordDisplay';
import InputCapture  from './InputCapture';
import SessionTimer  from './SessionTimer';
import ResultsPanel  from './ResultsPanel';
import { TIME_MODE_OPTIONS, WORDS_MODE_OPTIONS } from '@typing-master/shared';

// ── Live stats bar (subscribes to liveStats slice) ────────────────────────────
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

// ── Config bar ────────────────────────────────────────────────────────────────
const ConfigBar = React.memo(function ConfigBar({
  onModeChange,
  onDurationChange,
  onWordCountChange,
}: {
  onModeChange:      (mode: 'time' | 'words') => void;
  onDurationChange:  (s: number)              => void;
  onWordCountChange: (n: number)              => void;
}) {
  const config = useTypingStore(selectConfig);
  const status = useTypingStore(selectStatus);
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

// ── Main Arena ─────────────────────────────────────────────────────────────────
export default function TypingArena() {
  const status  = useTypingStore(selectStatus);
  const words   = useTypingStore(selectWords);
  const setConfig = useTypingStore((s) => s.setConfig);

  // ── Session submission (fires automatically on status → 'finished') ────────
  const submitState = useSessionSubmit();
  // ── Phase 2: keyboard visual bridge ──────────────────────────────────────────
  useKeyboardBridge();

  const {
    charRefs, wordRefs, caretRef, wrapperRef, inputRef,
    handleWrapperClick, handleKeyDown, startNewSession,
  } = useTypingEngine();

  // Tab key = restart (global shortcut)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        startNewSession();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startNewSession]);

  const handleModeChange = useCallback((mode: 'time' | 'words') => {
    setConfig({ mode });
    startNewSession();
  }, [setConfig, startNewSession]);

  const handleDurationChange = useCallback((duration: number) => {
    setConfig({ duration });
    startNewSession();
  }, [setConfig, startNewSession]);

  const handleWordCountChange = useCallback((wordCount: number) => {
    setConfig({ wordCount });
    startNewSession();
  }, [setConfig, startNewSession]);

  return (
    <div
      id="typing-arena"
      className="flex flex-col items-center gap-8 w-full max-w-3xl mx-auto px-4 py-8"
    >
      {/* Config row */}
      <ConfigBar
        onModeChange={handleModeChange}
        onDurationChange={handleDurationChange}
        onWordCountChange={handleWordCountChange}
      />

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
          <ResultsPanel onRestart={startNewSession} />
        )}
      </div>

      {/* Hidden input */}
      <InputCapture
        inputRef={inputRef as React.RefObject<HTMLInputElement>}
        onKeyDown={handleKeyDown}
        disabled={status === 'finished'}
      />

      {/* Footer hint */}
      <p className="text-untyped text-xs font-mono">
        {status === 'idle' && 'start typing to begin · '}
        {status === 'finished' && 'press '}
        {status !== 'running' && (
          <kbd className="bg-surface-2 border border-surface-3 px-1.5 py-0.5 rounded text-muted">
            tab
          </kbd>
        )}
        {status === 'idle'    && ' to restart'}
        {status === 'finished'&& ' to restart'}
      </p>
    </div>
  );
}
