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

import React from 'react';

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
  /** The hardware key currently held down (e.key.toLowerCase()), or null */
  activeKey:   string | null;
}

// ── Individual key cap ────────────────────────────────────────────────────────

interface KeyCapProps {
  keyDef:      KeyDef;
  isAllowed:   boolean;
  isPressed:   boolean;
}

const KeyCap = React.memo(function KeyCap({ keyDef, isAllowed, isPressed }: KeyCapProps) {
  // ── Visual state resolution (priority: pressed > allowed > default) ─────────

  let bgClass      = 'bg-[#1a1a2e]';          // --surface-2
  let borderClass  = 'border-[#22223b]';       // --surface-3
  let textClass    = 'text-[#3d3d5c]';         // --untyped
  let shadowClass  = '';
  let transformClass = '';

  if (isAllowed && !isPressed) {
    // TARGET/ALLOWED — soft violet tint, brighter label, glowing border
    bgClass     = 'bg-[#1e1535]';
    borderClass = 'border-violet/40';
    textClass   = 'text-[#9090c0]';
    shadowClass = 'shadow-[0_0_6px_rgba(124,58,237,0.20)]';
  }

  if (isPressed) {
    // PRESSED — full depress flash: translate down, bright violet bg, white text
    bgClass       = 'bg-violet';
    borderClass   = 'border-violet-light';
    textClass     = 'text-white';
    shadowClass   = 'shadow-[0_0_16px_rgba(124,58,237,0.60)]';
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
          className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full
                     bg-violet-light/60"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Allowed (not pressed): tiny violet dot at bottom edge */}
      {isAllowed && !isPressed && (
        <span
          className="absolute bottom-[3px] left-1/2 -translate-x-1/2
                     w-1 h-1 rounded-full bg-violet/50"
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
  activeKey,
}: LiveKeyboardProps) {
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
        <div className="flex items-center gap-3 mt-2 px-1 justify-end">
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-[#3d3d5c]">
            <span className="w-2 h-2 rounded-sm border border-violet/40 bg-[#1e1535]" />
            allowed key
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-[#3d3d5c]">
            <span className="w-2 h-2 rounded-sm bg-violet" />
            pressed
          </span>
        </div>
      )}
    </div>
  );
});

LiveKeyboard.displayName = 'LiveKeyboard';
export default LiveKeyboard;
