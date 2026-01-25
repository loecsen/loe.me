import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import AppShell from './components/AppShell';
import { I18nProvider } from './components/I18nProvider';
import { getLocaleFromAcceptLanguage } from './lib/i18n';

import './globals.css';

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
      <body>
        <I18nProvider initialLocale={initialLocale} acceptLanguage={acceptLanguage}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
