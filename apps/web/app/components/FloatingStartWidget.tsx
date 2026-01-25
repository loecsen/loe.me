'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from './I18nProvider';

export default function FloatingStartWidget() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <button
      className="floating-widget"
      onClick={() => router.push('/mission?start=1')}
      aria-label={t.floatingStartAria}
    >
      <span className="floating-widget-icon" aria-hidden="true" />
      <span>{t.floatingStart}</span>
    </button>
  );
}
