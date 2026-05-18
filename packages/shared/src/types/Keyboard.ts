/**
 * Keyboard.ts — Canonical type definitions for the Dynamic Keyboard
 * Visualization Engine (Phase 2).
 *
 * DESIGN PRINCIPLES:
 *   • Layout-independent: the entire keyboard topology is derived from
 *     a `KeyboardLayout` JSON document — no hardcoded rows or key counts.
 *   • SVG-native: all geometry is expressed in SVG user-units (x, y, width,
 *     height) within a known viewBox. No CSS pixel math.
 *   • Finger-aware: every key carries a `finger` assignment for color-coding
 *     and pedagogical hint rendering.
 *   • Bridge-ready: `KeyDefinition.code` matches `KeyboardEvent.code`
 *     (e.g. "KeyA", "Space", "Backspace") so the visual layer can be driven
 *     directly from the existing useTypingEngine keystroke events.
 */

// ─── Primitive enumerations ───────────────────────────────────────────────────

/**
 * The ten possible finger assignments.
 * Using string literals (not numeric enum) for JSON-schema friendliness
 * and readable layout files.
 */
export type FingerName =
  | 'left-pinky'
  | 'left-ring'
  | 'left-middle'
  | 'left-index'
  | 'left-thumb'
  | 'right-thumb'
  | 'right-index'
  | 'right-middle'
  | 'right-ring'
  | 'right-pinky';

/** Keyboard hand side */
export type Hand = 'left' | 'right';

/**
 * Logical row identifier.
 * Used for component hierarchy (Keyboard → Row → Key) and row-level
 * stagger offsets in the layout JSON.
 */
export type KeyRowId =
  | 'function'   // F1–F12
  | 'number'     // ` 1 2 3 … = backspace
  | 'top'        // tab q w e … ]  \
  | 'home'       // caps a s d … ; '  enter
  | 'bottom'     // shift z x c … /  shift
  | 'thumb';     // ctrl alt space alt ctrl …

/**
 * Physical keyboard form-factor variant.
 * Determines which layout JSON is loaded.
 */
export type LayoutVariant = 'ansi' | 'iso' | 'jis' | 'ortholinear' | 'split';

// ─── KeyDefinition ────────────────────────────────────────────────────────────

/**
 * The atomic unit of the keyboard layout schema.
 * Each instance describes a single physical key's geometry and metadata.
 *
 * Geometry contract:
 *   All numeric fields are SVG user-units within the layout's declared viewBox.
 *   The renderer MUST NOT apply any additional scaling — it should mount the
 *   layout directly into an <svg viewBox="0 0 {viewBoxWidth} {viewBoxHeight}">.
 */
export interface KeyDefinition {
  /**
   * Stable, unique string identifier.
   * Convention: "key-{code}" e.g. "key-KeyA", "key-Space", "key-Backspace".
   * Used as:
   *   • React `key` prop on <Key /> components
   *   • Zustand keyStates map key
   *   • Bridge lookup key when translating KeyboardEvent.code
   */
  id: string;

  /**
   * Primary visible label rendered inside the SVG key body.
   * Examples: "A", "1", "⌫", "⇥", "⎵", "⇧"
   */
  display: string;

  /**
   * Secondary label (top-left corner) for keys with two legends.
   * Examples: "!" for the "1" key, "@" for "2", etc.
   * Absent for single-legend keys.
   */
  displayShift?: string;

  /**
   * KeyboardEvent.code value for this physical key.
   * Examples: "KeyA", "Space", "ShiftLeft", "Backspace".
   * This is the bridge field: useTypingEngine emits KeyboardEvent.code →
   * keyboardStore looks up the KeyDefinition → applies visual state.
   */
  code: string;

  /** Which finger should strike this key (pedagogical guide) */
  finger: FingerName;

  /** Which hand this key belongs to */
  hand: Hand;

  /** Logical row grouping — determines which <Row /> this <Key /> renders in */
  row: KeyRowId;

  // ── SVG Geometry ────────────────────────────────────────────────────────────

  /** SVG x-coordinate of the key rect's top-left corner */
  x: number;

  /** SVG y-coordinate of the key rect's top-left corner */
  y: number;

  /** SVG width of the key rect */
  width: number;

  /** SVG height of the key rect */
  height: number;

  /**
   * SVG rect corner radius (rx/ry). Defaults to layout-level `defaultKeyRx`
   * if absent. Override here for keys with unusual shapes (e.g. ISO Enter).
   */
  rx?: number;

