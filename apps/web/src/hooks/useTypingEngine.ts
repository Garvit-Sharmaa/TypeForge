'use client';
/**
 * useTypingEngine — The core typing engine.
 *
 * ZERO-LATENCY MANDATE IMPLEMENTATION:
 *   • All per-keystroke state lives in `engineRef` (plain mutable object).
 *   • Character DOM nodes are mutated directly via `charRefs` grid.
 *   • Caret position is set via `caretRef.current.style` (CSS transforms).
 *   • Zustand is called ONLY on:
 *       — session start (once)
 *       — every 500 ms live-stats tick
 *       — session completion (once)
 *   • This guarantees zero React re-renders during active typing.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTypingStore } from '@/store/typingStore';
import type { KeystrokeEvent } from '@typing-master/shared';
import { ANTI_CHEAT } from '@typing-master/shared';
import { dispatchKeyPressEvent, dispatchTargetChangeEvent } from '@/hooks/useKeyboardBridge';

// ─── Engine transient state (lives in a ref, never triggers re-renders) ───────
interface EngineState {
  wordIdx:   number;
  charIdx:   number;
  /** What the user has typed so far for the CURRENT word */
  input:     string;

  sessionStartTime: number | null;
  lastKeyTime:      number | null;

  totalKeystrokes:   number;
  correctKeystrokes: number;
  correctWords:      number;
  /** Word indices where the user finished with at least one error */
  errorWordIndices:  Set<number>;

  /** Per-character error tracking for weak-key heatmap */
  charStats: Map<string, { total: number; errors: number; totalLatencyMs: number }>;

  /** Raw keystroke events buffer (submitted to API on completion) */
  keystrokeEvents: KeystrokeEvent[];

  /** Flag set by the 500 ms interval to throttle DOM reads */
  caretNeedsUpdate: boolean;
}

// ─── Hook return type ─────────────────────────────────────────────────────────
export interface TypingEngineHandles {
  /** 2-D ref grid: charRefs[wordIdx][charIdx] = <span> DOM node */
  charRefs:  React.MutableRefObject<(HTMLSpanElement | null)[][]>;
  /** Word container refs (used for row-scroll) */
  wordRefs:  React.MutableRefObject<(HTMLSpanElement | null)[]>;
  /** The animated caret element */
  caretRef:  React.MutableRefObject<HTMLDivElement | null>;
  /** The words wrapper (scroll container) */
  wrapperRef: React.MutableRefObject<HTMLDivElement | null>;
  /** The hidden input that captures keystrokes */
  inputRef:  React.MutableRefObject<HTMLInputElement | null>;
  /** Attach to the wrapper div to capture clicks → focus hidden input */
  handleWrapperClick: () => void;
  /** The raw keydown handler (attached to the hidden input) */
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Re-generate a fresh session (called by "Restart" or config change) */
  startNewSession: () => void;
}

// ─── Word list (200 common English words) ────────────────────────────────────
const WORD_LIST = [
  'the','be','to','of','and','a','in','that','have','it','for','not','on',
  'with','he','as','you','do','at','this','but','his','by','from','they','we',
  'say','her','she','or','an','will','my','one','all','would','there','their',
  'what','so','up','out','if','about','who','get','which','go','me','when',
  'make','can','like','time','no','just','him','know','take','people','into',
  'year','your','good','some','could','them','see','other','than','then','now',
  'look','only','come','its','over','think','also','back','after','use','two',
  'how','our','work','first','well','way','even','new','want','because','any',
  'these','give','day','most','us','great','between','need','large','often',
  'hand','high','place','hold','turn','move','live','try','run','set','plan',
  'write','read','change','keep','find','put','tell','call','here','help',
  'next','still','late','own','yet','soon','long','always','show','door','town',
  'once','real','part','open','seem','together','face','hard','cut','force',
  'natural','press','close','dark','line','serve','stand','add','clear','sense',
  'draw','step','stop','pass','reach','small','free','fact','close','power',
  'light','voice','white','black','full','fire','area','body','field','order',
  'love','point','play','small','number','off','always','move','night','live',
];

function pickWords(count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)]);
  }
  return result;
}

