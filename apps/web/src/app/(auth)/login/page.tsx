'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import type { Metadata } from 'next';

// ── Input component ───────────────────────────────────────────────────────────
function AuthInput({
  id, label, type, value, onChange, placeholder, autoComplete,
}: {
  id: string; label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string; autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="stat-label text-left pl-1">{label}</label>
      <input
        id={id} type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full bg-surface-2 border border-surface-3 hover:border-violet/40
                   focus:border-violet-light focus:ring-1 focus:ring-violet/30
                   rounded-xl px-4 py-3 font-mono text-sm text-correct placeholder:text-untyped
                   outline-none transition-all duration-150"
      />
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      // instanceof can be flaky during HMR or across chunks; use name or fallback to message
      const isApiError = err instanceof ApiError || err?.name === 'ApiError';
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch');
      
      if (isApiError) {
        setError(err.message);
      } else if (isNetworkError) {
        setError('Network Error: Cannot reach the Keystra server. Please try again.');
      } else {
        setError(err?.message || 'Login failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-8 flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-correct">Welcome back</h1>
        <p className="text-muted text-sm">Sign in to track your progress and compete.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthInput id="email" label="Email" type="email" value={email}
          onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
        <AuthInput id="password" label="Password" type="password" value={password}
          onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />

        {error && (
          <div className="bg-incorrect/10 border border-incorrect/30 text-incorrect
                          text-sm px-4 py-2.5 rounded-xl font-mono" role="alert">
            {error}
          </div>
        )}

        <button
          id="login-submit"
          type="submit"
          disabled={loading || !email || !password}
          className="mt-2 w-full bg-violet hover:bg-violet/85 disabled:opacity-50
                     disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl
                     transition-all duration-150 active:scale-[0.98] font-mono
                     flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30
                               border-t-white rounded-full animate-spin" />
              Signing in…
            </>
          ) : 'Sign in →'}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-surface-3" />
        <span className="text-untyped text-xs font-mono">or</span>
        <div className="flex-1 h-px bg-surface-3" />
      </div>

      {/* OAuth placeholders */}
      <div className="flex gap-3">
        {[
          { label: 'Google', icon: 'G' },
          { label: 'GitHub', icon: '⌥' },
        ].map(({ label, icon }) => (
          <button
            key={label}
            id={`oauth-${label.toLowerCase()}`}
            disabled
            title="OAuth coming soon"
            className="flex-1 flex items-center justify-center gap-2 bg-surface-2
                       border border-surface-3 text-muted text-sm font-mono py-2.5 rounded-xl
                       opacity-50 cursor-not-allowed"
          >
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      <p className="text-center text-sm text-muted">
        No account?{' '}
        <Link href="/register" className="text-violet-light hover:text-correct
                                          transition-colors underline underline-offset-2">
          Create one →
        </Link>
      </p>
    </div>
  );
}
