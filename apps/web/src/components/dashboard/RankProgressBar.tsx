'use client';
/**
 * RankProgressBar — Standalone polished XP progress bar.
 *
 * Renders a deeply inset rounded track with a rank-keyed metallic gradient fill,
 * a top shine streak for 3D depth, and a soft glow shadow on the fill bar.
 * Fully theme-aware: light track uses bg-slate-100, dark track uses white/6.
 */

import React from 'react';
import type { UserRank } from '@typing-master/shared';

// Per-rank gradient + glow pairs — simulate metallic sheen
const GRADIENTS: Record<UserRank, { fill: string; glow: string }> = {
  bronze:  { fill: 'linear-gradient(90deg,#92400e,#d97706,#fbbf24,#d97706)', glow: 'rgba(217,119,6,0.50)' },
  silver:  { fill: 'linear-gradient(90deg,#475569,#94a3b8,#e2e8f0,#94a3b8)', glow: 'rgba(148,163,184,0.40)' },
  gold:    { fill: 'linear-gradient(90deg,#b45309,#f59e0b,#fde68a,#f59e0b)', glow: 'rgba(245,158,11,0.55)' },
  diamond: { fill: 'linear-gradient(90deg,#1d4ed8,#3b82f6,#bfdbfe,#3b82f6)', glow: 'rgba(59,130,246,0.50)' },
  master:  { fill: 'linear-gradient(90deg,#6d28d9,#8b5cf6,#ddd6fe,#8b5cf6)', glow: 'rgba(139,92,246,0.55)' },
  legend:  { fill: 'linear-gradient(90deg,#be185d,#ec4899,#fbcfe8,#ec4899)', glow: 'rgba(236,72,153,0.60)' },
};

const XP_THRESHOLDS: Record<UserRank, [number, number]> = {
  bronze:  [0,       1_000],
  silver:  [1_000,   5_000],
  gold:    [5_000,  15_000],
  diamond: [15_000, 40_000],
  master:  [40_000, 100_000],
  legend:  [100_000, 100_000],
};

interface RankProgressBarProps {
  xp:         number;
  rank:       UserRank;
  /** Height of the track in px (default: 8) */
  trackHeight?: number;
  /** Show percentage label below the bar */
  showLabel?: boolean;
}

export function RankProgressBar({
  xp,
  rank,
  trackHeight = 8,
  showLabel   = true,
}: RankProgressBarProps) {
  const [min, max] = XP_THRESHOLDS[rank] ?? [0, 1000];
  const pct = rank === 'legend'
    ? 100
    : Math.min(100, Math.max(0, Math.round(((xp - min) / (max - min)) * 100)));

  const { fill, glow } = GRADIENTS[rank];

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* ── Track ─────────────────────────────────────────────────────────── */}
      <div
        className="relative w-full rounded-full overflow-hidden
                   bg-slate-100 dark:bg-white/[0.06]
                   shadow-[inset_0_1px_3px_rgba(0,0,0,0.14)]
                   dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)]"
        style={{ height: trackHeight }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${rank} rank progress: ${pct}%`}
      >
        {/* ── Metallic fill ───────────────────────────────────────────────── */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width:      `${pct}%`,
            background: fill,
            boxShadow:  `0 0 10px ${glow}, 0 0 4px ${glow}`,
          }}
        />

        {/* ── Top-edge shine streak (depth illusion) ──────────────────────── */}
        <div
          className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
          style={{
            width:      `${pct}%`,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, transparent 55%)',
          }}
        />
      </div>

      {/* ── Label ─────────────────────────────────────────────────────────── */}
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-600">
            {pct}%
          </span>
          {rank !== 'legend' && (
            <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-600">
              {(max - xp).toLocaleString()} XP to{' '}
              {{ bronze:'Silver', silver:'Gold', gold:'Diamond',
                 diamond:'Master', master:'Legend', legend:'MAX' }[rank]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
