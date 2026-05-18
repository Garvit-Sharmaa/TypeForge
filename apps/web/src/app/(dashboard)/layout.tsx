'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore, selectUser } from '@/store/userStore';
import { RANK_COLORS } from '@typing-master/shared';
import type { UserRank } from '@typing-master/shared';

const NAV_LINKS = [
  { href: '/practice',  label: 'arena',   icon: '⌨' },
  { href: '/learn',     label: 'academy', icon: '🎓' },
  { href: '/dashboard', label: 'stats',   icon: '📊' },
] as const;

function NavHeader() {
  const { logout, isAuthenticated } = useAuth();
  const user    = useUserStore(selectUser);
  const path    = usePathname();

  return (
    <header className="border-b border-surface-2 px-6 py-3 flex items-center justify-between
                       backdrop-blur-sm sticky top-0 z-30 bg-surface/80">
      {/* Logo */}
      <Link href="/" className="font-mono text-violet-light font-bold tracking-tight text-lg shrink-0">
        typing<span className="text-correct">master</span>
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
  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <NavHeader />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
