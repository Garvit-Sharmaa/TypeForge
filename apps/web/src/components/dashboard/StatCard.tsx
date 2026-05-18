'use client';
import React from 'react';
import { RANK_COLORS } from '@typing-master/shared';
import type { UserRank } from '@typing-master/shared';

interface StatCardProps {
  label:    string;
  value:    string | number;
  unit?:    string;
  sub?:     string;
  accent?:  string;
  icon?:    React.ReactNode;
  id?:      string;
}

export const StatCard = React.memo(function StatCard({
  label, value, unit, sub, accent, icon, id,
}: StatCardProps) {
  return (
    <div
      id={id}
      className="glass-subtle rounded-2xl p-5 flex flex-col gap-3
                 hover:border-violet/20 transition-all duration-200 group"
    >
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className="text-untyped group-hover:text-violet-light transition-colors text-lg">
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span
          className="font-mono text-3xl font-bold leading-none"
          style={{ color: accent ?? 'var(--violet-light)' }}
        >
          {value}
        </span>
        {unit && <span className="font-mono text-sm text-muted mb-1">{unit}</span>}
      </div>
      {sub && <span className="text-xs text-muted font-mono">{sub}</span>}
    </div>
  );
});

// ── Rank badge with color ─────────────────────────────────────────────────────
export function RankBadge({ rank }: { rank: UserRank }) {
  const color = RANK_COLORS[rank] ?? '#a78bfa';
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
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

// ── XP Progress bar ───────────────────────────────────────────────────────────
export function XpBar({ xp, rank }: { xp: number; rank: UserRank }) {
  const thresholds: Record<UserRank, [number, number]> = {
    bronze:  [0,      1_000],
    silver:  [1_000,  5_000],
    gold:    [5_000,  15_000],
    diamond: [15_000, 40_000],
    master:  [40_000, 100_000],
    legend:  [100_000, 100_000],
  };
  const [min, max] = thresholds[rank] ?? [0, 1000];
  const pct = rank === 'legend' ? 100 : Math.round(((xp - min) / (max - min)) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <RankBadge rank={rank} />
        <span className="font-mono text-xs text-muted">{xp.toLocaleString()} XP</span>
      </div>
      <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
        <div
          className="xp-bar-fill h-full rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      {rank !== 'legend' && (
        <span className="text-[10px] text-untyped font-mono text-right">
          {(max - xp).toLocaleString()} XP to {
            ({ bronze:'Silver', silver:'Gold', gold:'Diamond',
               diamond:'Master', master:'Legend', legend:'Max' })[rank]
          }
        </span>
      )}
    </div>
  );
}
