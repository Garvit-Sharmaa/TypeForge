'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TypingArena from '@/components/typing/TypingArena';

// useSearchParams() must be inside a Suspense boundary in App Router
function PracticeContent() {
  const params   = useSearchParams();
  const lessonId = params.get('lessonId') ?? undefined;
  return <TypingArena lessonId={lessonId} />;
}

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticeContent />
    </Suspense>
  );
}
