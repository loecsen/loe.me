'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from './I18nProvider';
import { buildMissionUrl } from '../lib/missionUrl';
import { setRitualIdMapEntry } from '../lib/rituals/inProgress';

export default function FloatingStartWidget() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <button
      className="floating-widget"
      onClick={() => {
        if (typeof window === 'undefined') {
          router.push('/');
          return;
        }
        try {
          const raw = window.localStorage.getItem('loe.ritual');
          if (raw) {
            const ritual = JSON.parse(raw) as { ritualId: string; intention: string; days: number };
            if (ritual?.ritualId) {
              setRitualIdMapEntry(ritual.ritualId);
              router.push(
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
        router.push('/');
      }}
      aria-label={t.floatingStartAria}
    >
      <span className="floating-widget-icon" aria-hidden="true" />
      <span>{t.floatingStart}</span>
    </button>
  );
}
