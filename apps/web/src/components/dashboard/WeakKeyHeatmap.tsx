'use client';
/**
 * WeakKeyHeatmap — Canvas-rendered QWERTY keyboard heatmap.
 *
 * WHY CANVAS and not React DOM nodes?
 *   • 47 keys × styled divs = 47 React nodes, each with event handlers,
 *     style recalculations, and layout reflows.
 *   • Canvas: a single <canvas> element. Rendering is pure pixel operations.
 *     No layout reflows. Tooltip handled via mousemove on the single element.
 *   • This is 10-50× faster than the DOM approach for this use case.
 *
 * Color encoding:
 *   error_rate = 0%        → #1a1a2e  (surface, no highlight)
 *   error_rate = 5–15%     → interpolate surface → amber
 *   error_rate > 15%       → interpolate amber → red
 */

'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';

// ── QWERTY layout definition ──────────────────────────────────────────────────
const KEY_SIZE = 44;
const KEY_GAP  = 5;
const UNIT     = KEY_SIZE + KEY_GAP;

interface KeyDef { char: string; w: number; } // w in UNIT multiples

const ROWS: KeyDef[][] = [
  ['`','1','2','3','4','5','6','7','8','9','0','-','='].map((c) => ({ char: c, w: 1 })),
  [{ char: 'q', w: 1 },{ char: 'w', w: 1 },{ char: 'e', w: 1 },{ char: 'r', w: 1 },
   { char: 't', w: 1 },{ char: 'y', w: 1 },{ char: 'u', w: 1 },{ char: 'i', w: 1 },
   { char: 'o', w: 1 },{ char: 'p', w: 1 },{ char: '[', w: 1 },{ char: ']', w: 1 }],
  [{ char: 'a', w: 1 },{ char: 's', w: 1 },{ char: 'd', w: 1 },{ char: 'f', w: 1 },
   { char: 'g', w: 1 },{ char: 'h', w: 1 },{ char: 'j', w: 1 },{ char: 'k', w: 1 },
   { char: 'l', w: 1 },{ char: ';', w: 1 },{ char: "'", w: 1 }],
  [{ char: 'z', w: 1 },{ char: 'x', w: 1 },{ char: 'c', w: 1 },{ char: 'v', w: 1 },
   { char: 'b', w: 1 },{ char: 'n', w: 1 },{ char: 'm', w: 1 },{ char: ',', w: 1 },
   { char: '.', w: 1 },{ char: '/', w: 1 }],
  [{ char: ' ', w: 6 }], // spacebar (display: ⎵)
];

// Row x-offsets (QWERTY stagger)
const ROW_OFFSETS = [0, 0.5, 0.75, 1.25, 3.75];

// Pre-compute key positions for hit-testing and rendering
interface KeyRect { char: string; x: number; y: number; w: number; h: number; }

function buildKeyRects(): KeyRect[] {
  const rects: KeyRect[] = [];
  const PAD_X = 10;
  const PAD_Y = 10;

  ROWS.forEach((row, rowIdx) => {
    let x = PAD_X + ROW_OFFSETS[rowIdx] * UNIT;
    const y = PAD_Y + rowIdx * UNIT;
    for (const key of row) {
      const w = key.w * UNIT - KEY_GAP;
      rects.push({ char: key.char, x, y, w, h: KEY_SIZE });
      x += key.w * UNIT;
    }
  });
  return rects;
}

const KEY_RECTS = buildKeyRects();
const CANVAS_W  = 14 * UNIT + 20;
const CANVAS_H  = 5  * UNIT + 20;

