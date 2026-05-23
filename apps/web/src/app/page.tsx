import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TypeForge — Adaptive Keyboard Intelligence',
};

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-surface flex flex-col items-center justify-center px-4">
      {/* Radial glow backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(124,58,237,0.18) 0%, transparent 70%)',
        }}
      />

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center gap-6 text-center max-w-2xl">
        <div className="font-mono text-5xl font-bold tracking-tight">
          <span className="text-violet-light">typing</span>
          <span className="text-correct">master</span>
        </div>

        <p className="text-muted text-lg leading-relaxed max-w-md">
          Adaptive keyboard analytics. Real-time WPM tracking, AI-powered
          weak-key detection, and personalized drills that adapt to{' '}
          <em className="text-correct not-italic">your</em> patterns.
        </p>

        <Link
          id="start-typing-btn"
          href="/practice"
          className="mt-4 inline-flex items-center gap-2 bg-violet hover:bg-violet/85
                     active:scale-95 text-white font-semibold px-8 py-3.5 rounded-xl
                     transition-all duration-150 shadow-glow"
        >
          Start Typing
          <span className="text-white/60 font-mono text-sm">→</span>
        </Link>

        {/* Feature chips */}
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {['Zero-latency engine', 'Weak key heatmap', 'XP & Rankings',
            'Daily challenges', 'Multiplayer races'].map((f) => (
              <span
                key={f}
                className="glass-subtle text-muted text-xs px-3 py-1.5 rounded-full font-mono"
              >
                {f}
              </span>
            ))}
        </div>
      </section>

      {/* Fake typing preview */}
      <div
        aria-hidden="true"
        className="relative z-10 mt-16 glass rounded-2xl px-8 py-6 font-mono text-lg
                   max-w-2xl w-full opacity-60 select-none"
      >
        <span className="text-correct">the quick brown </span>
        <span className="text-incorrect">f</span>
        <span className="text-correct">ox jumps over the </span>
        <span className="inline-block w-0.5 h-5 bg-caret animate-blink align-middle" />
        <span className="text-untyped">lazy dog</span>
      </div>
    </main>
  );
}
