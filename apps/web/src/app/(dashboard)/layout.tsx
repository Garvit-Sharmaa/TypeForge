'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore, selectUser } from '@/store/userStore';
import { RANK_COLORS } from '@typing-master/shared';
import type { UserRank } from '@typing-master/shared';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV_LINKS = [
  { href: '/practice', label: 'arena', icon: '⌨' },
  { href: '/learn', label: 'academy', icon: '🎓' },
  { href: '/dashboard', label: 'stats', icon: '📊' },
] as const;

function NavHeader() {
  const { logout, isAuthenticated } = useAuth();
  const user = useUserStore(selectUser);
  const path = usePathname();

  return (
    <header className="border-b border-surface-2 px-6 py-3 flex items-center justify-between
                       backdrop-blur-sm sticky top-0 z-30 bg-surface/80">
      {/* Logo */}
      <Link href="/" className="font-mono text-violet-light font-bold tracking-tight text-lg shrink-0">
        Type<span className="text-correct">Forge</span>
      </Link>

      {/* Primary nav */}
      <nav className="flex items-center gap-1 bg-surface-2 border border-surface-3
                      rounded-xl p-1 font-mono text-sm">
        {NAV_LINKS.map(({ href, label, icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              id={`nav-${label}`}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg
                          transition-all duration-150 text-xs
                          ${active
                  ? 'bg-violet/20 text-violet-light border border-violet/30'
                  : 'text-untyped hover:text-muted hover:bg-surface-3'}`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Theme toggle — always visible, before auth controls */}
        <ThemeToggle />

        {isAuthenticated && user ? (
          <>
            {/* XP rank dot + username */}
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: RANK_COLORS[user.rank as UserRank] ?? '#a78bfa',
                  boxShadow: `0 0 6px ${RANK_COLORS[user.rank as UserRank] ?? '#a78bfa'}80`,
                }}
              />
              <span className="font-mono text-sm text-correct font-semibold">{user.username}</span>
            </div>
            <button
              onClick={logout}
              id="logout-btn"
              className="text-[11px] font-mono text-untyped hover:text-incorrect
                         transition-colors border border-surface-3 px-2 py-1 rounded-md"
            >
              logout
            </button>
          </>
        ) : (
          <Link href="/login"
            className="font-mono text-xs bg-violet/20 border border-violet/30 text-violet-light
                       px-3 py-1.5 rounded-lg hover:bg-violet/30 transition-all duration-150">
            sign in
          </Link>
        )}
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isHydrated = useUserStore((s) => s.isHydrated);

  // ── Pre-hydration gate ────────────────────────────────────────────────
  // Zustand reads localStorage asynchronously after the first render. Until
  // isHydrated flips to true (~10ms), the store has user=null and tokens=null.
  // Without this guard, any component that reads `isAuthenticated` will briefly
  // see "false" and may redirect to /login or show a "sign in" button even for
  // authenticated users — the classic "auth flicker".
  //
  // We render a full-screen spinner instead of the layout shell. The spinner
  // is identical to the one used in individual page Suspense fallbacks, so the
  // user sees a single, consistent loading state that resolves in <100ms.
  if (!isHydrated) {
    return (
      <div className="min-h-dvh bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-violet/40 border-t-violet animate-spin" />
          <span className="text-[11px] font-mono text-untyped/60">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <NavHeader />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
