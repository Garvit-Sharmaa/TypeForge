import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider }  from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: {
    template: '%s | TypeForge',
    default: 'TypeForge — Adaptive Keyboard Intelligence',
  },
  description:
    'Master your typing speed with AI-powered analytics, personalized drills, and real-time weak-key detection. Track WPM, accuracy, and beat your personal best.',
  keywords: ['typing test', 'WPM', 'typing speed', 'keyboard analytics', 'typing practice'],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ),
  openGraph: {
    type: 'website',
    siteName: 'TypeForge',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: next-themes modifies the `class` attribute on
    // <html> after hydration (to inject 'dark' or 'light'). Without this prop,
    // React will throw a hydration mismatch warning on every page load.
    // This suppression is intentional and scoped to the html element only.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-surface text-correct antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
