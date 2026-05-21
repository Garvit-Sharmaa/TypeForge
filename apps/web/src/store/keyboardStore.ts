'use client';
/**
 * keyboardStore.ts — Zustand Visual State Machine for the Keyboard Engine.
 *
 * ARCHITECTURE CONTRACT:
 *   This store is the ONLY source of truth for what the keyboard LOOKS like.
 *   It knows nothing about the typing test logic — it only responds to
 *   commands from the bridge layer (useKeyboardBridge, built in Step 3).
 *
 * STATE PRIORITY (highest wins when multiple states are active):
 *   incorrect (3) > pressed (2) > target (1) > idle (0)
 *
 *   Example: a key that is simultaneously the target AND incorrectly pressed
 *   must render as `incorrect`, not `target`.
 *
 * PERFORMANCE CONTRACT:
 *   • `keyStates` is a flat Record<keyId, KeyVisualState> — O(1) reads.
 *   • `pressKey` / `releaseKey` update only the affected key's slice.
 *   • Components subscribe via fine-grained selectors, never the whole store.
 *   • Framer Motion animations are driven by `pressedAt` / `errorAt` timestamps
 *     (number | null), not by boolean flags, to avoid stale closure issues.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { KeyboardLayout, KeyLookupMap } from '@typing-master/shared';
import { buildKeyLookup } from '@typing-master/shared';

// ─── Visual State Types ───────────────────────────────────────────────────────

/**
 * Priority-ordered visual states for a single key.
 * Rendered in ascending priority: idle < target < pressed < incorrect.
 */
export type KeyVisualPriority = 'idle' | 'target' | 'pressed' | 'incorrect';

/**
 * Numeric priority map — used by `resolveKeyPriority` to decide winner
 * when multiple state signals are active simultaneously.
 */
export const KEY_VISUAL_PRIORITY: Readonly<Record<KeyVisualPriority, number>> = {
  idle:      0,
  target:    1,
  pressed:   2,
  incorrect: 3,
} as const;

/**
 * Per-key visual state stored in Zustand.
 *
 * Timestamps instead of booleans:
 *   Framer Motion variants driven by timestamps allow the animation
 *   system to detect when a NEW press happened even if the key wasn't
 *   released between keystrokes (held modifier, rapid identical chars).
 */
export interface KeyVisualState {
  /**
   * Resolved display priority after applying the conflict-resolution rule.
   * The <Key /> component reads only this field for its visual variant.
   */
  priority: KeyVisualPriority;

  /**
   * performance.now() timestamp of the most recent key-down event.
   * Null when key is not pressed.
   * Used by Framer Motion as an animation trigger key (`key={pressedAt}`).
   */
  pressedAt: number | null;

  /**
   * performance.now() timestamp of the most recent incorrect press.
   * Null when no error. Drives shake / flash animation.
   * Preserved briefly after release so the error animation can complete.
   */
  errorAt: number | null;
}

// ─── Heatmap overlay types ────────────────────────────────────────────────────

/**
 * Per-key analytics data for the heatmap overlay.
 * Loaded from `/api/analytics/weak-keys` after session completion.
 */
export interface HeatmapKeyData {
  /** Fraction of presses that were incorrect (0–1) */
  errorRate: number;
  /** Exponentially-weighted moving average inter-key latency (ms) */
  avgLatencyMs: number;
  /** Total keystrokes sampled — used for confidence weighting */
  sampleCount: number;
}

// ─── Store Interface ──────────────────────────────────────────────────────────

export interface KeyboardVisualState {

  // ── Layout (load-time config, never changes during a session) ─────────────

  /** Currently active keyboard layout (null before layout is loaded) */
  layout: KeyboardLayout | null;

  /**
   * O(1) lookup map built from `layout`.
   * Keys: KeyDefinition.id AND KeyDefinition.code (both resolve to the same def).
   * Rebuilt only when `layout` changes (not on every keystroke).
   */
  keyLookup: KeyLookupMap | null;

  // ── Live per-key visual state (the hot path) ──────────────────────────────

  /**
   * Flat map: KeyDefinition.id → KeyVisualState.
   * Updated on every key-press/release from the bridge.
   * Fine-grained Zustand selectors ensure only affected <Key /> re-renders.
   */
  keyStates: Record<string, KeyVisualState>;

  /**
   * ID of the key the user must press next.
   * Derived from the typing engine's current character position.
   * Setting this clears the previous target and applies 'target' priority.
   */
  targetKeyId: string | null;

  // ── Heatmap overlay ───────────────────────────────────────────────────────

  /** Toggle heatmap color overlay on/off */
  heatmapEnabled: boolean;

  /**
   * Which dimension drives the heatmap colour scale.
   *   'accuracy' → errorRate (red = high error)
   *   'speed'    → avgLatencyMs (red = slow)
   */
  heatmapMode: 'accuracy' | 'speed';

  /**
   * Per-key analytics data.
   * Map: KeyDefinition.id → HeatmapKeyData.
   * Loaded once per session completion from the analytics API.
   */
  heatmapData: Record<string, HeatmapKeyData>;

  // ── Display preferences ───────────────────────────────────────────────────

