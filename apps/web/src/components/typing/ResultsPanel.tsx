'use client';
/**
 * ResultsPanel — shown when status === 'finished'.
 *
 * MODES:
 *   Practice mode (no isAcademy param): Restart + View Stats
 *   Academy mode  (isAcademy=1 in URL):  4 distinct buttons:
 *     1. Restart       — re-run the exact same chapter drill
 *     2. Next Chapter  — auto-launch next chapter (hidden if final)
 *     3. Back to Academy — /learn
 *     4. Stats         — /dashboard
 *
 * URL params consumed:
 *   isAcademy   — '1' when launched from Academy
 *   nextRoute   — URL to route to on Next Chapter click (e.g. /learn?autoLaunch=1.2)
 *   reqWpm      — minimum WPM to pass a test chapter (0 = no gate)
 *   reqAcc      — minimum accuracy to pass a test chapter (0 = no gate)
 */

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence }    from 'framer-motion';
import { RotateCcw, ChevronRight, GraduationCap, BarChart2, CheckCircle2, XCircle } from 'lucide-react';
import { useTypingStore, selectResults } from '@/store/typingStore';

// ── Stat block ────────────────────────────────────────────────────────────────

const StatBlock = ({ label, value, sub }: {
  label: string; value: string | number; sub?: string;
}) => (
  <div className="flex flex-col items-center gap-0.5">
    <span className="stat-value">{value}</span>
    {sub && <span className="text-[10px] text-violet-light font-mono">{sub}</span>}
    <span className="stat-label">{label}</span>
  </div>
);

// ── XP earned badge ───────────────────────────────────────────────────────────

function XpBadge({ wpm, accuracy }: { wpm: number; accuracy: number }) {
  const xp = Math.round(wpm * 0.8 + accuracy * 0.5);
  if (xp <= 0) return null;
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1,   opacity: 1 }}
      transition={{ delay: 0.4, type: 'spring', stiffness: 220, damping: 18 }}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full
                 bg-violet/15 border border-violet/30
                 text-violet-light text-xs font-mono font-semibold"
    >
      +{xp} XP
    </motion.div>
  );
}

// ── Pass / Fail banner ────────────────────────────────────────────────────────

function PassFailBanner({ passed, reqWpm, reqAcc }: {
  passed: boolean; reqWpm: number; reqAcc: number;
}) {
  if (reqWpm === 0 && reqAcc === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1,  y: 0  }}
      className={[
        'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-mono font-semibold',
        passed
          ? 'bg-correct/10 border-correct/30 text-correct'
          : 'bg-incorrect/10 border-incorrect/30 text-incorrect',
      ].join(' ')}
    >
      {passed
        ? <><CheckCircle2 size={15} strokeWidth={2} /> Chapter Passed!</>
        : <><XCircle     size={15} strokeWidth={2} /> Need {reqWpm}+ WPM &amp; {reqAcc}%+ accuracy</>}
    </motion.div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

