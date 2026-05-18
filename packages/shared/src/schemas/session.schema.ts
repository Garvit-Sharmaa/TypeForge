import { z } from 'zod';
import { ANTI_CHEAT } from '../constants/limits';

/** Payload the frontend sends on session completion */
export const SessionSubmitSchema = z.object({
  config: z.object({
    mode: z.enum(['time', 'words', 'quote', 'zen']),
    duration: z.number().int().positive(),
    wordCount: z.number().int().positive(),
    language: z.string().min(2).max(20),
    lessonId: z.string().uuid().optional(),
  }),
  results: z.object({
    wpm: z.number().min(0).max(ANTI_CHEAT.MAX_BELIEVABLE_WPM),
    rawWpm: z.number().min(0).max(ANTI_CHEAT.MAX_BELIEVABLE_WPM),
    accuracy: z.number().min(0).max(100),
    correctWords: z.number().int().min(0),
    totalWords: z.number().int().positive(),
    correctChars: z.number().int().min(0),
    totalChars: z.number().int().positive(),
    durationMs: z.number().positive().max(ANTI_CHEAT.MAX_SESSION_DURATION_MS),
  }),
  keystrokeEvents: z.array(
    z.object({
      key: z.string().max(20),
      expectedKey: z.string().max(20),
      isCorrect: z.boolean(),
      latencyMs: z.number().min(0).max(ANTI_CHEAT.MAX_KEYSTROKE_LATENCY_MS),
      position: z.number().int().min(0),
      timestamp: z.number().min(0),
    })
  ).max(ANTI_CHEAT.MAX_KEYSTROKES_PER_SESSION),
});

export type SessionSubmitPayload = z.infer<typeof SessionSubmitSchema>;
