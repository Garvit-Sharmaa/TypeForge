'use client';
/**
 * ChapterRow.tsx — A single chapter line within a LessonAccordion.
 *
 * Visual states:
 *   completed  — green check, muted text, no CTA
 *   active     — bright text, "Start" button, pulsing left border on test type
 *   locked     — dim, no interaction (when entire lesson is locked)
 *
 * Type-specific appearance:
 *   tutorial  → BookOpen icon, slate accent
 *   drill     → Zap icon, violet accent
 *   game      → Gamepad2 icon, amber accent
 *   test      → Sword icon, rose/amber gradient border + "⚔ Boss" badge
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Zap, Gamepad2, Sword,
  CheckCircle2, Clock, ChevronRight,
} from 'lucide-react';
import type { Chapter, ChapterType } from '@typing-master/shared';

// ─── Chapter type meta ────────────────────────────────────────────────────────

const TYPE_META: Record<ChapterType, {
  icon:        React.ReactNode;
  accent:      string;
  bg:          string;
  border:      string;
}> = {
  tutorial: {
    icon:   <BookOpen size={14} strokeWidth={2} />,
    accent: 'text-slate-400',
    bg:     'bg-slate-500/8',
    border: 'border-slate-500/20',
  },
  drill: {
    icon:   <Zap size={14} strokeWidth={2} />,
    accent: 'text-violet-light',
    bg:     'bg-violet/8',
    border: 'border-violet/20',
  },
  game: {
    icon:   <Gamepad2 size={14} strokeWidth={2} />,
    accent: 'text-amber-400',
    bg:     'bg-amber-500/8',
    border: 'border-amber-500/20',
  },
  test: {
    icon:   <Sword size={14} strokeWidth={2} />,
    accent: 'text-rose-400',
    bg:     'bg-rose-500/8',
    border: 'border-rose-500/20',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ChapterRowProps {
  chapter:     Chapter;
  index:       number;
  isLocked:    boolean;   // entire lesson is locked
  isStarting:  boolean;   // this chapter is currently being launched
  onStart:     (chapter: Chapter) => void;
}

const ChapterRow = memo(function ChapterRow({
  chapter,
  index,
  isLocked,
  isStarting,
  onStart,
}: ChapterRowProps) {
  const m       = TYPE_META[chapter.type];
  const isTest  = chapter.type === 'test';
  const isDone  = chapter.isCompleted;
  const canAct  = !isLocked && !isDone;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0  }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      id={`chapter-row-${chapter.id}`}
      className={[
        'relative flex items-center gap-3 px-4 py-3 rounded-xl',
        'border transition-all duration-200',
        // Final Boss gradient border
        isTest && !isDone && !isLocked
          ? 'border-rose-500/30 bg-gradient-to-r from-rose-500/8 via-amber-500/5 to-transparent'
          : isDone
            // Completed: green-tinted with soft glow
            ? 'border-correct/20 bg-correct/5 shadow-[0_0_12px_rgba(52,211,153,0.06)]'
            : 'border-surface-3/50 bg-surface-2/50',
        isLocked ? 'opacity-40' : '',
        canAct   ? 'cursor-pointer hover:border-surface-3 hover:bg-surface-2/80 group' : '',
      ].join(' ')}
      onClick={canAct && !isStarting ? () => onStart(chapter) : undefined}
    >
      {/* Left: chapter number */}
      <span className="shrink-0 w-8 text-[10px] font-mono text-untyped text-right select-none">
        {chapter.id}
      </span>

      {/* Vertical divider */}
      <div className="shrink-0 w-px h-6 bg-surface-3/60" />

      {/* Type icon */}
      <span className={`shrink-0 ${isDone ? 'text-correct/40' : m.accent}`}>
        {isTest && !isDone ? <Sword size={14} strokeWidth={2} className="text-rose-400" /> : m.icon}
      </span>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-mono font-medium
            ${isDone ? 'text-correct/50 line-through decoration-correct/30' : 'text-correct'}
          `}>
            {chapter.title}
          </span>

          {/* Boss badge */}
          {isTest && !isDone && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full
                             bg-rose-500/15 border border-rose-500/30 text-rose-400
                             tracking-wide">
              ⚔ Final Boss
            </span>
          )}
        </div>

        {/* Time estimate */}
        <div className="flex items-center gap-1 mt-0.5">
          <Clock size={9} className="text-untyped/60" strokeWidth={2} />
          <span className="text-[9px] font-mono text-untyped/60">
            ~{chapter.estimatedMinutes} min
          </span>
          {isDone && (
            <span className="text-[9px] font-mono text-correct/60 ml-2 flex items-center gap-0.5">
              <span className="w-1 h-1 rounded-full bg-correct/60 inline-block" />
              completed
            </span>
          )}
        </div>
      </div>

      {/* Right: status / CTA */}
      <div className="shrink-0">
        {isDone ? (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <CheckCircle2 size={16} className="text-correct" strokeWidth={2} />
          </motion.div>
        ) : isLocked ? (
          <span className="text-[9px] font-mono text-untyped/40">locked</span>
        ) : isStarting ? (
          <div className="w-5 h-5 rounded-full border-2 border-violet/40
                          border-t-violet animate-spin" />
        ) : (
          <motion.span
            className={[
              'flex items-center gap-1 text-[10px] font-mono px-2.5 py-1',
              'rounded-lg border transition-all duration-150',
              isTest
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 group-hover:bg-rose-500/25'
                : 'bg-violet/15 border-violet/30 text-violet-light group-hover:bg-violet/25',
            ].join(' ')}
          >
            {isTest ? 'challenge' : 'start'}
            <ChevronRight size={10} strokeWidth={2.5} />
          </motion.span>
        )}
      </div>

      {/* Animated left accent bar for active test */}
      {isTest && !isDone && !isLocked && (
        <motion.div
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-rose-400"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
});

ChapterRow.displayName = 'ChapterRow';
export default ChapterRow;
