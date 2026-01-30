/**
 * Inline suggestion safety and building: should we suggest a rephrase, and how.
 * Used by API classify + tests. Sync checks only; API adds lexicon guard.
 */

import { normalize } from '../actionability';
import type { DisplayLang } from '../actionability';

/** Normalize for substring check: lowercase, collapse spaces, NFKC. */
function normalizedForBlock(text: string): string {
  return (text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Minimal block list for sexual/insult so we never suggest a "how-to" for these. */
const BLOCKED_SUBSTRINGS: string[] = [
  'bite',
  'sex',
  'penis',
  'vagina',
  'orgasm',
  'porn',
  'nude',
  'dick',
  'cock',
  'pussy',
  'asshole',
  'putain',
  'merde',
  'con',
  'connard',
  'salope',
  'encul',
  'fuck',
  'shit',
  'bitch',
  'techniques sexuelles',
  'sexual techniques',
  'sex positions',
];

function onlyEmojiOrPunct(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return true;
  return !/[\p{L}\p{N}]/u.test(t);
}

const SOCIAL_PATTERNS = [
  /^(bonjour|salut|coucou|hello|hi|hey|yo|ciao|hola|hallo)$/i,
  /^comment\s+(ca|ça)\s+va\s*\??$/i,
  /^how\s+are\s+you\s*\??$/i,
  /^what'?s\s+up\s*\??$/i,
  /^(你好|您好|嗨|안녕|안녕하세요)$/,
];

function isSocialGreeting(text: string): boolean {
  const t = normalize(text).toLowerCase();
  if (!t) return false;
  return SOCIAL_PATTERNS.some((p) => p.test(t.trim()));
}

/** Single token too short: one word and very short, or no real content. */
function isSingleTokenOrTooShort(text: string): boolean {
  const t = normalize(text ?? '');
  const latinPart = t.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  const words = latinPart ? latinPart.split(/\s+/).filter(Boolean) : [];
  if (words.length === 0 && t.length <= 2) return true;
  if (words.length <= 1 && t.length <= 3) return true;
  return false;
}

/**
 * Sync check: do not suggest rephrase for greeting, emoji-only, too short, or sexual/insult.
 * API must also run lexicon guard for full safety.
 */
export function shouldSuggestRephraseSync(intent: string): boolean {
  const t = (intent ?? '').trim();
  if (!t) return false;
  if (onlyEmojiOrPunct(t)) return false;
  if (isSocialGreeting(t)) return false;
  if (isSingleTokenOrTooShort(t)) return false;
  const normalized = normalizedForBlock(t);
  for (const sub of BLOCKED_SUBSTRINGS) {
    if (normalized.includes(sub)) return false;
  }
  return true;
}

/** Suggestion template: "Exemple : '{intent} en 14 jours'" etc. No techniques/positions. */
const SUGGESTION_TEMPLATES: Record<DisplayLang, string> = {
  en: "Example: '{intent} in 14 days'",
  fr: "Exemple : '{intent} en 14 jours'",
  es: "Ejemplo: '{intent} en 14 días'",
  de: "Beispiel: '{intent} in 14 Tagen'",
  it: "Esempio: '{intent} in 14 giorni'",
  zh: "示例：'{intent} 14天'",
  ja: "例：'{intent} 14日間'",
  ko: "예: '{intent} 14일'",
  ru: "Пример: '{intent} за 14 дней'",
};

/**
 * Build a localized neutral suggestion from normalized intent and display lang.
 * Returns null if intent is empty.
 */
export function buildSuggestionFromTemplate(
  displayLang: DisplayLang,
  normalizedIntent: string,
): string | null {
  const intent = (normalizedIntent ?? '').trim();
  if (!intent) return null;
  const template = SUGGESTION_TEMPLATES[displayLang] ?? SUGGESTION_TEMPLATES.en;
  return template.replace('{intent}', intent);
}