// ─── char → KeyboardEvent.code (for bridge target dispatch) ──────────────────
const CHAR_TO_CODE: Record<string, string> = {
  ' ':'Space','\n':'Enter','\t':'Tab',
  'a':'KeyA','b':'KeyB','c':'KeyC','d':'KeyD','e':'KeyE','f':'KeyF',
  'g':'KeyG','h':'KeyH','i':'KeyI','j':'KeyJ','k':'KeyK','l':'KeyL',
  'm':'KeyM','n':'KeyN','o':'KeyO','p':'KeyP','q':'KeyQ','r':'KeyR',
  's':'KeyS','t':'KeyT','u':'KeyU','v':'KeyV','w':'KeyW','x':'KeyX',
  'y':'KeyY','z':'KeyZ',
  '0':'Digit0','1':'Digit1','2':'Digit2','3':'Digit3','4':'Digit4',
  '5':'Digit5','6':'Digit6','7':'Digit7','8':'Digit8','9':'Digit9',
  '-':'Minus','=':'Equal','[':'BracketLeft',']':'BracketRight',
  '\\':'Backslash',';':'Semicolon',"'":'Quote',',':'Comma','.':'Period','/':'Slash',
  '`':'Backquote',
};
function charToCode(char: string): string {
  return CHAR_TO_CODE[char.toLowerCase()] ?? `Key${char.toUpperCase()}`;
}

