'use client';
import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import {
  useKeyboardStore, selectKeyState, selectHeatmapEnabled,
  selectHeatmapData, selectShowFingerColors, selectHeatmapMode,
} from '@/store/keyboardStore';
import { FINGER_COLORS } from '@typing-master/shared';
import type { KeyDefinition } from '@typing-master/shared';

// ── Subtle dark finger tints for idle keys ────────────────────────────────────
const FINGER_FILL_DARK: Record<string, string> = {
  'left-pinky':   '#2a1520',
  'left-ring':    '#251a0d',
  'left-middle':  '#25230d',
  'left-index':   '#0d2010',
  'left-thumb':   '#0d1825',
  'right-thumb':  '#0d1825',
  'right-index':  '#0d2010',
  'right-middle': '#25230d',
  'right-ring':   '#251a0d',
  'right-pinky':  '#2a1520',
};

// ── Priority fill colours (live typing mode) ──────────────────────────────────
const PRIORITY_FILL = {
  target:    '#2a1f4a',
  pressed:   '#3d2d6e',
  incorrect: '#3a1010',
};

// ── Color scale helpers ───────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * Math.min(1, Math.max(0, t)));
}

/**
 * Accuracy heatmap: errorRate 0→1
 * 0%  = neutral surface  #1a1a2e
 * 5%  = subtle amber     #3d2800
 * 15% = strong red       #501010
 * 25%+ = deep red        #6b0c0c
 */
function accuracyFill(errorRate: number, sampleCount: number): string {
  if (sampleCount < 3) return '#1e1e36'; // not enough data — slight tint
  if (errorRate <= 0)  return '#0d2a18'; // perfect → green
  if (errorRate < 0.05)
    return `rgb(${lerp(13,61,errorRate/0.05)},${lerp(42,40,errorRate/0.05)},${lerp(24,0,errorRate/0.05)})`;
  if (errorRate < 0.15)
    return `rgb(${lerp(61,80,(errorRate-0.05)/0.10)},${lerp(40,20,(errorRate-0.05)/0.10)},0)`;
  if (errorRate < 0.30)
    return `rgb(${lerp(80,107,(errorRate-0.15)/0.15)},${lerp(20,12,(errorRate-0.15)/0.15)},0)`;
  return '#6b0c0c';
}

/**
 * Speed heatmap: avgLatencyMs
 *  <80ms  = green  (fast)
 *  120ms  = yellow
 *  200ms  = orange
 *  >300ms = red    (slow)
 */
function speedFill(avgMs: number, sampleCount: number): string {
  if (sampleCount < 3 || avgMs <= 0) return '#1e1e36';
  if (avgMs < 80)
    return `rgb(${lerp(13,30,avgMs/80)},${lerp(42,38,avgMs/80)},${lerp(24,8,avgMs/80)})`;
  if (avgMs < 150)
    return `rgb(${lerp(30,65,(avgMs-80)/70)},${lerp(38,38,(avgMs-80)/70)},${lerp(8,0,(avgMs-80)/70)})`;
  if (avgMs < 250)
    return `rgb(${lerp(65,90,(avgMs-150)/100)},${lerp(38,18,(avgMs-150)/100)},0)`;
  if (avgMs < 350)
    return `rgb(${lerp(90,107,(avgMs-250)/100)},${lerp(18,10,(avgMs-250)/100)},0)`;
  return '#6b0c0c';
}

interface KeyProps { keyDef: KeyDefinition }

