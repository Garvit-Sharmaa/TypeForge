'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  useKeyboardStore, selectLayout,
  selectHeatmapEnabled, selectShowFingerColors,
  selectHoveredKeyId, selectHeatmapData, selectHeatmapMode,
} from '@/store/keyboardStore';
import { Row } from './Row';
import type { KeyboardLayout } from '@typing-master/shared';

interface KeyboardProps {
  className?:     string;
  /** Override layout — if omitted, fetches /layouts/qwerty-ansi.json */
  layout?:        KeyboardLayout;
  /**
   * Inject custom controls below the SVG.
   * Pass `null` to suppress the default control strip entirely.
   * Omit (undefined) to show the default live-mode controls.
   */
  controlsSlot?:  React.ReactNode | null;
}

export function Keyboard({ className, layout: layoutProp, controlsSlot }: KeyboardProps) {
  const { setLayout, toggleHeatmap, toggleFingerColors } = useKeyboardStore();
  const layout          = useKeyboardStore(selectLayout);
  const heatmapEnabled  = useKeyboardStore(selectHeatmapEnabled);
  const showFingerColors= useKeyboardStore(selectShowFingerColors);
  const hoveredKeyId    = useKeyboardStore(selectHoveredKeyId);
  const heatmapData     = useKeyboardStore(selectHeatmapData);
  const heatmapMode     = useKeyboardStore(selectHeatmapMode);

  // Track raw mouse position relative to the wrapper div for tooltip placement
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  // Resolve hovered key's analytics data and display label for the tooltip
  const hoveredKd  = hoveredKeyId ? heatmapData[hoveredKeyId] : null;
  const hoveredDef = React.useMemo(
    () => hoveredKeyId && layout ? layout.keys.find((k) => k.id === hoveredKeyId) ?? null : null,
    [hoveredKeyId, layout],
  );

  // Load layout once
  useEffect(() => {
    if (layoutProp) { setLayout(layoutProp); return; }
    if (layout)     return;
    fetch('/layouts/qwerty-ansi.json')
      .then((r) => r.json())
      .then((data: KeyboardLayout) => setLayout(data))
      .catch(console.error);
  }, [layoutProp, layout, setLayout]);

  if (!layout) {
    return (
      <div className={`flex items-center justify-center h-32 text-untyped font-mono text-xs ${className ?? ''}`}>
        Loading keyboard…
      </div>
    );
  }

  // Default live-mode control strip
  const defaultControls = (
    <div className="flex items-center gap-3 mt-2 px-1">
      <button
        id="kbd-toggle-heatmap"
        onClick={toggleHeatmap}
        className={`text-[10px] font-mono px-2 py-1 rounded-md border transition-colors
          ${heatmapEnabled
            ? 'border-violet/50 text-violet-light bg-violet/10'
            : 'border-surface-3 text-untyped hover:border-violet/30'}`}
      >
        {heatmapEnabled ? '● heatmap on' : '○ heatmap'}
      </button>
      <button
        id="kbd-toggle-fingers"
        onClick={toggleFingerColors}
        className={`text-[10px] font-mono px-2 py-1 rounded-md border transition-colors
          ${showFingerColors
            ? 'border-surface-3 text-violet-light bg-violet/10'
            : 'border-surface-3 text-untyped hover:border-violet/30'}`}
      >
        {showFingerColors ? '● fingers on' : '○ fingers'}
      </button>
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className={`rounded-xl p-2 bg-slate-100/50 border border-slate-200 dark:bg-slate-900/50 dark:border-white/5 ${className ?? ''}`}
      style={{ position: 'relative' }}
      onMouseMove={heatmapEnabled ? handleMouseMove : undefined}
    >
      <svg
        viewBox={`0 0 ${layout.viewBoxWidth} ${layout.viewBoxHeight}`}
        width="100%"
        aria-label="Interactive keyboard visualization"
        role="img"
        style={{ display: 'block', maxWidth: layout.viewBoxWidth }}
      >
        <rect x={0} y={0} width={layout.viewBoxWidth} height={layout.viewBoxHeight}
          rx={10} className="fill-transparent" />
        {layout.rows.map((rowDef) => (
          <Row key={rowDef.id} rowDef={rowDef} />
        ))}
      </svg>

      {/* ── Heatmap tooltip overlay ──────────────────────────────────────────
           Rendered as HTML outside SVG so it can use backdrop-blur / z-index.
           pointer-events:none prevents it from swallowing mouse events meant
           for the SVG keys underneath. z-index:100 ensures no stacking buries it. */}
      {heatmapEnabled && hoveredKeyId && (
        <div
          style={{
            position:      'absolute',
            left:          Math.min(mousePos.x + 14, (wrapperRef.current?.offsetWidth ?? 999) - 160),
            top:           mousePos.y - 10,
            pointerEvents: 'none',
            zIndex:        100,
          }}
          className="glass rounded-xl px-3 py-2 text-xs font-mono
                     border border-violet/20 shadow-lg"
        >
          <div className="font-bold mb-1" style={{ color: '#e2e8f0' }}>
            {hoveredDef?.display ?? hoveredKeyId}
          </div>
          {hoveredKd ? (
            <div className="flex flex-col gap-0.5" style={{ color: '#6b7280' }}>
              <span>
                Error rate:{' '}
                <span style={{ color: hoveredKd.errorRate > 0.1 ? '#f87171' : '#fbbf24' }}>
                  {(hoveredKd.errorRate * 100).toFixed(1)}%
                </span>
              </span>
              <span>
                Avg latency:{' '}
                <span style={{ color: '#a78bfa' }}>{Math.round(hoveredKd.avgLatencyMs)}ms</span>
              </span>
              <span>
                Samples:{' '}
                <span style={{ color: '#e2e8f0' }}>{hoveredKd.sampleCount}</span>
              </span>
            </div>
          ) : (
            <div style={{ color: '#3d3d5c' }}>no data yet</div>
          )}
        </div>
      )}

      {/* controlsSlot=null → suppress; controlsSlot=undefined → default */}
      {controlsSlot === null ? null : (controlsSlot ?? defaultControls)}
    </div>
  );
}
