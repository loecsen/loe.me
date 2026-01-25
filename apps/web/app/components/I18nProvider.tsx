'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Locale, Copy } from '../lib/i18n';
import { defaultLocale, getLocaleFromAcceptLanguage, translations } from '../lib/i18n';
import { useLocalStorage } from '../hooks/useLocalStorage';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Copy;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  initialLocale?: Locale;
  acceptLanguage?: string | null;
  children: React.ReactNode;
};

export function I18nProvider({ initialLocale, acceptLanguage, children }: I18nProviderProps) {
  const [storedLocale, setStoredLocale] = useLocalStorage<Locale | null>('loe.locale', null);
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale ?? getLocaleFromAcceptLanguage(acceptLanguage ?? null),
  );

  useEffect(() => {
    if (storedLocale) {
      setLocaleState(storedLocale);
      return;
    }
    if (typeof window !== 'undefined') {
      const navigatorLocale = window.navigator.language;
      setLocaleState(getLocaleFromAcceptLanguage(navigatorLocale));
    }
  }, [storedLocale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next);
  };

  const t = useMemo(() => translations[locale] ?? translations[defaultLocale], [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