export const Key = React.memo(function Key({ keyDef }: KeyProps) {
  const { id, x, y, width, height, display, finger, isModifier } = keyDef;
  const rx = keyDef.rx ?? 6;

  // Fine-grained per-key subscription
  const { priority, pressedAt, errorAt } = useKeyboardStore(selectKeyState(id));
  const heatmapEnabled   = useKeyboardStore(selectHeatmapEnabled);
  const heatmapMode      = useKeyboardStore(selectHeatmapMode);
  const heatmapData      = useKeyboardStore(selectHeatmapData);
  const showFingerColors = useKeyboardStore(selectShowFingerColors);

  const controls  = useAnimation();
  const prevPress = useRef<number | null>(null);

  // ── Re-trigger animations on each new timestamp ───────────────────────────
  useEffect(() => {
    if (pressedAt === null || pressedAt === prevPress.current) return;
    prevPress.current = pressedAt;

    if (priority === 'incorrect') {
      controls.start({
        x: [0, -3, 3, -3, 2, -2, 0],
        scale: [1, 0.93, 0.93, 0.93, 0.93, 0.93, 1],
        transition: { duration: 0.28, ease: 'easeOut' },
      });
    } else {
      controls.start({
        scale: [1, 0.91, 1],
        transition: { duration: 0.12, ease: 'easeOut' },
      });
    }
  }, [pressedAt, priority, controls]);

  // ── Breathing animation while targeted ───────────────────────────────────
  useEffect(() => {
    if (priority === 'target') {
      controls.start({
        scale: [1, 1.04, 1],
        transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
      });
    } else if (priority === 'idle') {
      controls.stop();
      controls.set({ scale: 1, x: 0 });
    }
  }, [priority, controls]);

  // ── Fill colour resolution ────────────────────────────────────────────────
  const kd = heatmapData[id];

  const fillColor: string = (() => {
    // Heatmap mode: completely overrides live state colour
    if (heatmapEnabled && kd) {
      return heatmapMode === 'speed'
        ? speedFill(kd.avgLatencyMs, kd.sampleCount)
        : accuracyFill(kd.errorRate, kd.sampleCount);
    }
    if (heatmapEnabled) return '#1e1e36'; // no data for this key

    // Live typing mode: priority-driven colours
    if (priority === 'incorrect') return PRIORITY_FILL.incorrect;
    if (priority === 'pressed')   return PRIORITY_FILL.pressed;
    if (priority === 'target')    return PRIORITY_FILL.target;

    return showFingerColors
      ? (FINGER_FILL_DARK[finger] ?? '#1a1a2e')
      : '#1a1a2e';
  })();

  // Stroke & label colours
  const strokeColor =
    priority === 'incorrect' ? '#f87171' :
    priority === 'target'    ? '#7c3aed' :
    priority === 'pressed'   ? '#a78bfa' :
    heatmapEnabled           ? 'rgba(255,255,255,0.04)' :
                               'rgba(255,255,255,0.06)';

  const strokeWidth = priority === 'target' ? 1.5 : 1;

  const labelColor =
    priority === 'incorrect' ? '#f87171' :
    priority === 'idle'      ? (isModifier ? '#3a3a5c' : '#5a5a7a') :
    heatmapEnabled           ? '#9090b0' :
    '#e2e8f0';

  const fontSize = width > 80 ? 10 : width > 60 ? 11 : 12;

  // Centre the group so scale/shake animate from the key's midpoint
  const cx = x + width  / 2;
  const cy = y + height / 2;
  const hw = width  / 2;
  const hh = height / 2;

  // In heatmap mode: suppress live animations so the keyboard is static
  const isHeatmapStatic = heatmapEnabled;

  return (
    <g transform={`translate(${cx},${cy})`} role="img" aria-label={display}>
      <motion.g
        animate={isHeatmapStatic ? undefined : controls}
        style={{ originX: 0, originY: 0 }}
      >
        {/* Key body */}
        <motion.rect
          x={-hw} y={-hh} width={width} height={height} rx={rx}
          animate={{ fill: fillColor }}
          transition={{ duration: isHeatmapStatic ? 0.35 : 0.09 }}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />

        {/* Live mode: target glow pulse */}
        {!isHeatmapStatic && priority === 'target' && (
          <motion.rect
            x={-hw} y={-hh} width={width} height={height} rx={rx}
            fill="#7c3aed"
            animate={{ opacity: [0, 0.18, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Live mode: incorrect flash */}
        {!isHeatmapStatic && priority === 'incorrect' && (
          <motion.rect
            x={-hw} y={-hh} width={width} height={height} rx={rx}
            fill="#f87171"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Heatmap mode: intensity bar at bottom edge */}
        {isHeatmapStatic && kd && kd.sampleCount >= 3 && (
          <rect
            x={-hw + 3} y={hh - 4} width={width - 6} height={3} rx={1.5}
            fill={
              heatmapMode === 'speed'
                ? speedFill(kd.avgLatencyMs, kd.sampleCount)
                : accuracyFill(kd.errorRate, kd.sampleCount)
            }
            opacity={0.9}
            style={{ pointerEvents: 'none' }}
            // Brighter bar to indicate the magnitude
            filter="brightness(2)"
          />
        )}

        {/* Finger colour indicator bar (live mode only) */}
        {!isHeatmapStatic && showFingerColors && (
          <rect
            x={-hw + 4} y={hh - 4} width={width - 8} height={3} rx={1.5}
            fill={FINGER_COLORS[finger as keyof typeof FINGER_COLORS]}
            opacity={0.6}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Primary label */}
        <text
          textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize}
          fill={labelColor}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="500"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {display}
        </text>

        {/* Heatmap tooltip data (small, below label) */}
        {isHeatmapStatic && kd && kd.sampleCount >= 3 && width >= 44 && (
          <text
            textAnchor="middle" y={hh - 9}
            fontSize={7}
            fill={labelColor}
            fontFamily="'JetBrains Mono', monospace"
            opacity={0.7}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {heatmapMode === 'speed'
              ? `${Math.round(kd.avgLatencyMs)}ms`
              : `${Math.round(kd.errorRate * 100)}%`}
          </text>
        )}

        {/* Shift legend (idle live mode only) */}
        {!isHeatmapStatic && keyDef.displayShift && priority === 'idle' && (
          <text
            x={-hw + 5} y={-hh + 9}
            fontSize={8}
            fill="#3a3a5c"
            fontFamily="'JetBrains Mono', monospace"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {keyDef.displayShift}
          </text>
        )}
      </motion.g>
    </g>
  );
});