// ─── Char class helpers (direct DOM mutation, no React) ───────────────────────
const setCharClass = (el: HTMLSpanElement | null | undefined, cls: string) => {
  if (el) el.className = `char ${cls}`;
};

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useTypingEngine(): TypingEngineHandles {
  const { config, words, status, initSession, setStatus, setCountdown,
          updateLiveStats, completeSession, resetSession } = useTypingStore();

  // ── DOM Refs ──────────────────────────────────────────────────────────────
  const charRefs   = useRef<(HTMLSpanElement | null)[][]>([]);
  const wordRefs   = useRef<(HTMLSpanElement | null)[]>([]);
  const caretRef   = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef   = useRef<HTMLInputElement | null>(null);

  // ── Transient engine state (zero Zustand overhead) ────────────────────────
  const engineRef = useRef<EngineState>({
    wordIdx:   0,
    charIdx:   0,
    input:     '',
    sessionStartTime: null,
    lastKeyTime: null,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    correctWords: 0,
    errorWordIndices: new Set(),
    charStats: new Map(),
    keystrokeEvents: [],
    caretNeedsUpdate: false,
  });

  // ── Interval handles ──────────────────────────────────────────────────────
  const statsIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const caretBlinkTimeoutRef= useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Session time tracking ─────────────────────────────────────────────────
  const timeRemainingRef = useRef<number>(config.duration);

  // ─────────────────────────────────────────────────────────────────────────
  // CARET POSITIONING — direct DOM, zero React overhead
  // ─────────────────────────────────────────────────────────────────────────
  const updateCaretPosition = useCallback(() => {
    const { wordIdx, charIdx } = engineRef.current;
    const caret   = caretRef.current;
    const wrapper = wrapperRef.current;
    if (!caret || !wrapper) return;

    const chars = charRefs.current[wordIdx];
    // Target: the char at charIdx, or the space after the word if at end
    const targetEl = chars?.[charIdx] ?? wordRefs.current[wordIdx];
    if (!targetEl) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const targetRect  = targetEl.getBoundingClientRect();

    const left = targetRect.left - wrapperRect.left;
    const top  = targetRect.top  - wrapperRect.top + wrapper.scrollTop;

    caret.style.left   = `${left}px`;
    caret.style.top    = `${top}px`;
    caret.style.height = `${targetRect.height}px`;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ROW SCROLL — smoothly scroll the word container so the current word
  //              is always in the middle (2nd) row.
  // ─────────────────────────────────────────────────────────────────────────
  const scrollToCurrentWord = useCallback(() => {
    const { wordIdx } = engineRef.current;
    const wordEl  = wordRefs.current[wordIdx];
    const wrapper = wrapperRef.current;
    if (!wordEl || !wrapper) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const wordRect    = wordEl.getBoundingClientRect();
    const rowHeight   = wordRect.height + 12; // approximate line + gap

    // If the word has moved below row 1, scroll the container
    const relativeTop = wordRect.top - wrapperRect.top;
    if (relativeTop >= rowHeight) {
      wrapper.scrollTop += rowHeight;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // CARET BLINK MANAGEMENT — stop blinking while typing, resume on pause
  // ─────────────────────────────────────────────────────────────────────────
  const setCaretTyping = useCallback((typing: boolean) => {
    const caret = caretRef.current;
    if (!caret) return;
    if (typing) {
      caret.classList.add('typing');
      if (caretBlinkTimeoutRef.current) clearTimeout(caretBlinkTimeoutRef.current);
      caretBlinkTimeoutRef.current = setTimeout(() => {
        caret.classList.remove('typing');
      }, 700);
    } else {
      caret.classList.remove('typing');
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTE FINAL RESULTS
  // ─────────────────────────────────────────────────────────────────────────
  const buildResults = useCallback(() => {
    const e = engineRef.current;
    const elapsedMs = e.sessionStartTime
      ? performance.now() - e.sessionStartTime
      : 1;
    const elapsedMin = elapsedMs / 60_000;

    const correctChars = e.correctKeystrokes;
    const totalChars   = e.totalKeystrokes;
    const wpm          = Math.round((e.correctWords * 1) / elapsedMin);
    const rawWpm       = Math.round((totalChars / 5) / elapsedMin);
    const accuracy     = totalChars > 0
      ? Math.round((correctChars / totalChars) * 100)
      : 100;

    // Build weak key map
    const weakKeyMap: Record<string, { errors: number; total: number }> = {};
    e.charStats.forEach((v, k) => {
      if (v.errors > 0) weakKeyMap[k] = { errors: v.errors, total: v.total };
    });

    return {
      wpm,
      rawWpm,
      accuracy,
      correctWords: e.correctWords,
      totalWords:   words.length,
      correctChars,
      totalChars,
      durationMs:   elapsedMs,
      keystrokeEvents: e.keystrokeEvents,
      weakKeyMap,
    };
  }, [words.length]);

  // ─────────────────────────────────────────────────────────────────────────
  // SESSION COMPLETION
  // ─────────────────────────────────────────────────────────────────────────
  const finishSession = useCallback(() => {
    if (statsIntervalRef.current)  clearInterval(statsIntervalRef.current);
    if (timerIntervalRef.current)  clearInterval(timerIntervalRef.current);
    completeSession(buildResults());
  }, [buildResults, completeSession]);

  // ─────────────────────────────────────────────────────────────────────────
  // START SESSION INTERVALS (stats tick + countdown timer)
  // ─────────────────────────────────────────────────────────────────────────
  const startIntervals = useCallback(() => {
    // 500 ms stats tick — only Zustand call during active typing
    statsIntervalRef.current = setInterval(() => {
      const e = engineRef.current;
      if (!e.sessionStartTime) return;

      const elapsedMs  = performance.now() - e.sessionStartTime;
      const elapsedMin = elapsedMs / 60_000;
      const wpm    = elapsedMin > 0
        ? Math.round((e.correctWords) / elapsedMin) : 0;
      const rawWpm = elapsedMin > 0
        ? Math.round((e.totalKeystrokes / 5) / elapsedMin) : 0;
      const accuracy = e.totalKeystrokes > 0
        ? Math.round((e.correctKeystrokes / e.totalKeystrokes) * 100) : 100;

      updateLiveStats({
        wpm,
        rawWpm,
        accuracy,
        timeRemaining: Math.max(0, timeRemainingRef.current),
        wordProgress:  engineRef.current.wordIdx,
      });
    }, 500);

    // 1 s countdown timer (time mode only)
    // Read fresh config — startIntervals is called from handleKeyDown which
    // may close over a stale config snapshot from before the last toggle.
    const { mode, duration } = useTypingStore.getState().config;
    if (mode === 'time') {
      timeRemainingRef.current = duration;
      timerIntervalRef.current = setInterval(() => {
        timeRemainingRef.current -= 1;
        if (timeRemainingRef.current <= 0) {
          clearInterval(timerIntervalRef.current!);
          finishSession();
        }
      }, 1000);
    }
  }, [finishSession, updateLiveStats]);

  // ─────────────────────────────────────────────────────────────────────────
  // START NEW SESSION (called on mount + when config changes + restart)
  // ─────────────────────────────────────────────────────────────────────────
  const startNewSession = useCallback(() => {
    // Clear any running intervals
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const liveConfig = useTypingStore.getState().config;
    const liveWords  = useTypingStore.getState().words;

    // ── Word selection: STRICT mode branch ───────────────────────────────────
    //
    // LESSON MODE  (liveConfig.lessonId is set):
    //   Use liveWords — the backend-filtered word list already loaded into the
    //   store by either the Academy page (on first load) or regenerateLesson()
    //   (on Tab restart). pickWords() draws from the general WORD_LIST and
    //   must NEVER run here, or the allowedKeys filter is silently bypassed.
    //
    // PRACTICE MODE (liveConfig.lessonId is undefined):
    //   Pick fresh random words from the full English dictionary.
    //   Toggle handlers (handleModeChange etc.) always call
    //   setConfig({ lessonId: undefined }) before startNewSession(), so by
    //   the time we reach this point, any stale lessonId is already cleared.
    //
    let newWords: string[];
    if (liveConfig.lessonId && liveWords.length > 0) {
      // Lesson mode — reuse the filtered words from the store
      newWords = liveWords;
      console.log(
        '[Engine] startNewSession → LESSON mode',
        `lessonId="${liveConfig.lessonId}"`,
        `words[${newWords.length}]:`, newWords.slice(0, 6),
      );
    } else {
      // Practice mode — pick random words
      newWords = pickWords(liveConfig.wordCount);
      console.log(
        '[Engine] startNewSession → PRACTICE mode',
        `count=${newWords.length}`,
        'sample:', newWords.slice(0, 6),
      );
    }

    initSession(liveConfig, newWords);

    // Reset engine state
    engineRef.current = {
      wordIdx:    0,
      charIdx:    0,
      input:      '',
      sessionStartTime: null,
      lastKeyTime: null,
      totalKeystrokes:   0,
      correctKeystrokes: 0,
      correctWords:      0,
      errorWordIndices:  new Set(),
      charStats:         new Map(),
      keystrokeEvents:   [],
      caretNeedsUpdate:  false,
    };
    timeRemainingRef.current = liveConfig.duration;

    // Reset all char DOM nodes back to untyped class (after next paint)
    requestAnimationFrame(() => {
      charRefs.current.forEach((wordChars) =>
        wordChars?.forEach((el) => setCharClass(el, '')),
      );
      wordRefs.current.forEach((el) => {
        if (el) el.className = 'word';
      });
      if (wrapperRef.current) wrapperRef.current.scrollTop = 0;
      updateCaretPosition();
      inputRef.current?.focus();
    });
  }, [initSession, updateCaretPosition]);

  // ─────────────────────────────────────────────────────────────────────────
  // CORE KEYSTROKE HANDLER — the hot path. Zero Zustand calls here.
  // ─────────────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Only handle printable chars, space, and backspace
      if (e.key === 'Tab') { e.preventDefault(); return; }
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const eng    = engineRef.current;
      const { wordIdx, charIdx } = eng;
      const word   = words[wordIdx];
      if (!word) return;

      // ── First keystroke: transition idle → running ──────────────────────
      if (status === 'idle') {
        eng.sessionStartTime = performance.now();
        eng.lastKeyTime      = eng.sessionStartTime;
        setStatus('running');
        startIntervals();
      }
      if (status === 'finished') return;

      const now     = performance.now();
      const latency = eng.lastKeyTime ? now - eng.lastKeyTime : 0;
      eng.lastKeyTime = now;

      // ── BACKSPACE ───────────────────────────────────────────────────────
      if (e.key === 'Backspace') {
        if (eng.charIdx > 0) {
          eng.charIdx--;
          eng.input = eng.input.slice(0, -1);
          // Reset the char's class to untyped
          setCharClass(charRefs.current[wordIdx]?.[eng.charIdx], '');
        } else if (eng.wordIdx > 0 && eng.input === '') {
          // Move back to previous word
          eng.wordIdx--;
          const prevWord  = words[eng.wordIdx];
          eng.charIdx     = prevWord.length;
          eng.input       = eng.input; // will be reconstructed from DOM
          if (wordRefs.current[eng.wordIdx]) {
            wordRefs.current[eng.wordIdx]!.className = 'word';
          }
        }
        updateCaretPosition();
        return;
      }

      // ── SPACE: attempt to advance word ──────────────────────────────────
      if (e.key === ' ') {
        e.preventDefault();
        if (eng.input.length === 0) return; // must type at least 1 char

        const isWordCorrect = eng.input === word;
        if (isWordCorrect) {
          eng.correctWords++;
        } else {
          eng.errorWordIndices.add(eng.wordIdx);
          if (wordRefs.current[eng.wordIdx]) {
            wordRefs.current[eng.wordIdx]!.className = 'word word-error';
          }
        }

        // Advance to next word
        eng.wordIdx++;
        eng.charIdx = 0;
        eng.input   = '';

        // Check words-mode completion
        if (config.mode === 'words' && eng.wordIdx >= words.length) {
          finishSession();
          return;
        }

        scrollToCurrentWord();
        updateCaretPosition();
        setCaretTyping(true);
        return;
      }

      // ── PRINTABLE CHARACTER ──────────────────────────────────────────────
      if (e.key.length !== 1) return;

      const expectedChar = word[charIdx];
      const isCorrect    = e.key === expectedChar;

      // Track stats
      eng.totalKeystrokes++;
      if (isCorrect) eng.correctKeystrokes++;

      // Per-key stat tracking (for weak-key heatmap)
      const existing = eng.charStats.get(expectedChar) ?? { total: 0, errors: 0, totalLatencyMs: 0 };
      eng.charStats.set(expectedChar, {
        total:         existing.total + 1,
        errors:        existing.errors + (isCorrect ? 0 : 1),
        totalLatencyMs: existing.totalLatencyMs + latency,
      });

      // Buffer keystroke event
      const absPosition = words.slice(0, wordIdx).join(' ').length +
                          (wordIdx > 0 ? 1 : 0) + charIdx;
      eng.keystrokeEvents.push({
        key:         e.key,
        expectedKey: expectedChar,
        isCorrect,
        latencyMs:   Math.round(latency),
        position:    absPosition,
        timestamp:   Math.round(now - (eng.sessionStartTime ?? now)),
      });

      // → Phase 2 bridge: visual key press
      dispatchKeyPressEvent({
        code:       e.code,
        key:        e.key,
        isCorrect,
        targetChar: expectedChar,
      });

      // → Phase 2 bridge: advance target to next char
      const nextChar = word[charIdx + 1] ?? (words[wordIdx + 1]?.[0]);
      if (nextChar !== undefined) {
        dispatchTargetChangeEvent({ code: charToCode(nextChar) });
      }

      // ── Directly mutate the char span's class ──────────────────────────
      setCharClass(
        charRefs.current[wordIdx]?.[charIdx],
        isCorrect ? 'correct' : 'incorrect',
      );

      eng.input  += e.key;
      eng.charIdx = charIdx + 1;

      // Advance caret
      updateCaretPosition();
      setCaretTyping(true);
    },
    [words, status, config.mode, setStatus, startIntervals,
     updateCaretPosition, scrollToCurrentWord, setCaretTyping, finishSession],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // WRAPPER CLICK → focus hidden input
  // ─────────────────────────────────────────────────────────────────────────
  const handleWrapperClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  // Init on mount
  useEffect(() => {
    startNewSession();
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (caretBlinkTimeoutRef.current) clearTimeout(caretBlinkTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move caret to position 0 after words load
  useEffect(() => {
    if (words.length > 0) {
      requestAnimationFrame(() => updateCaretPosition());
    }
  }, [words, updateCaretPosition]);

  return {
    charRefs,
    wordRefs,
    caretRef,
    wrapperRef,
    inputRef,
    handleWrapperClick,
    handleKeyDown,
    startNewSession,
  };
}