  /** Show finger-color coding on key backgrounds */
  showFingerColors: boolean;

  /** Show key labels (display / displayShift) inside SVG key bodies */
  showKeyLabels: boolean;

  // ── Hover (heatmap tooltip) ───────────────────────────────────────────────

  /**
   * ID of the key currently under the cursor (heatmap mode only).
   * Null when nothing is hovered. Used by Keyboard.tsx to render the
   * HTML tooltip overlay that lives outside the SVG stacking context.
   */
  hoveredKeyId: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Load a keyboard layout and rebuild the lookup map.
   * Resets all key visual states.
   * Call once at app init or when user switches layout.
   */
  setLayout: (layout: KeyboardLayout) => void;

  /**
   * Set the next target key (the character the user must type).
   * Removes 'target' priority from the previous target key.
   * Applies 'target' priority to the new one (unless it's pressed/incorrect).
   */
  setTargetKey: (keyId: string | null) => void;

  /**
   * Register a key-down event from the typing bridge.
   *
   * Priority resolution (strict):
   *   isCorrect=false  → priority = 'incorrect'  (highest)
   *   isCorrect=true   → priority = 'pressed'
   *
   * Sets `pressedAt = performance.now()`.
   * Sets `errorAt   = performance.now()` when isCorrect=false.
   */
  pressKey: (keyId: string, isCorrect: boolean) => void;

  /**
   * Register a key-up event (or synthetic release after a timeout).
   * Reverts the key to 'target' if it is still the targetKeyId,
   * otherwise reverts to 'idle'.
   *
   * Does NOT clear `errorAt` immediately — the bridge should call
   * `clearKeyError(keyId)` after the error animation completes (~300ms).
   */
  releaseKey: (keyId: string) => void;

  /**
   * Clear the error animation state for a key after the animation completes.
   * Prevents stale error styling when the user corrects a mistake.
   */
  clearKeyError: (keyId: string) => void;

  /**
   * Reset all keyStates to idle and clear targetKeyId.
   * Called on session restart — does NOT affect layout or preferences.
   */
  resetKeyStates: () => void;

  /**
   * Batch-load heatmap data from the analytics API response.
   * Input: array of { keyChar, errorRate, avgLatencyMs, sampleCount }
   * The store normalizes to a Map keyed by KeyDefinition.id via keyLookup.
   */
  setHeatmapData: (
    data: Array<{ keyChar: string; errorRate: number; avgLatencyMs: number; sampleCount: number }>,
  ) => void;

  /** Toggle the heatmap overlay on/off */
  toggleHeatmap: () => void;

  /**
   * Atomically enable the heatmap AND set the dimension.
   * Convenience for dashboard — avoids two separate dispatches.
   */
  enableHeatmap: (mode: 'accuracy' | 'speed') => void;

  /** Switch heatmap dimension without toggling enabled state */
  setHeatmapMode: (mode: 'accuracy' | 'speed') => void;

  /** Toggle finger color coding */
  toggleFingerColors: () => void;

  /**
   * Set/clear the hovered key (heatmap mode only).
   * Called from Key.tsx onMouseEnter/onMouseLeave.
   */
  setHoveredKey: (keyId: string | null) => void;
}

// ─── Initial per-key state factory ───────────────────────────────────────────

const IDLE_KEY_STATE: KeyVisualState = {
  priority:  'idle',
  pressedAt: null,
  errorAt:   null,
};

// ─── Priority resolver (pure function) ───────────────────────────────────────

/**
 * Resolve the correct KeyVisualPriority given the store's current state for a key.
 * Strictly enforces: incorrect (3) > pressed (2) > target (1) > idle (0).
 */
