import type { UserRank } from '../types/User';

/** XP thresholds per rank boundary */
export const RANK_THRESHOLDS: Record<UserRank, number> = {
  bronze:   0,
  silver:   1_000,
  gold:     5_000,
  diamond:  15_000,
  master:   40_000,
  legend:   100_000,
};

export const RANK_ORDER: UserRank[] = [
  'bronze', 'silver', 'gold', 'diamond', 'master', 'legend',
];

export function getRankForXp(xp: number): UserRank {
  let rank: UserRank = 'bronze';
  for (const r of RANK_ORDER) {
    if (xp >= RANK_THRESHOLDS[r]) rank = r;
    else break;
  }
  return rank;
}

export function getNextRank(current: UserRank): UserRank | null {
  const idx = RANK_ORDER.indexOf(current);
  return idx < RANK_ORDER.length - 1 ? RANK_ORDER[idx + 1] : null;
}

export function xpToNextRank(xp: number, current: UserRank): number {
  const next = getNextRank(current);
  if (!next) return 0;
  return RANK_THRESHOLDS[next] - xp;
}

export const RANK_COLORS: Record<UserRank, string> = {
  bronze:  '#cd7f32',
  silver:  '#c0c0c0',
  gold:    '#ffd700',
  diamond: '#b9f2ff',
  master:  '#a78bfa',
  legend:  '#f59e0b',
};
