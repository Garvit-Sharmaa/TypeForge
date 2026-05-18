/** A single recorded keystroke event during a typing session */
export interface KeystrokeEvent {
  /** The key the user actually pressed */
  key: string;
  /** The key that was expected at this position */
  expectedKey: string;
  /** Whether the keystroke was correct */
  isCorrect: boolean;
  /** Time between this keystroke and the previous one (ms) */
  latencyMs: number;
  /** Absolute position in the full text (character index) */
  position: number;
  /** performance.now() timestamp relative to session start */
  timestamp: number;
}

/** Aggregated per-key analytics stored in weak_keys table */
export interface WeakKey {
  userId: string;
  keyChar: string;
  errorRate: number;      // 0-1
  avgLatencyMs: number;
  sampleCount: number;
  lastUpdated: Date;
}
