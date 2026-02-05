/**
 * Lexicon pack registry: published packs, draft packs (dev-only), script-based fallbacks.
 * No business component should import PourLaMaquette; draft path is resolved server-side only.
 */

import type { LexiconPackV1, LexiconForIntentResult, LexiconPackSource } from './types';
import { FALLBACK_PACKS } from './fallbacks';
import { getDisplayLanguage, detectScriptStats } from '../actionability';

export type { LexiconPackV1, LexiconForIntentResult, LexiconPackSource } from './types';
export { FALLBACK_PACKS } from './fallbacks';

type FallbackKey = keyof typeof FALLBACK_PACKS;

/** Kana (Japanese) is detected as cjk by script stats; we map to kana fallback when intentLang is ja. */
function getFallbackKeyForIntent(intent: string, intentLang: string): FallbackKey {
  const stats = detectScriptStats(intent);
  const max = Math.max(stats.hangul, stats.cjk, stats.latin, stats.cyrillic, stats.arabic, stats.other);
  if (max === 0) return 'latin_generic';
  if (stats.hangul >= max) return 'hangul_generic';
  if (stats.cyrillic >= max) return 'cyrillic_generic';
  if (stats.arabic >= max) return 'arabic_generic';
  if (stats.cjk >= max) {
    if (intentLang === 'ja') return 'kana_generic';
    return 'cjk_generic';
  }
  return 'latin_generic';
}

/**
 * Returns script-based fallback pack for intent. Sync, no I/O.
 * Used by getLexSignals and when no published/draft pack exists.
 */
export function getFallbackPackForIntent(intent: string, uiLocale: string): LexiconPackV1 {
  const intentLang = getDisplayLanguage(intent, uiLocale);
  const key = getFallbackKeyForIntent(intent, intentLang);
  return FALLBACK_PACKS[key];
}

/**
 * Infer intent language code (same as getDisplayLanguage). Reused for pack resolution.
 */
export function inferIntentLang(intent: string, uiLocale: string): string {
  return getDisplayLanguage(intent, uiLocale);
}

/**
 * Load published pack from lib/lexicon/packs/<lang>.json. Server-side only; returns null if not found or on client.
 */
export async function loadPublishedPack(lang: string): Promise<LexiconPackV1 | null> {
  if (typeof process === 'undefined') return null;
  try {
    const path = await import('path');
    const fs = await import('fs');
    const cwd = process.cwd();
    const fromWeb = path.join(cwd, 'app', 'lib', 'lexicon', 'packs', `${lang}.json`);
    const fromRoot = path.join(cwd, 'apps', 'web', 'app', 'lib', 'lexicon', 'packs', `${lang}.json`);
    const filePath = fs.existsSync(fromWeb) ? fromWeb : fromRoot;
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as LexiconPackV1;
    return validatePackShape(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Load draft pack from PourLaMaquette/lexicon-drafts/<lang>.json. DEV ONLY; returns null in production or if not found.
 */
export async function loadDraftPack(lang: string): Promise<LexiconPackV1 | null> {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const path = await import('path');
    const fs = await import('fs');
    const cwd = process.cwd();
    const fromWeb = path.join(cwd, 'app', 'PourLaMaquette', 'lexicon-drafts', `${lang}.json`);
    const fromRoot = path.join(cwd, 'apps', 'web', 'app', 'PourLaMaquette', 'lexicon-drafts', `${lang}.json`);
    const filePath = fs.existsSync(fromWeb) ? fromWeb : fromRoot;
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as LexiconPackV1;
    return validatePackShape(data) ? data : null;
  } catch {
    return null;
  }
}

import { validatePackShape } from './validate';

/**
 * getPack(lang, { allowDraft }): published > draft (if allowed) > null.
 * Server-side only for published/draft; returns null on client.
 */
export async function getPack(
  lang: string,
  options?: { allowDraft?: boolean },
): Promise<LexiconPackV1 | null> {
  const published = await loadPublishedPack(lang);
  if (published) return published;
  if (options?.allowDraft) {
    const draft = await loadDraftPack(lang);
    if (draft) return draft;
  }
  return null;
}

/**
 * getLexiconForIntent(intent, uiLocale, { allowDraft }):
 * Infer intentLang; if pack exists for intentLang return it; else return script-based fallback.
 * Returns metadata: { packLang, source: 'published'|'draft'|'fallback' }.
 * Async because it may load published/draft from disk (server-side).
 */
export async function getLexiconForIntent(
  intent: string,
  uiLocale: string,
  options?: { allowDraft?: boolean },
): Promise<LexiconForIntentResult> {
  const intentLang = inferIntentLang(intent, uiLocale);
  const published = await loadPublishedPack(intentLang);
  if (published) {
    return { pack: published, packLang: intentLang, source: 'published' };
  }
  if (options?.allowDraft) {
    const draft = await loadDraftPack(intentLang);
    if (draft) {
      return { pack: draft, packLang: intentLang, source: 'draft' };
    }
  }
  const fallback = getFallbackPackForIntent(intent, uiLocale);
  const packLang = intentLang;
  return { pack: fallback, packLang, source: 'fallback' };
}

/**
 * getLexSignals(intent, uiLocale): sync, no I/O. Returns fallback tokens + source.
 * Use this when you cannot await (e.g. client-side); for full resolution use getLexiconForIntent on server.
 */
export function getLexSignals(
  intent: string,
  uiLocale: string,
): { tokens: LexiconPackV1['tokens']; source: LexiconPackSource; packLang: string } {
  const intentLang = inferIntentLang(intent, uiLocale);
  const pack = getFallbackPackForIntent(intent, uiLocale);
  return {
    tokens: pack.tokens,
    source: 'fallback',
    packLang: intentLang,
  };
}