  /**
   * True for modifier/special keys (Shift, Ctrl, Alt, Caps, Tab, Enter, etc.).
   * The renderer may apply distinct styling (slightly different fill opacity).
   */
  isModifier?: boolean;

  /**
   * True for dead keys that produce no character by themselves.
   * Used to suppress target highlighting.
   */
  isDeadKey?: boolean;
}

// ─── RowDefinition ────────────────────────────────────────────────────────────

/**
 * Metadata for a logical row, used by the <Row /> component to group keys.
 * The actual geometry (y, stagger offset) lives on each `KeyDefinition`.
 */
export interface RowDefinition {
  /** Logical row identifier — matches `KeyDefinition.row` */
  id: KeyRowId;

  /** Human-readable label (for accessibility / ARIA purposes) */
  label: string;

  /**
   * Ordered list of `KeyDefinition.id` values belonging to this row.
   * The <Row /> component renders keys in this exact order (left → right).
   */
  keyIds: string[];
}

// ─── KeyboardLayout ───────────────────────────────────────────────────────────

/**
 * Top-level keyboard layout document.
 *
 * This is the single source of truth for a keyboard's visual topology.
 * It is loaded once at app init (or when the user switches layouts) and
 * never mutated. All visual state is separate (KeyboardVisualStore).
 *
 * JSON schema example:
 * {
 *   "id": "qwerty-ansi-104",
 *   "name": "QWERTY ANSI 104",
 *   "variant": "ansi",
 *   "viewBoxWidth": 780,
 *   "viewBoxHeight": 240,
 *   "defaultKeyWidth": 44,
 *   "defaultKeyHeight": 44,
 *   "defaultKeyRx": 6,
 *   "rows": [...],
 *   "keys": [...]
 * }
 */
export interface KeyboardLayout {
  /**
   * Unique, stable layout identifier.
   * Convention: "{language}-{variant}-{keyCount}" e.g. "qwerty-ansi-104".
   */
  id: string;

  /** Human-readable name shown in the layout picker UI */
  name: string;

  /** Physical form-factor */
  variant: LayoutVariant;

  // ── SVG Viewport ────────────────────────────────────────────────────────────

  /**
   * Width of the SVG viewBox.
   * The <svg> element renders at this logical resolution; CSS scales it to fit.
   */
  viewBoxWidth: number;

  /** Height of the SVG viewBox */
  viewBoxHeight: number;

  // ── Key geometry defaults ───────────────────────────────────────────────────
  // These are applied as fallbacks when individual KeyDefinitions omit them.

  /** Default key width in SVG user-units */
  defaultKeyWidth: number;

  /** Default key height in SVG user-units */
  defaultKeyHeight: number;

  /** Default key corner radius (rx) */
  defaultKeyRx: number;

  /** Gap between adjacent keys in SVG user-units */
  keyGap: number;

  // ── Content ─────────────────────────────────────────────────────────────────

  /** Ordered row metadata (top → bottom). Controls <Row /> render order. */
  rows: RowDefinition[];

  /**
   * Flat array of all key definitions.
   * Indexed by the renderer via `id` for O(1) lookup.
   * Grouped into rows via `RowDefinition.keyIds`.
   */
  keys: KeyDefinition[];
}

// ─── Utility helpers (pure, no runtime cost) ─────────────────────────────────

/**
 * Build a O(1) lookup map from a KeyboardLayout.
 * Call once after loading a layout — not on every render.
 */
export type KeyLookupMap = Readonly<Record<string, KeyDefinition>>;

export function buildKeyLookup(layout: KeyboardLayout): KeyLookupMap {
  const map: Record<string, KeyDefinition> = {};
  for (const key of layout.keys) {
    map[key.id]   = key;  // lookup by id
    map[key.code] = key;  // lookup by KeyboardEvent.code (bridge path)
  }
  return Object.freeze(map) as KeyLookupMap;
}

/**
 * Maps a FingerName to its canonical color token.
 * Colors match the standard typing-tutor finger color convention
 * and will be referenced in SVG fill attributes.
 */
export const FINGER_COLORS: Readonly<Record<FingerName, string>> = {
  'left-pinky':   '#e57373', // red
  'left-ring':    '#ff9800', // orange
  'left-middle':  '#ffeb3b', // yellow
  'left-index':   '#66bb6a', // green
  'left-thumb':   '#29b6f6', // blue (space bar)
  'right-thumb':  '#29b6f6', // blue (space bar)
  'right-index':  '#66bb6a', // green
  'right-middle': '#ffeb3b', // yellow
  'right-ring':   '#ff9800', // orange
  'right-pinky':  '#e57373', // red
} as const;
