/**
 * Conservative auto-bootstrap trigger for unknown Latin languages.
 * DEV-only by default; production only if NEXT_PUBLIC_ENABLE_LEXICON_AUTOBOOTSTRAP === "1".
 * Never blocks; no user intent as prompt seed. Throttle 30 days per language.
 */

import { getDisplayLanguage } from '../actionability';
import { shouldSuggestRephraseSync } from '../actionability/suggestion';

const BASELINE_LANGS = new Set(['en', 'fr', 'es', 'de', 'it']);
const THROTTLE_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'loe.lexicon_autobootstrap.';

const inFlight = new Set<string>();

export type LexiconAutobootstrapTrace = {
  gate: 'lexicon_autobootstrap';
  outcome: 'triggered' | 'skipped' | 'throttled' | 'disabled';
  meta: { lang: string; reason?: string };
};

function getTargetLang(intent: string, uiLocale: string): string | null {
  const intentLang = getDisplayLanguage(intent, uiLocale);
  if (BASELINE_LANGS.has(intentLang)) return null;
  const base = (uiLocale ?? '').split('-')[0]?.toLowerCase() ?? '';
  if (/^[a-z]{2}$/.test(base)) return base;
  if (/^[a-z]{2}$/.test(intentLang)) return intentLang;
  return null;
}

function isThrottled(lang: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const key = `${STORAGE_PREFIX}${lang}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < THROTTLE_DAYS_MS;
  } catch {
    return true;
  }
}

function setThrottle(lang: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${lang}`, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Optional, conservative auto-bootstrap. Call fire-and-forget from Home after submit.
 * Skips if: shouldSuggestRephraseSync false, baseline lang, throttled, in-flight, or disabled in prod.
 */
export function tryLexiconAutobootstrap(
  intent: string,
  uiLocale: string,
  onTrace?: (trace: LexiconAutobootstrapTrace) => void,
): void {
  const trimmed = (intent ?? '').trim();
  if (!trimmed) return;

  if (!shouldSuggestRephraseSync(trimmed)) {
    onTrace?.({
      gate: 'lexicon_autobootstrap',
      outcome: 'skipped',
      meta: { lang: '', reason: 'shouldSuggestRephraseSync false' },
    });
    return;
  }

  const targetLang = getTargetLang(trimmed, uiLocale);
  if (!targetLang) {
    onTrace?.({
      gate: 'lexicon_autobootstrap',
      outcome: 'skipped',
      meta: { lang: targetLang ?? '', reason: 'baseline or no target' },
    });
    return;
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const enabledProd = process.env.NEXT_PUBLIC_ENABLE_LEXICON_AUTOBOOTSTRAP === '1';
  if (!isDev && !enabledProd) {
    onTrace?.({
      gate: 'lexicon_autobootstrap',
      outcome: 'disabled',
      meta: { lang: targetLang, reason: 'production and flag off' },
    });
    return;
  }

  if (inFlight.has(targetLang)) {
    onTrace?.({
      gate: 'lexicon_autobootstrap',
      outcome: 'throttled',
      meta: { lang: targetLang, reason: 'in-flight' },
    });
    return;
  }

  if (isThrottled(targetLang)) {
    onTrace?.({
      gate: 'lexicon_autobootstrap',
      outcome: 'throttled',
      meta: { lang: targetLang, reason: '30-day throttle' },
    });
    return;
  }

  inFlight.add(targetLang);
  onTrace?.({
    gate: 'lexicon_autobootstrap',
    outcome: 'triggered',
    meta: { lang: targetLang },
  });

  fetch('/api/lexicon/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_lang: targetLang, ui_locale: uiLocale }),
  })
    .then((res) => res.json())
    .then((data: { ok?: boolean }) => {
      if (data?.ok) setThrottle(targetLang);
    })
    .catch(() => {})
    .finally(() => {
      inFlight.delete(targetLang);
    });
}
