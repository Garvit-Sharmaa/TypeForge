import type { KeystrokeEvent } from './Keystroke';

export type SessionStatus = 'idle' | 'countdown' | 'running' | 'finished';
export type SessionMode = 'time' | 'words' | 'quote' | 'zen';

export interface TypingSessionConfig {
  mode: SessionMode;
  /** Duration in seconds (time mode) */
  duration: number;
  /** Word count (words mode) */
  wordCount: number;
  language: string;
  lessonId?: string;
  /**
   * Full cumulative set of keys permitted in this lesson's generated text.
   * Set from LessonConfig.allowedKeys when in lesson mode; undefined in practice mode.
   * Consumed by LiveKeyboard to illuminate the "home zone" keys on the ghost keyboard.
   */
  allowedKeys?: string[];
}

/** Final computed results after a session ends */
export interface TypingResults {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correctWords: number;
  totalWords: number;
  correctChars: number;
  totalChars: number;
  /** Session wall-clock duration in ms */
  durationMs: number;
  keystrokeEvents: KeystrokeEvent[];
  /** Per-key error map: key char → { errors, total } */
  weakKeyMap: Record<string, { errors: number; total: number }>;
}

/** Shape stored in typing_sessions table */
export interface TypingSession {
  id: string;
  userId: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  durationMs: number;
  mode: SessionMode;
  language: string;
  lessonId?: string;
  completedAt: Date;
}

/** Live metrics, updated every 500 ms (not on every keystroke) */
export interface LiveTypingStats {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  timeRemaining: number;
  wordProgress: number;
}
