import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | TypingMaster',
    default: 'TypingMaster — Adaptive Keyboard Intelligence',
  },
  description:
    'Master your typing speed with AI-powered analytics, personalized drills, and real-time weak-key detection. Track WPM, accuracy, and beat your personal best.',
  keywords: ['typing test', 'WPM', 'typing speed', 'keyboard analytics', 'typing practice'],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ),
  openGraph: {
    type: 'website',
    siteName: 'TypingMaster',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-surface text-correct antialiased">
        {children}
      </body>
    </html>
  );
}
