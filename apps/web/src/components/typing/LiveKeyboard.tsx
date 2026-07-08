'use client';
/**
 * LiveKeyboard — Ghost Keyboard visual observer.
 *
 * CRITICAL RULES (do not violate):
 *   • ZERO calls to e.preventDefault() — this component never touches keyboard events.
 *   • ZERO interaction with useTypingEngine, typingStore, or session submission.
 *   • ZERO interaction with keyboardStore (that is the heatmap/SVG system).
 *   • It is a purely visual component: it receives `activeKey` as a prop and renders.
 *
 * Visual states (in priority order, highest wins):
 *   1. PRESSED  — activeKey matches this key's char → depress flash (overrides all)
 *   2. ALLOWED  — lesson mode + key in allowedKeys → persistent violet tint highlight
 *   3. DEFAULT  — all other keys → dim, recessed appearance
 */

import React, { useState, useEffect } from 'react';

// ── QWERTY layout matrix ──────────────────────────────────────────────────────
// Each row is an array of { char, widthClass }.
// `char` is the lowercase character used for hit-testing against activeKey/allowedKeys.
// `display` is the label shown inside the key cap.
// `flex` is the Tailwind flex-grow value for non-1-unit keys.

interface KeyDef {
  char:    string;   // canonical lowercase key for comparisons
  display: string;   // label rendered inside the cap
  flex?:   number;   // flex-grow multiplier (1 = standard, 1.5 = backspace, etc.)
}

const ROW_0: KeyDef[] = [
  { char: '`', display: '`' }, { char: '1', display: '1' },
  { char: '2', display: '2' }, { char: '3', display: '3' },
  { char: '4', display: '4' }, { char: '5', display: '5' },
  { char: '6', display: '6' }, { char: '7', display: '7' },
  { char: '8', display: '8' }, { char: '9', display: '9' },
  { char: '0', display: '0' }, { char: '-', display: '-' },
  { char: '=', display: '=' }, { char: 'backspace', display: '⌫', flex: 1.5 },
];

const ROW_1: KeyDef[] = [
  { char: 'tab', display: 'tab', flex: 1.5 },
  { char: 'q', display: 'Q' }, { char: 'w', display: 'W' },
  { char: 'e', display: 'E' }, { char: 'r', display: 'R' },
  { char: 't', display: 'T' }, { char: 'y', display: 'Y' },
  { char: 'u', display: 'U' }, { char: 'i', display: 'I' },
  { char: 'o', display: 'O' }, { char: 'p', display: 'P' },
  { char: '[', display: '[' }, { char: ']', display: ']' },
  { char: '\\', display: '\\' },
];

const ROW_2: KeyDef[] = [
  { char: 'capslock', display: 'caps', flex: 1.75 },
  { char: 'a', display: 'A' }, { char: 's', display: 'S' },
  { char: 'd', display: 'D' }, { char: 'f', display: 'F' },
  { char: 'g', display: 'G' }, { char: 'h', display: 'H' },
  { char: 'j', display: 'J' }, { char: 'k', display: 'K' },
  { char: 'l', display: 'L' }, { char: ';', display: ';' },
  { char: "'", display: "'" },
  { char: 'enter', display: 'enter', flex: 2.25 },
];

const ROW_3: KeyDef[] = [
  { char: 'shift', display: 'shift', flex: 2.25 },
  { char: 'z', display: 'Z' }, { char: 'x', display: 'X' },
  { char: 'c', display: 'C' }, { char: 'v', display: 'V' },
  { char: 'b', display: 'B' }, { char: 'n', display: 'N' },
  { char: 'm', display: 'M' }, { char: ',', display: ',' },
  { char: '.', display: '.' }, { char: '/', display: '/' },
  { char: 'shift', display: 'shift', flex: 2.75 },
];

const ROW_4: KeyDef[] = [
  { char: 'control', display: 'ctrl', flex: 1.25 },
  { char: 'alt',     display: 'alt',  flex: 1.25 },
  { char: ' ',       display: '⎵',    flex: 6    },   // spacebar
  { char: 'alt',     display: 'alt',  flex: 1.25 },
  { char: 'control', display: 'ctrl', flex: 1.25 },
];

