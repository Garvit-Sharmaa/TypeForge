'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';

function AuthInput({
  id, label, type, value, onChange, placeholder, hint, autoComplete,
}: {
  id: string; label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  hint?: string; autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between pl-1">
        <label htmlFor={id} className="stat-label">{label}</label>
        {hint && <span className="text-[10px] text-untyped font-mono">{hint}</span>}
      </div>
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

// Password strength indicator
function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-incorrect', 'bg-warning', 'bg-yellow-400', 'bg-success'];

  if (!password) return null;
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? colors[score] : 'bg-surface-3'
            }`}
          />
        ))}
      </div>
      <span className={`text-[10px] font-mono ${score >= 3 ? 'text-success' : 'text-muted'}`}>
        {labels[score]}
      </span>
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [email,    setEmail]    = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(email, username, password);
    } catch (err: any) {
      const isApiError = err instanceof ApiError || err?.name === 'ApiError';
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch');
      
      if (isApiError) {
        setError(err.message);
      } else if (isNetworkError) {
        setError('Network Error: Cannot reach the Keystra server. Please try again.');
      } else {
        setError(err?.message || 'Registration failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-8 flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-correct">Create your account</h1>
        <p className="text-muted text-sm">Start tracking your typing intelligence today.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthInput id="reg-email" label="Email" type="email" value={email}
          onChange={setEmail} placeholder="you@example.com" autoComplete="email" />

        <AuthInput id="reg-username" label="Username" type="text" value={username}
          onChange={setUsername} placeholder="speedrunner99"
          hint="letters, numbers, - _"
          autoComplete="username" />

        <div className="flex flex-col gap-2">
          <AuthInput id="reg-password" label="Password" type="password" value={password}
            onChange={setPassword} placeholder="at least 8 characters"
            autoComplete="new-password" />
          <PasswordStrength password={password} />
        </div>

        {error && (
          <div className="bg-incorrect/10 border border-incorrect/30 text-incorrect
                          text-sm px-4 py-2.5 rounded-xl font-mono" role="alert">
            {error}
          </div>
        )}

        <button
          id="register-submit"
          type="submit"
          disabled={loading || !email || !username || password.length < 8}
          className="mt-2 w-full bg-violet hover:bg-violet/85 disabled:opacity-50
                     disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl
                     transition-all duration-150 active:scale-[0.98] font-mono
                     flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30
                               border-t-white rounded-full animate-spin" />
              Creating account…
            </>
          ) : 'Create account →'}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-light hover:text-correct
                                       transition-colors underline underline-offset-2">
          Sign in →
        </Link>
      </p>
    </div>
  );
}
