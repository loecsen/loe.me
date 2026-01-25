'use client';

import { useI18n } from '../components/I18nProvider';

export default function AccountPage() {
  const { t } = useI18n();

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <div>
          <span className="modal-label">{t.accountLabel}</span>
          <h1 className="page-title">{t.accountTitle}</h1>
          <p className="mission-subtitle">{t.accountBody}</p>
        </div>
      </div>
    </section>
  );
}
