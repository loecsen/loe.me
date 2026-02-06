'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { buildMissionUrl } from '../../lib/missionUrl';
import { setRitualIdMapEntry } from '../../lib/rituals/inProgress';

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
      const pending = JSON.parse(raw) as { ritualId?: string; intention?: string; days?: number };
      if (pending?.ritualId) {
        setRitualIdMapEntry(pending.ritualId);
        router.replace(
          buildMissionUrl({
            ritualId: pending.ritualId,
            intention: pending.intention ?? 'Ta routine',
            days: pending.days ?? 21,
          }),
        );
        return;
      }
    } catch {
      // ignore
    }
    router.replace('/');
  }, [router]);

  return null;
}
