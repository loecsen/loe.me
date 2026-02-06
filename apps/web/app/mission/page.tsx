'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildMissionUrl } from '../lib/missionUrl';
import { setRitualIdMapEntry } from '../lib/rituals/inProgress';

export default function MissionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ritualId = searchParams.get('ritualId') ?? '';
    const days = Number(searchParams.get('days')) || null;
    const intent = searchParams.get('intent') ?? '';
    if (ritualId && days) {
      setRitualIdMapEntry(ritualId);
      router.replace(
        buildMissionUrl({
          ritualId,
          intention: intent || 'Ta routine',
          days,
        }),
      );
      return;
    }
    try {
      const raw = window.localStorage.getItem('loe.ritual');
      if (raw) {
        const ritual = JSON.parse(raw) as { ritualId: string; intention: string; days: number };
        if (ritual?.ritualId) {
          setRitualIdMapEntry(ritual.ritualId);
          router.replace(
            buildMissionUrl({
              ritualId: ritual.ritualId,
              intention: ritual.intention ?? 'Ta routine',
              days: ritual.days ?? 21,
            }),
          );
          return;
        }
      }
    } catch {
      // ignore
    }
    router.replace('/');
  }, [router, searchParams]);

  return null;
}
