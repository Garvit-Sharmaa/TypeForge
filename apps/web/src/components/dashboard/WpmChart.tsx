'use client';
/**
 * WpmChart — Recharts area chart showing WPM progression over sessions.
 *
 * Rendering optimizations:
 *   • React.memo — only re-renders when wpmHistory data changes
 *   • ResponsiveContainer lets Recharts handle resize without manual listeners
 *   • Custom dot component renders only for highlighted points (best WPM)
 *   • Gradient fill via defs/linearGradient for premium dark aesthetic
 */

import React from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';

interface WpmDataPoint {
  sessionIndex: number;
  wpm:          number;
  accuracy:     number;
  completedAt:  string;
}

interface WpmChartProps {
  data:    WpmDataPoint[];
  bestWpm: number;
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as WpmDataPoint;
  return (
    <div className="glass rounded-xl px-4 py-3 flex flex-col gap-1 text-xs font-mono
                    border border-violet/20 shadow-glass">
      <span className="text-muted">Session #{d.sessionIndex}</span>
      <div className="flex gap-4">
        <span><span className="text-violet-light font-bold">{d.wpm}</span> wpm</span>
        <span><span className="text-success font-bold">{d.accuracy}%</span> acc</span>
      </div>
    </div>
  );
};

// ── Custom dot — highlights best WPM session ──────────────────────────────────
const CustomDot = ({ cx, cy, payload, bestWpm }: any) => {
  if (payload.wpm !== bestWpm) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="#a78bfa" stroke="#0d0d14" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={9} fill="none" stroke="#a78bfa" strokeWidth={1} opacity={0.4} />
    </g>
  );
};

const WpmChart = React.memo(function WpmChart({ data, bestWpm }: WpmChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-untyped font-mono text-sm">
        Complete sessions to see your progression
      </div>
    );
  }

  const avgWpm = Math.round(data.reduce((a, b) => a + b.wpm, 0) / data.length);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
        {/* Gradient fill — defined inside chart as JSX children (Recharts pattern) */}
        <defs>
          <linearGradient id="wpmGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.04)"
          vertical={false}
        />

        <XAxis
          dataKey="sessionIndex"
          tick={{ fill: '#3d3d5c', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `#${v}`}
        />
        <YAxis
          domain={['auto', 'auto']}
          tick={{ fill: '#3d3d5c', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}`}
          width={36}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#a78bfa', strokeWidth: 1, strokeDasharray: '4 4' }} />

        {/* Average line */}
        <ReferenceLine
          y={avgWpm}
          stroke="#4c1d95"
          strokeDasharray="6 3"
          label={{ value: `avg ${avgWpm}`, fill: '#6b7280', fontSize: 10, fontFamily: 'JetBrains Mono', position: 'insideTopRight' }}
        />

        {/* WPM area */}
        <Area
          type="monotone"
          dataKey="wpm"
          stroke="#a78bfa"
          strokeWidth={2}
          fill="url(#wpmGradient)"
          dot={<CustomDot bestWpm={bestWpm} />}
          activeDot={{ r: 4, fill: '#a78bfa', stroke: '#0d0d14', strokeWidth: 2 }}
          isAnimationActive={true}
          animationDuration={600}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

WpmChart.displayName = 'WpmChart';
export default WpmChart;
