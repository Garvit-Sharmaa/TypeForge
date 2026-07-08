'use client';
import React from 'react';
import { RANK_COLORS } from '@typing-master/shared';
import type { UserRank } from '@typing-master/shared';

// ── StatCard ─────────────────────────────────────────────────────────────────
// Premium Linear-style card. Light: white + soft drop shadow.
// Dark: elevated navy + top inner highlight + subtle border.
// Value is stark black/white for maximum contrast; label is tiny + uppercase.

interface StatCardProps {
  label:   string;
  value:   string | number;
  unit?:   string;
  sub?:    string;
  accent?: string;
  icon?:   React.ReactNode;
  id?:     string;
}

export const StatCard = React.memo(function StatCard({
  label, value, unit, sub, accent, icon, id,
}: StatCardProps) {
  return (
    <div
      id={id}
      className={[
        // Layout
        'relative flex flex-col gap-3 rounded-2xl p-5 overflow-hidden',
        'transition-all duration-200 group',
        // Light mode: white card, delicate border, soft shadow
        'bg-white border border-slate-200 shadow-card',
        'hover:shadow-card-hover hover:-translate-y-0.5',
        // Dark mode: elevated surface, inset top highlight, subtle border
        'dark:bg-[#111827] dark:border-white/5 dark:shadow-card-inset',
        'dark:hover:border-white/10',
      ].join(' ')}
    >
      {/* Subtle purple corner glow on hover (dark only) */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100
                      transition-opacity duration-300 pointer-events-none
                      dark:bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.08),transparent_70%)]" />

      {/* Label + icon row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em]
                         text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {icon && (
          <span className="text-slate-400 group-hover:text-purple-500
                           dark:text-slate-600 dark:group-hover:text-purple-400
                           transition-colors text-base">
            {icon}
          </span>
        )}
      </div>

      {/* Primary value — stark contrast */}
      <div className="flex items-end gap-1.5">
        <span
          className="font-mono text-3xl font-bold leading-none tracking-tight
                     text-slate-900 dark:text-white"
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-sm text-slate-400 dark:text-slate-500 mb-0.5">
            {unit}
          </span>
        )}
      </div>

      {/* Sub-label */}
      {sub && (
        <span className="text-[11px] text-slate-500 dark:text-slate-500 font-mono">
          {sub}
        </span>
      )}
    </div>
  );
});


// ── RankBadge ─────────────────────────────────────────────────────────────────
export function RankBadge({ rank }: { rank: UserRank }) {
  const color = RANK_COLORS[rank] ?? '#a78bfa';
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}70` }}
      />
      <span
        className="font-mono text-sm font-semibold capitalize"
        style={{ color }}
      >
        {rank}
      </span>
    </div>
  );
}


// ── XpBar (rank progress) ─────────────────────────────────────────────────────
// The fill uses a metallic gradient keyed to the current rank tier.
// Wrapped in a Step 3-style polished track.

const RANK_GRADIENTS: Record<UserRank, string> = {
  bronze:  'linear-gradient(90deg, #92400e, #d97706, #f59e0b, #d97706)',
  silver:  'linear-gradient(90deg, #475569, #94a3b8, #cbd5e1, #94a3b8)',
  gold:    'linear-gradient(90deg, #b45309, #f59e0b, #fde68a, #f59e0b)',
  diamond: 'linear-gradient(90deg, #1d4ed8, #3b82f6, #93c5fd, #3b82f6)',
  master:  'linear-gradient(90deg, #6d28d9, #8b5cf6, #c4b5fd, #8b5cf6)',
  legend:  'linear-gradient(90deg, #be185d, #ec4899, #f9a8d4, #ec4899)',
};

const RANK_SHADOWS: Record<UserRank, string> = {
  bronze:  '0 0 12px rgba(217,119,6,0.5)',
  silver:  '0 0 12px rgba(148,163,184,0.4)',
  gold:    '0 0 14px rgba(245,158,11,0.55)',
  diamond: '0 0 14px rgba(59,130,246,0.5)',
  master:  '0 0 14px rgba(139,92,246,0.55)',
  legend:  '0 0 16px rgba(236,72,153,0.6)',
};

const RANK_NEXT: Record<UserRank, string> = {
  bronze: 'Silver', silver: 'Gold', gold: 'Diamond',
  diamond: 'Master', master: 'Legend', legend: 'MAX',
};

const XP_THRESHOLDS: Record<UserRank, [number, number]> = {
  bronze:  [0,       1_000],
  silver:  [1_000,   5_000],
  gold:    [5_000,  15_000],
  diamond: [15_000, 40_000],
  master:  [40_000, 100_000],
  legend:  [100_000, 100_000],
};

export function XpBar({ xp, rank }: { xp: number; rank: UserRank }) {
  const [min, max] = XP_THRESHOLDS[rank] ?? [0, 1000];
  const pct = rank === 'legend' ? 100 : Math.min(100, Math.round(((xp - min) / (max - min)) * 100));
  const trackBg = RANK_GRADIENTS[rank] || 'var(--violet)';
  const trackShadow = RANK_SHADOWS[rank] || '0 0 12px var(--violet-dim)';

  return (
    <div className="flex flex-col gap-3">
      {/* Rank badge + XP label */}
      <div className="flex items-center justify-between">
        <RankBadge rank={rank} />
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {xp.toLocaleString()} <span className="text-slate-400 dark:text-slate-600">XP</span>
        </span>
      </div>

      {/* Polished track */}
      <div className="relative h-2 w-full rounded-full overflow-hidden
                      bg-surface-2 dark:bg-white/[0.06]
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]
                      dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
        {/* Metallic fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{
            width:      `${pct}%`,
            background: trackBg,
            boxShadow:  trackShadow,
          }}
        />
        {/* Inner shine streak */}
        <div
          className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
          style={{
            width:      `${pct}%`,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Next rank label */}
      {rank !== 'legend' && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">
            {pct}% complete
          </span>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">
            {(max - xp).toLocaleString()} XP → {RANK_NEXT[rank] || 'Next'}
          </span>
        </div>
      )}
    </div>
  );
}
