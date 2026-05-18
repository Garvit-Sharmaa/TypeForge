import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware — runs on every request before rendering.
 *
 * Strategy: Token presence check only (we cannot verify JWT in edge runtime
 * without importing a library). Real auth verification happens in each
 * server component / API route via requireAuth middleware.
 *
 * Protected routes: /dashboard, /practice, /profile, /achievements, /leaderboard
 * Public routes:    /, /login, /register
 */

const PROTECTED_PATHS = ['/dashboard', '/practice', '/profile', '/achievements', '/leaderboard'];
const AUTH_PATHS = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for stored auth token (set by client-side Zustand persist)
  // We use a lightweight presence check — not full JWT verification
  const tmUserCookie = request.cookies.get('accessToken')?.value;
  const isLoggedIn = !!tmUserCookie;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // Redirect unauthenticated users away from protected routes
  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/register
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
