import type { Metadata } from 'next';
import TypingArena from '@/components/typing/TypingArena';

export const metadata: Metadata = {
  title: 'Practice — TypingMaster',
};

export default function PracticePage() {
  return <TypingArena />;
}
