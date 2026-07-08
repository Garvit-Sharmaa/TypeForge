'use client';
import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import {
  useKeyboardStore, selectKeyState, selectHeatmapEnabled,
  selectHeatmapData, selectShowFingerColors, selectHeatmapMode,
} from '@/store/keyboardStore';
import { FINGER_COLORS } from '@typing-master/shared';
import type { KeyDefinition } from '@typing-master/shared';

// No hardcoded finger dark tints anymore. The finger color will be indicated by the bottom bar.

// ── Priority fill colours (live typing mode) ──────────────────────────────────
const PRIORITY_FILL = {
  target:    'var(--violet-dim)', // Uses the theme's dim violet
  pressed:   'var(--violet)',     // Uses the theme's solid violet
  incorrect: 'var(--incorrect)',
};

// ── Color scale helpers ───────────────────────────────────────────────────────
function getLuminance(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function parseRgb(color: string) {
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }
  const match = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (match) {
    return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
  }
  return { r: 0, g: 0, b: 0 };
}

function getContrastColor(fillColor: string | undefined) {
  if (!fillColor) return undefined;
  const { r, g, b } = parseRgb(fillColor);
  return getLuminance(r, g, b) > 0.5 ? '#0f172a' : '#ffffff'; // slate-900 or white
}
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
  const setHoveredKey    = useKeyboardStore((s) => s.setHoveredKey);

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

  const dynamicFill: string | undefined = (() => {
    // Heatmap mode: completely overrides live state colour
    if (heatmapEnabled && kd) {
      return heatmapMode === 'speed'
        ? speedFill(kd.avgLatencyMs, kd.sampleCount)
        : accuracyFill(kd.errorRate, kd.sampleCount);
    }
    if (heatmapEnabled) return undefined; // Let CSS handle empty heatmap key

    // Live typing mode: priority-driven colours
    if (priority === 'incorrect') return PRIORITY_FILL.incorrect;
    if (priority === 'pressed')   return PRIORITY_FILL.pressed;
    if (priority === 'target')    return PRIORITY_FILL.target;

    return undefined; // Let Tailwind classes handle idle state
  })();

  // Stroke colours
  let strokeColor: string | undefined = undefined;
  let strokeClassName = "";
  
  if (priority === 'incorrect') strokeColor = 'var(--incorrect)';
  else if (priority === 'target') strokeColor = 'var(--violet)';
  else if (priority === 'pressed') strokeColor = 'var(--violet)';
  else if (heatmapEnabled) strokeColor = 'rgba(0,0,0,0.1)';
  else {
    // Idle state - use Tailwind classes
    strokeClassName = "stroke-surface-3 dark:stroke-surface-2";
  }

  const strokeWidth = priority === 'target' ? 1.5 : 1;

  let labelColor: string | undefined = undefined;
  let labelClassName = "";

  if (heatmapEnabled && kd) {
    labelColor = getContrastColor(dynamicFill);
  } else if (priority === 'incorrect') {
    labelColor = '#FFFFFF';
  } else if (heatmapEnabled) {
    labelColor = 'var(--untyped)';
  } else if (priority === 'idle') {
    labelClassName = isModifier 
      ? "fill-untyped" 
      : "fill-correct";
  } else {
    labelColor = '#FFFFFF'; // target/pressed
  }

  const fontSize = width > 80 ? 10 : width > 60 ? 11 : 12;

  // Centre the group so scale/shake animate from the key's midpoint
  const cx = x + width  / 2;
  const cy = y + height / 2;
  const hw = width  / 2;
  const hh = height / 2;

  // In heatmap mode: suppress live animations so the keyboard is static
  const isHeatmapStatic = heatmapEnabled;

  return (
    <g
      transform={`translate(${cx},${cy})`}
      role="img"
      aria-label={display}
      // Hover events: only active in heatmap mode (zero overhead during live typing)
      onMouseEnter={
        heatmapEnabled
          ? () => {
              console.log('[DEBUG] Hit Key:', id, 'display:', display);
              setHoveredKey(id);
            }
          : undefined
      }
      onMouseLeave={heatmapEnabled ? () => setHoveredKey(null) : undefined}
      style={heatmapEnabled ? { cursor: 'crosshair' } : undefined}
    >
      <motion.g
        animate={isHeatmapStatic ? undefined : controls}
        style={{ originX: 0, originY: 0 }}
      >
        {/* Key body */}
        <motion.rect
          x={-hw} y={-hh} width={width} height={height} rx={rx}
          className={
            dynamicFill 
              ? strokeClassName 
              : `fill-surface-1 drop-shadow-sm hover:fill-surface-2 ${strokeClassName}`
          }
          animate={{ fill: dynamicFill || "" }}
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
          className={labelClassName}
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