function resolveKeyPriority(
  keyId:       string,
  isPressed:   boolean,
  isCorrect:   boolean,
  targetKeyId: string | null,
): KeyVisualPriority {
  if (isPressed && !isCorrect) return 'incorrect';
  if (isPressed)               return 'pressed';
  if (keyId === targetKeyId)   return 'target';
  return 'idle';
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useKeyboardStore = create<KeyboardVisualState>()(
  subscribeWithSelector((set, get) => ({

    // ── Initial state ────────────────────────────────────────────────────────
    layout:          null,
    keyLookup:       null,
    keyStates:       {},
    targetKeyId:     null,
    heatmapEnabled:  false,
    heatmapMode:     'accuracy',
    heatmapData:     {},
    showFingerColors:true,
    showKeyLabels:   true,
    hoveredKeyId:    null,

    // ── setLayout ────────────────────────────────────────────────────────────
    setLayout: (layout) => {
      const keyLookup = buildKeyLookup(layout);
      // Pre-populate keyStates with idle entries for all keys
      const keyStates: Record<string, KeyVisualState> = {};
      for (const key of layout.keys) {
        keyStates[key.id] = { ...IDLE_KEY_STATE };
      }
      set({ layout, keyLookup, keyStates, targetKeyId: null });
    },

    // ── setTargetKey ─────────────────────────────────────────────────────────
    setTargetKey: (newTargetKeyId) => {
      const { targetKeyId: prevTargetKeyId, keyStates } = get();

      set((s) => {
        const updated = { ...s.keyStates };

        // Revert previous target to idle (only if it's not pressed/incorrect)
        if (prevTargetKeyId && prevTargetKeyId !== newTargetKeyId) {
          const prev = updated[prevTargetKeyId];
          if (prev?.priority === 'target') {
            updated[prevTargetKeyId] = { ...prev, priority: 'idle' };
          }
        }

        // Apply target to new key (only if it's currently idle)
        if (newTargetKeyId) {
          const curr = updated[newTargetKeyId];
          if (!curr || curr.priority === 'idle') {
            updated[newTargetKeyId] = {
              ...(curr ?? IDLE_KEY_STATE),
              priority: 'target',
            };
          }
        }

        return { keyStates: updated, targetKeyId: newTargetKeyId };
      });
    },

    // ── pressKey ─────────────────────────────────────────────────────────────
    pressKey: (keyId, isCorrect) => {
      const now = performance.now();
      set((s) => {
        const priority = resolveKeyPriority(keyId, true, isCorrect, s.targetKeyId);
        return {
          keyStates: {
            ...s.keyStates,
            [keyId]: {
              priority,
              pressedAt: now,
              errorAt:   isCorrect ? (s.keyStates[keyId]?.errorAt ?? null) : now,
            },
          },
        };
      });
    },

    // ── releaseKey ────────────────────────────────────────────────────────────
    releaseKey: (keyId) => {
      set((s) => {
        const isTarget   = s.targetKeyId === keyId;
        const prevState  = s.keyStates[keyId];
        const priority   = isTarget ? 'target' : 'idle';
        return {
          keyStates: {
            ...s.keyStates,
            [keyId]: {
              priority,
              pressedAt: null,
              // Preserve errorAt so the animation can finish (bridge clears it)
              errorAt: prevState?.errorAt ?? null,
            },
          },
        };
      });
    },

    // ── clearKeyError ────────────────────────────────────────────────────────
    clearKeyError: (keyId) => {
      set((s) => {
        const prev = s.keyStates[keyId];
        if (!prev?.errorAt) return s; // nothing to clear
        return {
          keyStates: {
            ...s.keyStates,
            [keyId]: { ...prev, errorAt: null },
          },
        };
      });
    },

    // ── resetKeyStates ────────────────────────────────────────────────────────
    resetKeyStates: () => {
      const { layout } = get();
      if (!layout) return;
      const keyStates: Record<string, KeyVisualState> = {};
      for (const key of layout.keys) {
        keyStates[key.id] = { ...IDLE_KEY_STATE };
      }
      set({ keyStates, targetKeyId: null });
    },

    // ── setHeatmapData ────────────────────────────────────────────────────────
    setHeatmapData: (data) => {
      const { keyLookup } = get();
      if (!keyLookup) return;

      const heatmapData: Record<string, HeatmapKeyData> = {};
      for (const entry of data) {
        // keyChar from API is a raw character e.g. "a" — look up by code fallback
        const keyDef =
          keyLookup[`key-Key${entry.keyChar.toUpperCase()}`] ??  // "key-KeyA"
          keyLookup[`key-${entry.keyChar}`];                      // direct id match

        if (keyDef) {
          heatmapData[keyDef.id] = {
            errorRate:    entry.errorRate,
            avgLatencyMs: entry.avgLatencyMs,
            sampleCount:  entry.sampleCount,
          };
        }
      }
      set({ heatmapData });
    },

    // ── toggles / mode setters ────────────────────────────────────────────────
    toggleHeatmap:      () => set((s) => ({ heatmapEnabled:   !s.heatmapEnabled })),
    enableHeatmap:      (mode) => set({ heatmapEnabled: true,  heatmapMode: mode }),
    setHeatmapMode:     (mode) => set({ heatmapMode: mode }),
    toggleFingerColors: () => set((s) => ({ showFingerColors: !s.showFingerColors })),
    setHoveredKey:      (keyId) => set({ hoveredKeyId: keyId }),

  })),
);

// ─── Fine-grained selectors (for minimal re-renders) ─────────────────────────

/** Get a single key's visual state — stable reference if unchanged */
export const selectKeyState = (keyId: string) =>
  (s: KeyboardVisualState): KeyVisualState =>
    s.keyStates[keyId] ?? IDLE_KEY_STATE;

export const selectLayout           = (s: KeyboardVisualState) => s.layout;
export const selectKeyLookup        = (s: KeyboardVisualState) => s.keyLookup;
export const selectTargetKeyId      = (s: KeyboardVisualState) => s.targetKeyId;
export const selectHeatmapEnabled   = (s: KeyboardVisualState) => s.heatmapEnabled;
export const selectHeatmapMode      = (s: KeyboardVisualState) => s.heatmapMode;
export const selectHeatmapData      = (s: KeyboardVisualState) => s.heatmapData;
export const selectShowFingerColors = (s: KeyboardVisualState) => s.showFingerColors;
export const selectShowKeyLabels    = (s: KeyboardVisualState) => s.showKeyLabels;
export const selectHoveredKeyId     = (s: KeyboardVisualState) => s.hoveredKeyId;
