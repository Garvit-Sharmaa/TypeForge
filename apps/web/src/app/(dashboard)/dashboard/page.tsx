'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Zap, Trophy, Target, BarChart3,
  Flame, Keyboard as KeyboardIcon,
  ArrowRight, RefreshCw,
} from 'lucide-react';
import { useUserStore, selectTokens, selectUser } from '@/store/userStore';
import { useAnalyticsStore }                       from '@/store/analyticsStore';
import { analyticsApi }                            from '@/lib/api';
import { StatCard, XpBar }                         from '@/components/dashboard/StatCard';
import WpmChart                                    from '@/components/dashboard/WpmChart';
import { Keyboard }                                from '@/components/keyboard/Keyboard';
import { useWeakKeyHeatmap }                       from '@/hooks/useWeakKeyHeatmap';
import { useKeyboardStore }                        from '@/store/keyboardStore';
import type { UserRank }                           from '@typing-master/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={[
    'animate-pulse rounded-2xl',
    'bg-slate-100 dark:bg-white/[0.04]',
    className,
  ].join(' ')} />
);

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({
  title, children, id,
}: { title: string; children: React.ReactNode; id?: string }) => (
  <section id={id} className="flex flex-col gap-4">
    <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]
                   text-slate-400 dark:text-slate-500">
      {title}
    </h2>
    {children}
  </section>
);

// ── Premium card wrapper (used for chart + heatmap containers) ────────────────
const PanelCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={[
    'rounded-2xl p-6',
    'bg-white border border-slate-200 shadow-card',
    'dark:bg-[#111827] dark:border-white/5 dark:shadow-card-inset',
    className,
  ].join(' ')}>
    {children}
  </div>
);

