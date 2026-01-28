'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PENDING_REQUEST_KEY = 'loe.pending_ritual_request';

export default function RitualCreatingPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const raw = window.sessionStorage.getItem(PENDING_REQUEST_KEY);
    if (!raw) {
      router.replace('/');
      return;
    }
    try {
      const pending = JSON.parse(raw) as { ritualId?: string };
      if (pending?.ritualId) {
        router.replace(`/mission?creating=1&ritualId=${pending.ritualId}`);
        return;
      }
    } catch {
      // ignore
    }
    router.replace('/');
  }, [router]);

  return null;
}
