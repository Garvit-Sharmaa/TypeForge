'use client';
import React, { useEffect } from 'react';
import {
  useKeyboardStore, selectLayout,
  selectHeatmapEnabled, selectShowFingerColors,
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
    <div className={className}>
      <svg
        viewBox={`0 0 ${layout.viewBoxWidth} ${layout.viewBoxHeight}`}
        width="100%"
        aria-label="Interactive keyboard visualization"
        role="img"
        style={{ display: 'block', maxWidth: layout.viewBoxWidth }}
      >
        <rect x={0} y={0} width={layout.viewBoxWidth} height={layout.viewBoxHeight}
          rx={10} fill="#13131f" />
        {layout.rows.map((rowDef) => (
          <Row key={rowDef.id} rowDef={rowDef} />
        ))}
      </svg>

      {/* controlsSlot=null → suppress; controlsSlot=undefined → default */}
      {controlsSlot === null ? null : (controlsSlot ?? defaultControls)}
    </div>
  );
}