// ── Heatmap controls (unchanged logic, updated styling) ───────────────────────
function HeatmapControls() {
  const { dimension, setDimension, isLoading, hasData, error, refetch } =
    useWeakKeyHeatmap('accuracy');

  if (error) {
    return (
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[10px] font-mono text-red-500 dark:text-red-400">{error}</span>
        <button onClick={refetch}
          className="text-[10px] font-mono text-purple-500 dark:text-purple-400 underline">
          retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-3 flex-wrap">
      {/* Dimension toggle */}
      <div className="flex items-center bg-slate-100 dark:bg-white/[0.06]
                      border border-slate-200 dark:border-white/5
                      rounded-lg p-0.5 gap-0.5">
        {(['accuracy', 'speed'] as const).map((d) => (
          <button
            key={d}
            id={`heatmap-${d}-btn`}
            onClick={() => setDimension(d)}
            className={[
              'text-[10px] font-mono px-3 py-1.5 rounded-md transition-all duration-150',
              dimension === d
                ? 'bg-purple-600 dark:bg-purple-500 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
            ].join(' ')}
          >
            {d === 'accuracy' ? '⚠ accuracy' : '⚡ speed'}
          </button>
        ))}
      </div>

      {isLoading && (
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600 animate-pulse">
          loading…
        </span>
      )}

      {!isLoading && !hasData && (
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">
          Complete sessions to see per-key data
        </span>
      )}

      {hasData && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">
            {dimension === 'accuracy' ? 'error rate:' : 'avg latency:'}
          </span>
          {[
            { label: dimension === 'accuracy' ? '0%'   : '<80ms',  color: '#0d2a18' },
            { label: dimension === 'accuracy' ? '5%'   : '150ms',  color: '#3d2800' },
            { label: dimension === 'accuracy' ? '15%'  : '250ms',  color: '#601500' },
            { label: dimension === 'accuracy' ? '25%+' : '350ms+', color: '#6b0c0c' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm border border-black/10 dark:border-white/10"
                    style={{ backgroundColor: color }} />
              <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashStats {
  totalSessions: number; avgWpm: number; bestWpm: number; avgRawWpm: number;
  avgAccuracy: number; totalTimeMs: number; streakDays: number; xp: number; rank: string;
}
interface WpmPoint { sessionIndex: number; wpm: number; accuracy: number; completedAt: string; }

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const tokens = useUserStore(selectTokens);
  const user   = useUserStore(selectUser);
  const { dashboard, isLoading, lastFetched, setDashboard, setLoading } = useAnalyticsStore();

  const [wpmHistory, setWpmHistory] = useState<WpmPoint[]>([]);
  const [stats,      setStats]      = useState<DashStats | null>(null);
  const [error,      setError]      = useState('');

  const fetchData = useCallback(async () => {
    if (!tokens?.accessToken) return;
    if (lastFetched !== null && Date.now() - lastFetched < 60_000 && dashboard) {
      setStats(dashboard.summary as any);
      setWpmHistory(dashboard.last30Days as any);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const dash = await analyticsApi.dashboard(tokens.accessToken);
      setStats(dash.stats as any);
      setWpmHistory(dash.wpmHistory);
      setDashboard({
        summary:        dash.stats as any,
        weakKeys:       [],
        last30Days:     dash.wpmHistory as any,
        recentSessions: [],
      });
    } catch (err: any) {
      setError(err.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [tokens, lastFetched, dashboard, setDashboard, setLoading]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isGuest = !user;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-10 flex flex-col gap-10 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight
                         text-slate-900 dark:text-white">
            {user ? `Hey, ${user.username} 👋` : 'Dashboard'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-mono">
            {isGuest
              ? 'Sign in to save your progress'
              : 'Your typing intelligence report'}
          </p>
        </div>

        {/* Premium Practice button */}
        <Link
          href="/practice"
          id="go-practice-btn"
          className={[
            'flex items-center gap-2 shrink-0',
            'bg-purple-600 hover:bg-purple-500 dark:bg-purple-600 dark:hover:bg-purple-500',
            'text-white font-semibold text-sm',
            'px-5 py-2.5 rounded-xl',
            'shadow-purple-glow/30 hover:shadow-purple-glow',
            'transition-all duration-200',
            'hover:-translate-y-0.5 active:scale-95 active:translate-y-0',
          ].join(' ')}
        >
          Practice
          <ArrowRight size={15} strokeWidth={2.5} />
        </Link>
      </div>

      {/* ── Guest banner ───────────────────────────────────────────────────── */}
      {isGuest && (
        <div className="flex items-center justify-between gap-4 rounded-2xl px-6 py-4
                        bg-purple-50 border border-purple-100
                        dark:bg-purple-900/10 dark:border-purple-500/20">
          <p className="text-sm text-purple-700 dark:text-purple-300 font-mono">
            ⚡ You're in guest mode. Sign in to sync stats and earn XP.
          </p>
          <Link href="/login"
            className="text-purple-600 dark:text-purple-400 text-sm font-mono font-semibold
                       underline underline-offset-2 hover:text-purple-500 transition-colors whitespace-nowrap">
            Sign in →
          </Link>
        </div>
      )}

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600
                        dark:bg-red-900/10 dark:border-red-500/20 dark:text-red-400
                        text-sm px-4 py-3 rounded-xl font-mono flex items-center gap-3"
             role="alert">
          <span className="flex-1">{error}</span>
          <button onClick={fetchData}
            className="flex items-center gap-1 text-xs underline opacity-70 hover:opacity-100">
            <RefreshCw size={12} /> retry
          </button>
        </div>
      )}

      {/* ── XP / Rank bar ──────────────────────────────────────────────────── */}
      {user && stats && (
        <PanelCard>
          <XpBar xp={stats.xp} rank={stats.rank as UserRank} />
        </PanelCard>
      )}

      {/* ── Performance stats grid ─────────────────────────────────────────── */}
      <Section title="Performance" id="stats-section">
        {/* Top row — 4 cols */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
            : stats ? (
              <>
                <StatCard
                  id="stat-avg-wpm"
                  label="Avg WPM"
                  value={stats.avgWpm}
                  unit="wpm"
                  icon={<Zap size={15} strokeWidth={2} />}
                />
                <StatCard
                  id="stat-best-wpm"
                  label="Best WPM"
                  value={stats.bestWpm}
                  unit="wpm"
                  accent="#16a34a"
                  icon={<Trophy size={15} strokeWidth={2} />}
                />
                <StatCard
                  id="stat-accuracy"
                  label="Accuracy"
                  value={`${stats.avgAccuracy}%`}
                  icon={<Target size={15} strokeWidth={2} />}
                />
                <StatCard
                  id="stat-sessions"
                  label="Sessions"
                  value={stats.totalSessions}
                  sub={`${formatTime(stats.totalTimeMs)} total`}
                  icon={<BarChart3 size={15} strokeWidth={2} />}
                />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <StatCard key={i} label={['Avg WPM','Best WPM','Accuracy','Sessions'][i]} value="—" />
              ))
            )}
        </div>

        {/* Bottom row — 2 cols */}
        <div className="grid grid-cols-2 gap-4">
          {!isLoading && stats && (
            <>
              <StatCard
                id="stat-streak"
                label="Day Streak"
                value={stats.streakDays}
                unit="days"
                accent="#d97706"
                icon={<Flame size={15} strokeWidth={2} />}
                sub={stats.streakDays >= 7
                  ? '🎯 7-day goal reached!'
                  : `${7 - stats.streakDays} more days for badge`}
              />
              <StatCard
                id="stat-raw-wpm"
                label="Raw WPM"
                value={stats.avgRawWpm}
                unit="wpm"
                sub="unpenalized speed"
                icon={<KeyboardIcon size={15} strokeWidth={2} />}
              />
            </>
          )}
        </div>
      </Section>

      {/* ── WPM chart ──────────────────────────────────────────────────────── */}
      <Section title="WPM Progression" id="chart-section">
        <PanelCard>
          {isLoading ? <Skeleton className="h-64" /> : (
            <div style={{ height: 260 }}>
              <WpmChart data={wpmHistory} bestWpm={stats?.bestWpm ?? 0} />
            </div>
          )}
        </PanelCard>
      </Section>

      {/* ── Key Intelligence Heatmap ───────────────────────────────────────── */}
      <Section title="Key Intelligence Heatmap" id="heatmap-section">
        <PanelCard>
          <p className="text-slate-500 dark:text-slate-500 text-xs font-mono mb-1">
            Per-key analytics from all your sessions. Hover any key for exact stats.
          </p>
          <Keyboard
            className="w-full"
            controlsSlot={<HeatmapControls />}
          />
        </PanelCard>
      </Section>

    </div>
  );
}
