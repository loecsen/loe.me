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

async function loadFrOverrides(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const res = await fetch('/api/admin/messages-overrides');
    const data = (await res.json()) as { fr?: Record<string, string> };
    return data.fr ?? {};
  } catch {
    return {};
  }
}

export function I18nProvider({ initialLocale, acceptLanguage, children }: I18nProviderProps) {
  const [storedLocale, setStoredLocale] = useLocalStorage<Locale | null>('loe.locale', null);
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale ?? getLocaleFromAcceptLanguage(acceptLanguage ?? null),
  );
  const [frOverrides, setFrOverrides] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (locale !== 'fr') return;
    loadFrOverrides().then(setFrOverrides);
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next);
  };

  const t = useMemo(() => {
    const base = (translations[locale] ?? translations[defaultLocale]) as Copy;
    if (locale === 'fr' && Object.keys(frOverrides).length > 0) {
      return { ...base, ...frOverrides } as Copy;
    }
    return base;
  }, [locale, frOverrides]);

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
