'use client';
/**
 * ResultsPanel — shown when status === 'finished'.
 *
 * This is the ONLY component that triggers a full typing-area re-render,
 * and it only does so once (on session completion). All results are
 * read from `typingStore.results` which is set a single time.
 */

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTypingStore, selectResults } from '@/store/typingStore';

interface ResultsPanelProps {
  onRestart: () => void;
}

const StatBlock = ({ label, value, unit }: {
  label: string; value: string | number; unit?: string;
}) => (
  <div className="flex flex-col items-center gap-1">
    <span className="stat-value">{value}</span>
    {unit && <span className="text-xs text-violet-light font-mono">{unit}</span>}
    <span className="stat-label">{label}</span>
  </div>
);

const ResultsPanel = React.memo(function ResultsPanel({ onRestart }: ResultsPanelProps) {
  const results = useTypingStore(selectResults);
  const router  = useRouter();
  const searchParams = useSearchParams();
  if (!results) return null;

  const { wpm, rawWpm, accuracy, correctWords, totalWords, durationMs } = results;
  const seconds = Math.round(durationMs / 1000);

  // Read routing/passing requirements from URL
  const nextRoute = searchParams.get('nextRoute');
  const reqWpm = parseInt(searchParams.get('reqWpm') || '0', 10);
  const reqAcc = parseInt(searchParams.get('reqAcc') || '0', 10);

  const passed = results.wpm >= reqWpm && results.accuracy >= reqAcc;

  const topErrors = Object.entries(results.weakKeyMap)
    .sort(([, a], [, b]) => b.errors / b.total - a.errors / a.total)
    .slice(0, 6);

  return (
    <div
      id="results-panel"
      className="results-enter absolute inset-0 flex flex-col items-center justify-center
                 gap-8 bg-surface/95 backdrop-blur-sm rounded-2xl z-20 p-8"
      role="dialog"
      aria-label="Session results"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-semibold text-correct">Session Complete</h2>
        <p className="text-muted text-sm">{seconds}s · {correctWords}/{totalWords} words correct</p>
      </div>

      {/* Primary stats row */}
      <div className="flex items-center justify-center gap-12">
        <StatBlock label="WPM"     value={wpm}    />
        <div className="w-px h-12 bg-surface-3" />
        <StatBlock label="RAW"     value={rawWpm}  />
        <div className="w-px h-12 bg-surface-3" />
        <StatBlock label="ACC"     value={`${accuracy}%`} />
      </div>

      {/* Weak keys */}
      {topErrors.length > 0 && (
        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
          <p className="stat-label">Weak Keys Detected</p>
          <div className="flex flex-wrap justify-center gap-2">
            {topErrors.map(([key, stat]) => (
              <div
                key={key}
                className="flex flex-col items-center bg-surface-2 border border-surface-3
                           rounded-lg px-3 py-2 min-w-[48px]"
              >
                <span className="font-mono text-lg text-incorrect font-bold">
                  {key === ' ' ? '⎵' : key}
                </span>
                <span className="text-[10px] text-muted">
                  {Math.round((stat.errors / stat.total) * 100)}% err
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          id="restart-btn"
          onClick={onRestart}
          className="flex items-center gap-2 bg-violet hover:bg-violet/80
                     text-white font-medium px-6 py-3 rounded-xl
                     transition-all duration-150 active:scale-95 focus-visible:ring-2
                     focus-visible:ring-violet-light focus-visible:ring-offset-2
                     focus-visible:ring-offset-surface"
          autoFocus
        >
          <span>Restart</span>
          <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono">Tab</kbd>
        </button>

        {nextRoute && passed ? (
          <button
            id="next-chapter-btn"
            onClick={() => router.push(nextRoute)}
            className="flex items-center gap-2 bg-correct hover:bg-correct/80
                       text-slate-900 font-medium px-6 py-3 rounded-xl
                       transition-all duration-150 active:scale-95 shadow-md"
          >
            Next Chapter →
          </button>
        ) : (
          <button
            id="view-dashboard-btn"
            onClick={() => router.push('/learn')}
            className="text-muted hover:text-correct transition-colors text-sm underline
                       underline-offset-2"
          >
            View dashboard →
          </button>
        )}
      </div>
    </div>
  );
});

ResultsPanel.displayName = 'ResultsPanel';
export default ResultsPanel;
