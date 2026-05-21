'use client';
/**
 * ThemeProvider.tsx — Thin wrapper around next-themes ThemeProvider.
 *
 * Marked `use client` because next-themes uses React context and hooks
 * internally. The wrapper pattern lets us import it from the server-side
 * RootLayout without converting layout.tsx to a client component.
 */

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps }              from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
