'use client';

import { useI18n } from '../components/I18nProvider';

export default function LoginPage() {
  const { t } = useI18n();

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <div>
          <span className="modal-label">{t.loginLabel}</span>
          <h1 className="page-title">{t.loginTitle}</h1>
          <p className="mission-subtitle">{t.loginBody}</p>
        </div>
      </div>
    </section>
  );
}
