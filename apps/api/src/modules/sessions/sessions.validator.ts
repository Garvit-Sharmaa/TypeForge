import { z } from 'zod';
import { SessionSubmitSchema } from '@typing-master/shared';

/**
 * sessions.validator.ts
 *
 * Extends the shared Zod schema with additional server-side rules
 * that aren't enforced on the client (e.g., field presence checks,
 * stricter bounds on keystroke event count relative to duration).
 */

// Re-export shared schema directly as the primary validator
export const SubmitSessionSchema = SessionSubmitSchema.superRefine((data, ctx) => {
  const { results, keystrokeEvents } = data;

  // Server-side: keystroke count must be proportional to session length
  const elapsedMin      = results.durationMs / 60_000;
  const maxExpectedKeys = Math.ceil(results.rawWpm * 5 * elapsedMin * 1.4); // +40% buffer
  if (keystrokeEvents.length > maxExpectedKeys && keystrokeEvents.length > 50) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Too many keystroke events (${keystrokeEvents.length}) for reported duration/WPM`,
      path: ['keystrokeEvents'],
    });
  }

  // correctChars cannot exceed totalChars
  if (results.correctChars > results.totalChars) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'correctChars cannot exceed totalChars',
      path: ['results', 'correctChars'],
    });
  }

  // correctWords cannot exceed totalWords
  if (results.correctWords > results.totalWords) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'correctWords cannot exceed totalWords',
      path: ['results', 'correctWords'],
    });
  }
});

export type SubmitSessionPayload = z.infer<typeof SubmitSessionSchema>;