const ALL_ROWS: KeyDef[][] = [ROW_0, ROW_1, ROW_2, ROW_3, ROW_4];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface LiveKeyboardProps {
  /** 'lesson' = show allowed-key highlights; 'practice' = no highlights */
  mode:        'lesson' | 'practice';
  /** Full cumulative allowed key set for the current lesson (lowercase chars) */
  allowedKeys: string[];
}

// ── Finger Mapping ────────────────────────────────────────────────────────────
// Maps each key to the standard touch-typing finger color.
const FINGER_MAP: Record<string, string> = {
  // Pinky (Rose)
  '`': 'rose', '1': 'rose', 'q': 'rose', 'a': 'rose', 'z': 'rose',
  'tab': 'rose', 'capslock': 'rose', 'shift': 'rose', 'control': 'rose',
  '0': 'rose', '-': 'rose', '=': 'rose', 'p': 'rose', '[': 'rose', ']': 'rose', '\\': 'rose',
  ';': 'rose', "'": 'rose', 'enter': 'rose', '/': 'rose', 'backspace': 'rose',
  // Ring (Amber)
  '2': 'amber', 'w': 'amber', 's': 'amber', 'x': 'amber',
  '9': 'amber', 'o': 'amber', 'l': 'amber', '.': 'amber',
  // Middle (Emerald)
  '3': 'emerald', 'e': 'emerald', 'd': 'emerald', 'c': 'emerald',
  '8': 'emerald', 'i': 'emerald', 'k': 'emerald', ',': 'emerald',
  // Index (Sky)
  '4': 'sky', '5': 'sky', 'r': 'sky', 't': 'sky', 'f': 'sky', 'g': 'sky', 'v': 'sky', 'b': 'sky',
  '6': 'sky', '7': 'sky', 'y': 'sky', 'u': 'sky', 'h': 'sky', 'j': 'sky', 'n': 'sky', 'm': 'sky',
  // Thumbs (Violet)
  ' ': 'violet', 'alt': 'violet',
};

// ── Color Theme Classes ───────────────────────────────────────────────────────
// Explicit Tailwind classes for each finger color to ensure they are not purged.
const COLOR_CLASSES: Record<string, { bgAllowed: string, borderAllowed: string, textAllowed: string, bgPressed: string, borderPressed: string, shadowPressed: string, dot: string }> = {
  rose: {
    bgAllowed: 'bg-rose-500/20 dark:bg-rose-500/10', borderAllowed: 'border-rose-500/50', textAllowed: 'text-rose-600 dark:text-rose-400',
    bgPressed: 'bg-rose-500', borderPressed: 'border-rose-400', shadowPressed: 'shadow-[0_0_12px_rgba(244,63,94,0.6)]', dot: 'bg-rose-500',
  },
  amber: {
    bgAllowed: 'bg-amber-500/20 dark:bg-amber-500/10', borderAllowed: 'border-amber-500/50', textAllowed: 'text-amber-600 dark:text-amber-400',
    bgPressed: 'bg-amber-500', borderPressed: 'border-amber-400', shadowPressed: 'shadow-[0_0_12px_rgba(245,158,11,0.6)]', dot: 'bg-amber-500',
  },
  emerald: {
    bgAllowed: 'bg-emerald-500/20 dark:bg-emerald-500/10', borderAllowed: 'border-emerald-500/50', textAllowed: 'text-emerald-700 dark:text-emerald-400',
    bgPressed: 'bg-emerald-500', borderPressed: 'border-emerald-400', shadowPressed: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]', dot: 'bg-emerald-500',
  },
  sky: {
    bgAllowed: 'bg-sky-500/20 dark:bg-sky-500/10', borderAllowed: 'border-sky-500/50', textAllowed: 'text-sky-600 dark:text-sky-400',
    bgPressed: 'bg-sky-500', borderPressed: 'border-sky-400', shadowPressed: 'shadow-[0_0_12px_rgba(14,165,233,0.6)]', dot: 'bg-sky-500',
  },
  violet: {
    bgAllowed: 'bg-violet-500/20 dark:bg-violet-500/10', borderAllowed: 'border-violet-500/50', textAllowed: 'text-violet-600 dark:text-violet-400',
    bgPressed: 'bg-violet-500', borderPressed: 'border-violet-400', shadowPressed: 'shadow-[0_0_12px_rgba(139,92,246,0.6)]', dot: 'bg-violet-500',
  },
};

