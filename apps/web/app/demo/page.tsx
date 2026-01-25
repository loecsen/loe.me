'use client';

import { useI18n } from '../components/I18nProvider';

export default function DemoPage() {
  const { t } = useI18n();
  return (
    <section>
      <h1 className="page-title">{t.demoTitle}</h1>
    </section>
  );
}
