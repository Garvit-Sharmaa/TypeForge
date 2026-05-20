'use client';
/**
 * useSessionSubmit.ts
 *
 * Watches typingStore status. When it transitions to 'finished',
 * automatically submits the session to the API.
 *
 * Decoupled from the engine — the engine never touches the API.
 * Decoupled from the UI — the UI just reads the results from the store.
 */

import { useEffect, useRef } from 'react';
import { useTypingStore, selectStatus, selectResults, selectConfig, selectWords } from '@/store/typingStore';
import { useUserStore, selectTokens } from '@/store/userStore';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { sessionsApi, ApiError } from '@/lib/api';
import type { SessionSubmitPayload } from '@typing-master/shared';

export interface SubmitState {
  status: 'idle' | 'submitting' | 'success' | 'error' | 'flagged';
  xpGained: number;
  sessionId?: string;
  error?: string;
}

// Module-level ref to avoid re-submitting same session
const lastSubmittedResultsRef = { current: null as object | null };

export function useSessionSubmit(): SubmitState {
  const status    = useTypingStore(selectStatus);
  const results   = useTypingStore(selectResults);
  const config    = useTypingStore(selectConfig);
  const words     = useTypingStore(selectWords);
  const tokens    = useUserStore(selectTokens);
  const invalidate= useAnalyticsStore((s) => s.invalidate);

  const submitStateRef = useRef<SubmitState>({ status: 'idle', xpGained: 0 });

  useEffect(() => {
    // Only fire when session just finished
    if (status !== 'finished' || !results) return;
    // Prevent double-submission for the same results object
    if (lastSubmittedResultsRef.current === results) return;
    // Skip if not authenticated — guest mode
    if (!tokens?.accessToken) return;

    lastSubmittedResultsRef.current = results;
    submitStateRef.current = { status: 'submitting', xpGained: 0 };

    // Sanitize lessonId: Zod's min(1) rejects empty strings.
    // For free-practice sessions the key must be completely absent from the payload.
    const lessonId = config.lessonId || undefined; // coerce '' | null → undefined

    const payload: SessionSubmitPayload = {
      config: {
        mode:      config.mode,
        duration:  Math.round(config.duration),
        wordCount: Math.round(config.wordCount),
        language:  config.language,
        ...(lessonId ? { lessonId } : {}),   // omit key entirely when falsy
      },
      results: {
        wpm:          Math.round(results.wpm),
        rawWpm:       Math.round(results.rawWpm),
        accuracy:     Math.round(results.accuracy),
        correctWords: results.correctWords,      // already integer (char counter)
        totalWords:   results.totalWords,        // already integer (char counter)
        correctChars: results.correctChars,      // already integer (char counter)
        totalChars:   results.totalChars,        // already integer (char counter)
        durationMs:   Math.round(results.durationMs), // root cause: high-precision float
      },
      keystrokeEvents: results.keystrokeEvents,
    };


    sessionsApi.submit(payload, tokens.accessToken)
      .then(({ xpGained, isFlagged, sessionId }) => {
        submitStateRef.current = {
          status:    isFlagged ? 'flagged' : 'success',
          xpGained,
          sessionId,
        };
        // Invalidate analytics cache so dashboard refetches
        invalidate();
      })
      .catch((err: ApiError | Error) => {
        submitStateRef.current = {
          status: 'error',
          xpGained: 0,
          error: err.message,
        };
        console.error('Session submission failed:', err.message);
      });
  }, [status, results, tokens, config, invalidate]);

  return submitStateRef.current;
}
