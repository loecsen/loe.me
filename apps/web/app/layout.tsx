import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import AppShell from './components/AppShell';
import { I18nProvider } from './components/I18nProvider';
import SplashRemover from './components/SplashRemover';
import { getLocaleFromAcceptLanguage } from './lib/i18n';

import '@loe/ui/styles.css';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata = {
  title: 'Loe.me',
  description: 'Loe.me – une expérience calme, premium et lumineuse.',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  const acceptLanguage = headers().get('accept-language');
  const initialLocale = getLocaleFromAcceptLanguage(acceptLanguage);

  return (
    <html lang={initialLocale}>
      <body className={inter.className}>
        {/* Preloader : splash bleu "Stop scroll. Act." affiché avant le reste */}
        <div id="loe-splash" className="loe-splash" role="presentation" aria-hidden="true">
          <div className="loe-splash-glow1" />
          <div className="loe-splash-glow2" />
          <h1 className="loe-splash-slogan">Stop scroll. Act.</h1>
        </div>
        <SplashRemover />
        <I18nProvider initialLocale={initialLocale} acceptLanguage={acceptLanguage}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
