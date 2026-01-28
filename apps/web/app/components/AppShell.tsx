'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Container } from '@loe/ui';
import FloatingStartWidget from './FloatingStartWidget';
import { useI18n } from './I18nProvider';
import { supportedLocales } from '../lib/i18n';
import { useLocalSession } from '../hooks/useLocalSession';
import { useEffect, useState } from 'react';
import { clearImageCache } from '../lib/images/imageCache';
import AuthModal from './AuthModal';
import AccountModal from './AccountModal';

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const { t, locale, setLocale } = useI18n();
  const { session, signIn, signOut, reset } = useLocalSession();
  const pathname = usePathname();
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isHome = pathname === '/';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const marker = 'loe_img_cache_cleared_v3';
    if (window.localStorage.getItem(marker)) {
      return;
    }
    clearImageCache();
    window.localStorage.setItem(marker, new Date().toISOString());
  }, []);

  const displayEmail = session?.email
    ? session.email.split('@')[0]?.slice(0, 18)
    : 'Account';

  return (
    <div className="app-shell">
      <header className="app-header">
        <Container className="header-inner">
          <Link className="brand" href="/">
            <span className="brand-dot" />
            <span>Loe.me</span>
          </Link>
          <div className="header-actions">
            <select
              className="locale-toggle"
              value={locale}
              onChange={(event) => setLocale(event.target.value as typeof locale)}
              aria-label="Language"
            >
              {supportedLocales.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>

            {session ? (
              <div className="account-menu">
                <button
                  className="user-pill"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  type="button"
                >
                  {displayEmail}
                  <span className="user-pill-chevron">⌄</span>
                </button>
                {menuOpen && (
                  <div className="account-dropdown">
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setAccountOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      Account
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        signOut();
                        setMenuOpen(false);
                      }}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="primary-button" onClick={() => setAuthOpen(true)}>
                Sign in
              </button>
            )}

            <button className="help-button" aria-label="Help">
              ?
            </button>
          </div>
        </Container>
      </header>
      <main className={`app-main${isHome ? ' app-main-home' : ''}`}>
        <Container>{children}</Container>
      </main>
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSubmit={(email) => {
          signIn(email);
          setAuthOpen(false);
        }}
        onReset={() => {
          reset();
          setAuthOpen(false);
        }}
      />
      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        session={session}
      />
    </div>
  );
}
