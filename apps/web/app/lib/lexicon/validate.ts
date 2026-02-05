/**
 * Validation and sanitization for lexicon packs (bootstrap output).
 * No user intent as input; safe blocklist for tokens.
 */

import type { LexiconPackV1, LexiconPackTokens } from './types';

const MAX_TOKEN_LENGTH = 80;
const MAX_ARRAY_LENGTH = 50;

/** Minimal blocklist so we never add unsafe tokens to a pack. */
const BLOCKED_SUBSTRINGS: string[] = [
  'sex', 'penis', 'vagina', 'orgasm', 'porn', 'nude', 'dick', 'cock', 'pussy',
  'asshole', 'putain', 'merde', 'connard', 'salope', 'encul', 'fuck', 'shit', 'bitch',
  'sexual techniques', 'sex positions', 'techniques sexuelles',
];

function isBlockedToken(token: string): boolean {
  const lower = token.toLowerCase().normalize('NFKC');
  return BLOCKED_SUBSTRINGS.some((b) => lower.includes(b));
}

function sanitizeToken(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, MAX_TOKEN_LENGTH);
}

function sanitizeTokens(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is string => typeof x === 'string')
    .map(sanitizeToken)
    .filter((s) => s.length > 0 && !isBlockedToken(s))
    .slice(0, MAX_ARRAY_LENGTH);
}

export function validatePackShape(p: unknown): p is LexiconPackV1 {
  if (!p || typeof p !== 'object') return false;
  const x = p as Record<string, unknown>;
  if (x.version !== 'lexicon-pack-v1' || typeof (x as LexiconPackV1).lang !== 'string') return false;
  const t = (x as LexiconPackV1).tokens;
  if (!t || typeof t !== 'object') return false;
  const keys: (keyof LexiconPackTokens)[] = [
    'greetings', 'learning_verbs', 'consume_verbs', 'romantic_markers',
    'institution_markers', 'selection_markers', 'market_markers',
    'elite_role_markers', 'superlative_markers',
  ];
  for (const k of keys) {
    if (!Array.isArray(t[k])) return false;
  }
  return true;
}

export function sanitizePack(raw: unknown): { ok: true; pack: LexiconPackV1 } | { ok: false; error: string } {
  if (!validatePackShape(raw)) {
    return { ok: false, error: 'Invalid pack shape or version' };
  }
  const p = raw as LexiconPackV1;
  const tokens: LexiconPackTokens = {
    greetings: sanitizeTokens(p.tokens.greetings),
    learning_verbs: sanitizeTokens(p.tokens.learning_verbs),
    consume_verbs: sanitizeTokens(p.tokens.consume_verbs),
    romantic_markers: sanitizeTokens(p.tokens.romantic_markers),
    institution_markers: sanitizeTokens(p.tokens.institution_markers),
    selection_markers: sanitizeTokens(p.tokens.selection_markers),
    market_markers: sanitizeTokens(p.tokens.market_markers),
    elite_role_markers: sanitizeTokens(p.tokens.elite_role_markers),
    superlative_markers: sanitizeTokens(p.tokens.superlative_markers),
  };
  if (tokens.greetings.length === 0 || tokens.learning_verbs.length === 0) {
    return { ok: false, error: 'greetings and learning_verbs must be non-empty after sanitization' };
  }
  const pack: LexiconPackV1 = {
    ...p,
    tokens,
    normalize: p.normalize?.lower !== false ? { lower: true, strip_diacritics: p.normalize?.strip_diacritics !== false } : { lower: false, strip_diacritics: false },
  };
  return { ok: true, pack };
}