// ── Color interpolation ───────────────────────────────────────────────────────
function lerpColor(a: [number,number,number], b: [number,number,number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bv= Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bv})`;
}

const C_BASE:   [number,number,number] = [26,  26,  46 ]; // #1a1a2e
const C_AMBER:  [number,number,number] = [120, 80,  0  ]; // dark amber
const C_RED:    [number,number,number] = [120, 30,  30 ]; // dark red

function errorRateToColor(rate: number): string {
  if (rate <= 0)    return `rgb(${C_BASE.join(',')})`;
  if (rate < 0.05)  return lerpColor(C_BASE,  C_AMBER, rate / 0.05);
  if (rate < 0.20)  return lerpColor(C_AMBER, C_RED,   (rate - 0.05) / 0.15);
  return `rgb(${C_RED.join(',')})`;
}

function errorRateToTextColor(rate: number): string {
  if (rate > 0.10) return '#f87171'; // red
  if (rate > 0.04) return '#fbbf24'; // amber
  return '#6b7280';                   // muted
}

// ── Component ─────────────────────────────────────────────────────────────────
interface WeakKeyData {
  keyChar:      string;
  errorRate:    number;
  avgLatencyMs: number;
  sampleCount:  number;
}

interface WeakKeyHeatmapProps {
  data: WeakKeyData[];
}

interface TooltipState {
  visible: boolean;
  x: number; y: number;
  key: string;
  errorRate: number;
  avgLatencyMs: number;
  sampleCount: number;
}

const WeakKeyHeatmap = React.memo(function WeakKeyHeatmap({ data }: WeakKeyHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, key: '', errorRate: 0, avgLatencyMs: 0, sampleCount: 0 });

  // Build lookup map for O(1) key lookups during render
  const dataMap = React.useMemo(() => {
    const m = new Map<string, WeakKeyData>();
    data.forEach((d) => m.set(d.keyChar.toLowerCase(), d));
    return m;
  }, [data]);

  // ── Canvas draw ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width  = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    for (const rect of KEY_RECTS) {
      const kd        = dataMap.get(rect.char);
      const errorRate = kd?.errorRate ?? 0;
      const bgColor   = errorRateToColor(errorRate);
      const txtColor  = kd ? errorRateToTextColor(errorRate) : '#4a4a6a';
      const r         = 6; // border radius

      // Key background
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, r);
      ctx.fillStyle = bgColor;
      ctx.fill();

      // Key border
      ctx.strokeStyle = errorRate > 0.04
        ? `rgba(248,113,113,${Math.min(errorRate * 3, 0.5)})`
        : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Key label
      const label = rect.char === ' ' ? '⎵' : rect.char.toUpperCase();
      ctx.fillStyle   = txtColor;
      ctx.font        = `500 ${rect.w > KEY_SIZE * 2 ? '13' : '12'}px "JetBrains Mono", monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);

      // Error rate mini-label (only if significant)
      if (kd && errorRate > 0.03) {
        ctx.fillStyle   = `rgba(248,113,113,${Math.min(0.9, errorRate * 5)})`;
        ctx.font        = '9px "JetBrains Mono", monospace';
        ctx.textBaseline= 'alphabetic';
        ctx.fillText(
          `${Math.round(errorRate * 100)}%`,
          rect.x + rect.w / 2,
          rect.y + rect.h - 5,
        );
      }
    }
  }, [dataMap]);

  useEffect(() => { draw(); }, [draw]);

  // ── Mouse hit test ──────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const key of KEY_RECTS) {
      if (mx >= key.x && mx <= key.x + key.w && my >= key.y && my <= key.y + key.h) {
        const kd = dataMap.get(key.char);
        setTooltip({
          visible: true,
          x: e.clientX - rect.left + 12,
          y: e.clientY - rect.top  - 10,
          key: key.char === ' ' ? 'Space' : key.char.toUpperCase(),
          errorRate:    kd?.errorRate    ?? 0,
          avgLatencyMs: kd?.avgLatencyMs ?? 0,
          sampleCount:  kd?.sampleCount  ?? 0,
        });
        return;
      }
    }
    setTooltip((t) => ({ ...t, visible: false }));
  }, [dataMap]);

  const handleMouseLeave = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }));
  }, []);

  return (
    <div ref={containerRef} className="relative" style={{ width: CANVAS_W, maxWidth: '100%' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair"
        aria-label="Keyboard heatmap showing typing error rates per key"
        role="img"
      />

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="pointer-events-none absolute z-20 glass rounded-xl px-3 py-2
                     text-xs font-mono border border-violet/20 shadow-glass"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-bold text-correct mb-1">{tooltip.key}</div>
          <div className="flex flex-col gap-0.5 text-muted">
            <span>
              Error rate:{' '}
              <span className={tooltip.errorRate > 0.1 ? 'text-incorrect' : 'text-warning'}>
                {(tooltip.errorRate * 100).toFixed(1)}%
              </span>
            </span>
            <span>Avg latency: <span className="text-violet-light">{Math.round(tooltip.avgLatencyMs)}ms</span></span>
            <span>Samples: {tooltip.sampleCount}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 px-2">
        <span className="text-[10px] text-untyped font-mono">Error rate:</span>
        {[
          { label: '0%',  color: `rgb(${C_BASE.join(',')})` },
          { label: '5%',  color: lerpColor(C_BASE, C_AMBER, 1) },
          { label: '10%', color: lerpColor(C_AMBER, C_RED, 0.33) },
          { label: '20%+',color: `rgb(${C_RED.join(',')})` },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: color, border: '1px solid rgba(255,255,255,0.1)' }} />
            <span className="text-[10px] text-muted font-mono">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

WeakKeyHeatmap.displayName = 'WeakKeyHeatmap';
export default WeakKeyHeatmap;
