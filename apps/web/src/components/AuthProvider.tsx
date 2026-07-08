'use client';

import { useAuth } from '@/hooks/useAuth';

/**
 * AuthProvider globally mounts the useAuth hook.
 * 
 * This ensures that token hydration and the background refresh timer 
 * run continuously across all pages (including the public landing page). 
 * Without this, if a user sits on the landing page until their access 
 * token expires, they would be erroneously redirected to /login when 
 * trying to enter the app.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Call the hook so its internal useEffects (hydration, refresh timer) run globally
  useAuth();
  
  return <>{children}</>;
}
