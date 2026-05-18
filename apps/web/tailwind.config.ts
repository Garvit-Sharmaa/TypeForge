import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Core surface palette
        surface: {
          DEFAULT: '#0d0d14',
          1: '#13131f',
          2: '#1a1a2e',
          3: '#22223b',
        },
        // Brand
        violet: {
          DEFAULT: '#7c3aed',
          light:   '#a78bfa',
          dim:     '#4c1d95',
        },
        // Typing states
        correct:   '#e2e8f0',
        incorrect: '#f87171',
        untyped:   '#3d3d5c',
        caret:     '#a78bfa',
        // Status
        success:   '#34d399',
        warning:   '#fbbf24',
        error:     '#f87171',
        muted:     '#6b7280',
      },
      animation: {
        'blink':        'blink 1.1s ease-in-out infinite',
        'slide-up':     'slideUp 0.3s ease-out',
        'fade-in':      'fadeIn 0.2s ease-out',
        'scale-in':     'scaleIn 0.15s ease-out',
        'pulse-glow':   'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        slideUp: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to:   { transform: 'scale(1)',    opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(167, 139, 250, 0)' },
          '50%':      { boxShadow: '0 0 20px 4px rgba(167, 139, 250, 0.25)' },
        },
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.3)',
        'glow':  '0 0 20px rgba(124, 58, 237, 0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
