import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import AppShell from './components/AppShell';
import { I18nProvider } from './components/I18nProvider';
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
        <I18nProvider initialLocale={initialLocale} acceptLanguage={acceptLanguage}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
