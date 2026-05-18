'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useUserStore, selectTokens, selectUser } from '@/store/userStore';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { analyticsApi }      from '@/lib/api';
import { StatCard, XpBar }   from '@/components/dashboard/StatCard';
import WpmChart              from '@/components/dashboard/WpmChart';
import { Keyboard }          from '@/components/keyboard/Keyboard';
import { useWeakKeyHeatmap } from '@/hooks/useWeakKeyHeatmap';
import { useKeyboardStore }  from '@/store/keyboardStore';
import type { UserRank }     from '@typing-master/shared';

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-surface-2 rounded-xl ${className}`} />
);

const Section = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section id={id} className="flex flex-col gap-4">
    <h2 className="font-mono text-sm font-semibold text-muted uppercase tracking-widest">{title}</h2>
    {children}
  </section>
);

function formatTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Heatmap Controls — injected via controlsSlot ──────────────────────────────
function HeatmapControls() {
  const { dimension, setDimension, isLoading, hasData, error, refetch } =
    useWeakKeyHeatmap('accuracy');

  const { toggleHeatmap } = useKeyboardStore();

  if (error) {
    return (
      <div className="flex items-center gap-3 mt-2 px-1">
        <span className="text-[10px] font-mono text-incorrect">{error}</span>
        <button onClick={refetch}
          className="text-[10px] font-mono text-violet-light underline">retry</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-3 flex-wrap">
      {/* Dimension toggle */}
      <div className="flex items-center bg-surface-2 border border-surface-3 rounded-lg p-0.5 gap-0.5">
        {(['accuracy', 'speed'] as const).map((d) => (
          <button
            key={d}
            id={`heatmap-${d}-btn`}
            onClick={() => setDimension(d)}
            className={`text-[10px] font-mono px-3 py-1.5 rounded-md transition-all duration-150
              ${dimension === d
                ? 'bg-violet text-white shadow-sm'
                : 'text-untyped hover:text-muted'}`}
          >
            {d === 'accuracy' ? '⚠ accuracy' : '⚡ speed'}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <span className="text-[10px] font-mono text-untyped animate-pulse">loading data…</span>
      )}

      {/* No-data notice */}
      {!isLoading && !hasData && (
        <span className="text-[10px] font-mono text-untyped">
          Complete sessions to see per-key data
        </span>
      )}

      {/* Color scale legend */}
      {hasData && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] text-untyped font-mono">
            {dimension === 'accuracy' ? 'error rate:' : 'avg latency:'}
          </span>
          {[
            { label: dimension === 'accuracy' ? '0%' : '<80ms',  color: '#0d2a18' },
            { label: dimension === 'accuracy' ? '5%' : '150ms',  color: '#3d2800' },
            { label: dimension === 'accuracy' ? '15%': '250ms',  color: '#601500' },
            { label: dimension === 'accuracy' ? '25%+':'350ms+', color: '#6b0c0c' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm border border-white/10"
                    style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted font-mono">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dashboard types ───────────────────────────────────────────────────────────
interface DashStats {
  totalSessions: number; avgWpm: number; bestWpm: number; avgRawWpm: number;
  avgAccuracy: number; totalTimeMs: number; streakDays: number; xp: number; rank: string;
}
interface WpmPoint { sessionIndex: number; wpm: number; accuracy: number; completedAt: string; }

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const tokens     = useUserStore(selectTokens);
  const user       = useUserStore(selectUser);
  const { dashboard, isLoading, lastFetched, setDashboard, setLoading } = useAnalyticsStore();

  const [wpmHistory, setWpmHistory] = useState<WpmPoint[]>([]);
  const [stats,      setStats]      = useState<DashStats | null>(null);
  const [error,      setError]      = useState('');

  const fetchData = useCallback(async () => {
    if (!tokens?.accessToken) return;
    if (lastFetched && Date.now() - lastFetched < 60_000 && dashboard) {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-correct">
            {user ? `Hey, ${user.username}` : 'Dashboard'}
          </h1>
          <p className="text-muted text-sm mt-1 font-mono">
            {isGuest ? 'Sign in to save your progress' : 'Your typing intelligence report'}
          </p>
        </div>
        <Link href="/practice" id="go-practice-btn"
          className="bg-violet hover:bg-violet/85 text-white font-mono text-sm
                     px-5 py-2.5 rounded-xl transition-all duration-150 active:scale-95">
          Practice →
        </Link>
      </div>

      {/* Guest banner */}
      {isGuest && (
        <div className="glass border border-violet/20 rounded-2xl px-6 py-4 flex items-center
                        justify-between gap-4">
          <p className="text-sm text-muted font-mono">
            ⚡ You're in guest mode. Sign in to sync stats and earn XP.
          </p>
          <Link href="/login"
            className="text-violet-light text-sm font-mono underline underline-offset-2
                       hover:text-correct transition-colors whitespace-nowrap">
            Sign in →
          </Link>
        </div>
      )}

      {error && (
        <div className="bg-incorrect/10 border border-incorrect/30 text-incorrect
                        text-sm px-4 py-3 rounded-xl font-mono" role="alert">
          {error}
        </div>
      )}

      {/* XP bar */}
      {user && stats && (
        <div className="glass-subtle rounded-2xl p-6">
          <XpBar xp={stats.xp} rank={stats.rank as UserRank} />
        </div>
      )}

      {/* Stats grid */}
      <Section title="Performance" id="stats-section">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : stats ? (
            <>
              <StatCard id="stat-avg-wpm"   label="Avg WPM"   value={stats.avgWpm}               unit="wpm" icon="⚡" />
              <StatCard id="stat-best-wpm"  label="Best WPM"  value={stats.bestWpm}              unit="wpm" accent="#34d399" icon="🏆" />
              <StatCard id="stat-accuracy"  label="Accuracy"  value={`${stats.avgAccuracy}%`}    icon="🎯" />
              <StatCard id="stat-sessions"  label="Sessions"  value={stats.totalSessions}
                sub={`${formatTime(stats.totalTimeMs)} total`}                                   icon="📊" />
            </>
          ) : Array.from({ length: 4 }).map((_, i) => (
            <StatCard key={i} label={['Avg WPM','Best WPM','Accuracy','Sessions'][i]} value="—" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {!isLoading && stats && (
            <>
              <StatCard id="stat-streak" label="Day Streak" value={stats.streakDays}
                unit="days" accent="#fbbf24" icon="🔥"
                sub={stats.streakDays >= 7 ? '7-day goal reached!' : `${7 - stats.streakDays} more for badge`} />
              <StatCard id="stat-raw-wpm" label="Raw WPM"  value={stats.avgRawWpm}
                unit="wpm" sub="unpenalized speed"                   icon="⌨️" />
            </>
          )}
        </div>
      </Section>

      {/* WPM chart */}
      <Section title="WPM Progression" id="chart-section">
        <div className="glass-subtle rounded-2xl p-6">
          {isLoading ? <Skeleton className="h-64" /> : (
            <div style={{ height: 260 }}>
              <WpmChart data={wpmHistory} bestWpm={stats?.bestWpm ?? 0} />
            </div>
          )}
        </div>
      </Section>

      {/* ── Keyboard Heatmap (SVG engine reused from Phase 2) ── */}
      <Section title="Key Intelligence Heatmap" id="heatmap-section">
        <div className="glass-subtle rounded-2xl p-6 flex flex-col gap-2">
          <p className="text-muted text-xs font-mono">
            Per-key analytics from all your sessions. Hover any key for exact stats.
          </p>

          {/* The SAME <Keyboard /> component used in the typing arena.
              controlsSlot injects heatmap-specific toggles instead of live controls.
              The SVG rendering engine (Key → Row → Keyboard) is 100% reused. */}
          <Keyboard
            className="w-full"
            controlsSlot={<HeatmapControls />}
          />
        </div>
      </Section>
    </div>
  );
}