const ResultsPanel = React.memo(function ResultsPanel({
  onRestart,
}: {
  onRestart: () => void;
}) {
  const results      = useTypingStore(selectResults);
  const router       = useRouter();
  const searchParams = useSearchParams();

  if (!results) return null;

  const { wpm, rawWpm, accuracy, correctWords, totalWords, durationMs } = results;
  const seconds = Math.round(durationMs / 1000);

  // ── URL-driven context ──────────────────────────────────────────────────────
  const isAcademy = searchParams.get('isAcademy') === '1';
  const nextRoute = searchParams.get('nextRoute');       // /learn?autoLaunch=X or null
  const reqWpm    = parseInt(searchParams.get('reqWpm') ?? '0', 10);
  const reqAcc    = parseInt(searchParams.get('reqAcc') ?? '0', 10);
  const hasGate   = reqWpm > 0 || reqAcc > 0;
  const passed    = Math.round(wpm) >= reqWpm && Math.round(accuracy) >= reqAcc;
  const canAdvance = nextRoute && (!hasGate || passed);

  // ── Weak key errors ──────────────────────────────────────────────────────────
  const topErrors = Object.entries(results.weakKeyMap)
    .sort(([, a], [, b]) => b.errors / b.total - a.errors / a.total)
    .slice(0, 6);

  return (
    <div
      id="results-panel"
      className="results-enter absolute inset-0 flex flex-col items-center justify-center
                 gap-6 bg-surface/95 backdrop-blur-sm rounded-2xl z-20 p-8"
      role="dialog"
      aria-label="Session results"
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-semibold text-correct">Session Complete</h2>
        <p className="text-muted text-sm font-mono">
          {seconds}s · {correctWords}/{totalWords} words correct
        </p>
        <XpBadge wpm={wpm} accuracy={accuracy} />
      </div>

      {/* ── Pass / Fail banner ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {hasGate && (
          <PassFailBanner passed={passed} reqWpm={reqWpm} reqAcc={reqAcc} />
        )}
      </AnimatePresence>

      {/* ── Primary stats row ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-12">
        <StatBlock label="WPM"    value={wpm}             />
        <div className="w-px h-12 bg-surface-3" />
        <StatBlock label="RAW"    value={rawWpm}          />
        <div className="w-px h-12 bg-surface-3" />
        <StatBlock label="ACC"    value={`${accuracy}%`} />
      </div>

      {/* ── Weak keys ────────────────────────────────────────────────────────── */}
      {topErrors.length > 0 && (
        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <p className="stat-label">Weak Keys</p>
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

      {/* ── Action buttons ────────────────────────────────────────────────────── */}
      {isAcademy ? (
        /* ── ACADEMY MODE: 4 specific buttons ─────────────────────────────── */
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          {/* Row 1: Primary actions */}
          <div className="flex items-center gap-3 w-full">
            {/* 1. Restart */}
            <button
              id="restart-btn"
              onClick={onRestart}
              className="flex-1 flex items-center justify-center gap-2
                         bg-surface-2 hover:bg-surface-3 border border-surface-3
                         text-muted hover:text-correct font-mono text-sm font-medium
                         px-4 py-2.5 rounded-xl transition-all duration-150 active:scale-95"
            >
              <RotateCcw size={13} strokeWidth={2.5} />
              Restart
            </button>

            {/* 2. Next Chapter (hidden if final chapter or failed a test gate) */}
            {canAdvance && (
              <button
                id="next-chapter-btn"
                onClick={() => router.push(nextRoute!)}
                className="flex-1 flex items-center justify-center gap-2
                           bg-correct hover:bg-correct/85
                           text-slate-900 font-mono text-sm font-semibold
                           px-4 py-2.5 rounded-xl
                           transition-all duration-150 active:scale-95
                           shadow-[0_4px_16px_rgba(52,211,153,0.30)]"
                autoFocus
              >
                Next Chapter
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Row 2: Secondary navigation */}
          <div className="flex items-center gap-3 w-full">
            {/* 3. Back to Academy */}
            <button
              id="back-to-academy-btn"
              onClick={() => router.push('/learn')}
              className="flex-1 flex items-center justify-center gap-2
                         border border-violet/30 bg-violet/8 hover:bg-violet/15
                         text-violet-light font-mono text-sm font-medium
                         px-4 py-2.5 rounded-xl transition-all duration-150 active:scale-95"
            >
              <GraduationCap size={13} strokeWidth={2} />
              Academy
            </button>

            {/* 4. Stats / Dashboard */}
            <button
              id="view-stats-btn"
              onClick={() => router.push('/dashboard')}
              className="flex-1 flex items-center justify-center gap-2
                         border border-surface-3/60 hover:border-surface-3
                         text-muted hover:text-correct font-mono text-sm font-medium
                         px-4 py-2.5 rounded-xl transition-all duration-150 active:scale-95"
            >
              <BarChart2 size={13} strokeWidth={2} />
              Stats
            </button>
          </div>

          {/* Tab hint */}
          <p className="text-[10px] font-mono text-untyped/60 mt-1">
            press <kbd className="bg-surface-2 border border-surface-3 px-1 py-0.5 rounded">tab</kbd> to restart
          </p>
        </div>
      ) : (
        /* ── PRACTICE MODE: compact Restart + optional Next ──────────────── */
        <div className="flex items-center gap-4">
          <button
            id="restart-btn"
            onClick={onRestart}
            className="flex items-center gap-2 bg-violet hover:bg-violet/80
                       text-white font-medium px-6 py-3 rounded-xl
                       transition-all duration-150 active:scale-95
                       focus-visible:ring-2 focus-visible:ring-violet-light
                       focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            autoFocus
          >
            <span>Restart</span>
            <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono">Tab</kbd>
          </button>

          {canAdvance ? (
            <button
              id="next-chapter-btn"
              onClick={() => router.push(nextRoute!)}
              className="flex items-center gap-2 bg-correct hover:bg-correct/80
                         text-slate-900 font-medium px-6 py-3 rounded-xl
                         transition-all duration-150 active:scale-95 shadow-md"
            >
              Next Chapter →
            </button>
          ) : (
            <button
              id="view-dashboard-btn"
              onClick={() => router.push('/dashboard')}
              className="text-muted hover:text-correct transition-colors text-sm underline
                         underline-offset-2"
            >
              View stats →
            </button>
          )}
        </div>
      )}
    </div>
  );
});

ResultsPanel.displayName = 'ResultsPanel';
export default ResultsPanel;