// ── Individual key cap ────────────────────────────────────────────────────────

interface KeyCapProps {
  keyDef:      KeyDef;
  isAllowed:   boolean;
  isPressed:   boolean;
}

const KeyCap = React.memo(function KeyCap({ keyDef, isAllowed, isPressed }: KeyCapProps) {
  // ── Visual state resolution (priority: pressed > allowed > default) ─────────
  const fingerColor = FINGER_MAP[keyDef.char] || 'violet';
  const colors = COLOR_CLASSES[fingerColor]!;

  let bgClass      = 'bg-surface-1';
  let borderClass  = 'border-surface-2';
  let textClass    = 'text-untyped';
  let shadowClass  = 'shadow-sm';
  let transformClass = '';

  if (isAllowed && !isPressed) {
    // TARGET/ALLOWED — finger color tint, brighter label, glowing border
    bgClass     = colors.bgAllowed;
    borderClass = colors.borderAllowed;
    textClass   = colors.textAllowed;
    shadowClass = '';
  }

  if (isPressed) {
    // PRESSED — full depress flash: translate down, bright bg, white text
    bgClass       = colors.bgPressed;
    borderClass   = colors.borderPressed;
    textClass     = 'text-white';
    shadowClass   = colors.shadowPressed;
    transformClass = 'translate-y-[2px]';
  }

  return (
    <div
      className={[
        // Layout
        'relative flex items-center justify-center',
        'h-9 min-w-[2rem] rounded-lg border select-none',
        // Transitions — fast press, smooth release
        'transition-all',
        isPressed ? 'duration-[30ms]' : 'duration-150',
        // State-driven classes
        bgClass, borderClass, textClass, shadowClass, transformClass,
        // Typography
        'text-[10px] font-mono font-medium tracking-wide',
        // Modifier keys get slightly smaller text
        keyDef.flex && keyDef.flex > 1 ? 'text-[8px]' : '',
      ].filter(Boolean).join(' ')}
      style={{ flex: keyDef.flex ?? 1 }}
      aria-label={keyDef.display}
    >
      {/* Key label */}
      <span style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {keyDef.display}
      </span>

      {/* Pressed: bottom-edge light strip (depth illusion) */}
      {isPressed && (
        <span
          className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-white/30"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Allowed (not pressed): tiny colored dot at bottom edge */}
      {isAllowed && !isPressed && (
        <span
          className={`absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${colors.dot} opacity-50`}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

const LiveKeyboard = React.memo(function LiveKeyboard({
  mode,
  allowedKeys,
}: LiveKeyboardProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Tab') return;
      setActiveKey(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      setActiveKey((prev) => (prev === e.key.toLowerCase() ? null : prev));
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, []);
  // Build a Set for O(1) lookup — memoized so it only rebuilds when allowedKeys changes
  const allowedSet = React.useMemo(
    () => new Set(allowedKeys.map((k) => k.toLowerCase())),
    [allowedKeys],
  );

  return (
    <div
      className="w-full max-w-2xl mx-auto select-none"
      aria-label="Ghost keyboard — visual key indicator"
      role="presentation"
    >
      {/* Keyboard rows */}
      <div className="flex flex-col gap-[3px]">
        {ALL_ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-[3px] w-full">
            {row.map((keyDef, keyIdx) => {
              const isAllowed =
                mode === 'lesson' && allowedSet.has(keyDef.char);
              const isPressed =
                activeKey !== null && keyDef.char === activeKey;
              return (
                <KeyCap
                  key={`${rowIdx}-${keyIdx}-${keyDef.char}`}
                  keyDef={keyDef}
                  isAllowed={isAllowed}
                  isPressed={isPressed}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend (lesson mode only) */}
      {mode === 'lesson' && allowedKeys.length > 0 && (
        <div className="flex items-center gap-4 mt-2 px-1 justify-end">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            </div>
            <span className="text-[9px] font-mono text-untyped">finger zones</span>
          </div>
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-untyped">
            <span className="w-2 h-2 rounded-sm bg-surface-4 border border-surface-3" />
            pressed
          </span>
        </div>
      )}
    </div>
  );
});

LiveKeyboard.displayName = 'LiveKeyboard';
export default LiveKeyboard;
