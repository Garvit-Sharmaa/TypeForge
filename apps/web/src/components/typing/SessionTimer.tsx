'use client';
/**
 * SessionTimer — displays time remaining or elapsed.
 *
 * Subscribes ONLY to `liveStats.timeRemaining` via a Zustand selector slice.
 * This means only this component re-renders on every 1-second tick —
 * not the broader typing arena tree.
 */

import React from 'react';
import { useTypingStore, selectTimeLeft, selectStatus } from '@/store/typingStore';

const SessionTimer = React.memo(function SessionTimer() {
  const timeRemaining = useTypingStore(selectTimeLeft);
  const status        = useTypingStore(selectStatus);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  const formattedTime = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}`;

  const isUrgent = timeRemaining <= 10 && status === 'running';

  return (
    <div
      id="session-timer"
      className={`stat-value tabular-nums transition-colors duration-300 ${
        isUrgent ? 'text-incorrect' : 'text-violet-light'
      }`}
      aria-live="polite"
      aria-label={`Time remaining: ${formattedTime}`}
    >
      {formattedTime}
    </div>
  );
});

SessionTimer.displayName = 'SessionTimer';
export default SessionTimer;
