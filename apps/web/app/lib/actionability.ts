/**
 * Actionability Gate v2 — sans LLM.
 * Décide si une intention est "actionable" pour créer un rituel, ou si on demande une précision inline.
 */

import type { ActionabilityGateResult, ActionabilityStatus } from './actionability/types';
import { Category } from './category';
import type { LexiconPackTokens } from './lexicon/types';

export type { ActionabilityGateResult, ActionabilityStatus } from './actionability/types';
export type { Category } from './category';

export type DominantScript = 'cjk' | 'hangul' | 'latin' | 'other';

export type ActionabilityAction = 'actionable' | 'not_actionable_inline' | 'borderline';

export type ActionabilityReasonCode =
  | 'noise'
  | 'too_short_cjk'
  | 'single_term'
  | 'not_actionable_inline'
  | 'borderline_actionable'
  | 'actionable';

export type ScriptStats = {
  cjk: number;
  hangul: number;
  latin: number;
  cyrillic: number;
  arabic: number;
  other: number;
  total: number;
  dominant_script: DominantScript;
  ratios: Record<string, number>;
};

export type ActionabilityFeatures = {
  char_count_effective: number;
  has_digit: boolean;
  has_cefr: boolean;
  has_structure: boolean;
  only_emoji_or_punct: boolean;
  latin_word_count: number;
};

export type ActionabilityResult = {
  action: ActionabilityAction;
  reason_code: ActionabilityReasonCode;
  category?: string;
  debug: {
    dominant_script: DominantScript;
    ratios: Record<string, number>;
    features: ActionabilityFeatures;
    category?: string;
  };
};

const CJK_RANGES = [
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0x3400, 0x4dbf], // CJK Extension A
  [0x3040, 0x309f], // Hiragana
  [0x30a0, 0x30ff], // Katakana
  [0xac00, 0xd7af], // Hangul Syllables (we count separately)
];
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7af;
const LATIN_RANGES = [
  [0x0041, 0x005a],
  [0x0061, 0x007a],
  [0x00c0, 0x024f],
];
const CYRILLIC_RANGE = [0x0400, 0x04ff];
const ARABIC_RANGE = [0x0600, 0x06ff];
const HIRAGANA_RANGE: [number, number] = [0x3040, 0x309f];
const KATAKANA_RANGE: [number, number] = [0x30a0, 0x30ff];
const CJK_IDEOGRAPH_RANGES: Array<[number, number]> = [
  [0x4e00, 0x9fff],
  [0x3400, 0x4dbf],
];

function inRange(code: number, [lo, hi]: [number, number]) {
  return code >= lo && code <= hi;
}

function isKana(code: number): boolean {
  return inRange(code, HIRAGANA_RANGE) || inRange(code, KATAKANA_RANGE);
}

function isCJKIdeograph(code: number): boolean {
  return CJK_IDEOGRAPH_RANGES.some((r) => inRange(code, r));
}

function isCJK(code: number): boolean {
  if (code >= HANGUL_START && code <= HANGUL_END) return false;
  return CJK_RANGES.some(([lo, hi]) => inRange(code, [lo, hi]));
}

function isHangul(code: number): boolean {
  return inRange(code, [HANGUL_START, HANGUL_END]);
}

function isLatin(code: number): boolean {
  return LATIN_RANGES.some(([lo, hi]) => inRange(code, [lo, hi]));
}

function isCyrillic(code: number): boolean {
  return inRange(code, CYRILLIC_RANGE);
}

function isArabic(code: number): boolean {
  return inRange(code, ARABIC_RANGE);
}

/** Trim + collapse spaces */
export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Display / intent language: inferred from intent (script + lightweight heuristics).
 * Used for rewrites, normalized_intent, suggested_rephrase (same language as user input).
 * NOT a constraint: runtime gates work for any input language; English input is NOT required.
 * Primary fallback: script detection (CJK/Hangul/Kana/Cyrillic/Arabic/Latin); small multi-language lexicons for key patterns.
 */
export type DisplayLang = 'en' | 'fr' | 'es' | 'de' | 'it' | 'zh' | 'ja' | 'ko' | 'ru';

const DISPLAY_LANG_FALLBACKS: Record<string, DisplayLang> = {
  en: 'en',
  fr: 'fr',
  es: 'es',
  de: 'de',
  it: 'it',
  zh: 'zh',
  ja: 'ja',
  ko: 'ko',
  ru: 'ru',
};

/** Latin script: detect FR/ES from diacritics or common words; else fallback uiLocale. */
function detectLatinDisplayLang(text: string, uiLocale: string): DisplayLang {
  const lower = text.toLowerCase();
  const hasFrenchDiacritics = /[àâäéèêëïîôùûüÿçœæ]/u.test(text);
  const hasSpanishDiacritics = /[áéíóúñü¿¡]/u.test(text);
  const frenchWords = /\b(le|la|les|des|un|une|en|et|est|sont|être|avoir|ça|pour|avec|dans|apprendre|améliorer|français)\b/i.test(lower);
  const spanishWords = /\b(el|la|los|las|un|una|en|y|es|son|estar|tener|para|con|qué|aprender|español)\b/i.test(lower);
  if (hasFrenchDiacritics || frenchWords) return 'fr';
  if (hasSpanishDiacritics || spanishWords) return 'es';
  const base = (uiLocale ?? '').split('-')[0]?.toLowerCase() ?? 'en';
  return (DISPLAY_LANG_FALLBACKS[base] as DisplayLang) ?? 'en';
}

/**
 * Infer intent language (intentLang) from intent text and UI locale fallback.
 * Used for: LLM output language (normalized_intent, suggested_rephrase), rewrites, chips.
 * uiLocale is used ONLY for displayed messages (inline hints, button labels) and as fallback when intent is empty.
 */
export function getDisplayLanguage(intent: string, uiLocale: string): DisplayLang {
  const trimmed = (intent ?? '').trim();
  if (!trimmed) {
    const base = (uiLocale ?? '').split('-')[0]?.toLowerCase() ?? 'en';
    return (DISPLAY_LANG_FALLBACKS[base] as DisplayLang) ?? 'en';
  }
  let hangul = 0;
  let kana = 0;
  let cjk = 0;
  let cyrillic = 0;
  let latin = 0;
  for (const char of trimmed) {
    const code = char.codePointAt(0) ?? 0;
    if (isHangul(code)) hangul++;
    else if (isKana(code)) kana++;
    else if (isCJKIdeograph(code)) cjk++;
    else if (isCyrillic(code)) cyrillic++;
    else if (isLatin(code)) latin++;
  }
  if (hangul > 0) return 'ko';
  if (kana > 0) return 'ja';
  if (cjk > 0) return 'zh';
  if (cyrillic > 0) return 'ru';
  if (latin > 0) return detectLatinDisplayLang(trimmed, uiLocale);
  const base = (uiLocale ?? '').split('-')[0]?.toLowerCase() ?? 'en';
  return (DISPLAY_LANG_FALLBACKS[base] as DisplayLang) ?? 'en';
}

/** Letters only: remove spaces, punctuation, emojis (keep letters and numbers for checks) */
function lettersOnly(text: string): string {
  return text.replace(/[\s\p{P}\p{S}\p{M}\p{Z}]/gu, '').replace(/\p{Emoji}/gu, '');
}

export function detectScriptStats(text: string): ScriptStats {
  const stats = { cjk: 0, hangul: 0, latin: 0, cyrillic: 0, arabic: 0, other: 0 };
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (isHangul(code)) stats.hangul++;
    else if (isCJK(code)) stats.cjk++;
    else if (isLatin(code)) stats.latin++;
    else if (isCyrillic(code)) stats.cyrillic++;
    else if (isArabic(code)) stats.arabic++;
    else if (/\p{L}/u.test(char) || /\p{N}/u.test(char)) stats.other++;
  }
  const total =
    stats.cjk + stats.hangul + stats.latin + stats.cyrillic + stats.arabic + stats.other;
  const scriptCounts: Record<string, number> = {
    cjk: stats.cjk,
    hangul: stats.hangul,
    latin: stats.latin,
    cyrillic: stats.cyrillic,
    arabic: stats.arabic,
    other: stats.other,
  };
  const ratios: Record<string, number> = {};
  for (const [k, v] of Object.entries(scriptCounts)) {
    ratios[k] = total > 0 ? v / total : 0;
  }
  let dominant_script: DominantScript = 'other';
  if (total > 0) {
    const max = Math.max(stats.cjk, stats.hangul, stats.latin, stats.cyrillic, stats.arabic, stats.other);
    if (stats.cjk >= max) dominant_script = 'cjk';
    else if (stats.hangul >= max) dominant_script = 'hangul';
    else if (stats.latin >= max) dominant_script = 'latin';
    else dominant_script = 'other';
  }
  return {
    ...stats,
    total,
    dominant_script,
    ratios,
  };
}

const CEFR_PATTERN = /\b(A1|A2|B1|B2|C1|C2)\b/i;
const CEFR_ADJACENT = /[A-Za-z]?(A1|A2|B1|B2|C1|C2)[A-Za-z0-9]*/i;

function hasCefr(text: string): boolean {
  return CEFR_PATTERN.test(text) || CEFR_ADJACENT.test(text);
}

function hasStructure(text: string): boolean {
  if (/[:→\/]/.test(text)) return true;
  if (/\n/.test(text)) return true;
  const commas = (text.match(/,/g) ?? []).length;
  if (commas >= 2) return true;
  if (/^\s*-\s+/m.test(text) || /^\s*[-•]\s+/m.test(text)) return true;
  return false;
}

/** True if text has no letters and no numbers (only spaces/emoji/punct). */
function onlyEmojiOrPunct(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return !/[\p{L}\p{N}]/u.test(trimmed);
}

function latinWordCount(text: string): number {
  const latinPart = text.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  return latinPart ? latinPart.split(/\s+/).filter(Boolean).length : 0;
}

/**
 * Runtime intent understanding: must work for any input language. English input is NOT required.
 * Primary fallback: script detection (CJK/Hangul/Kana/Cyrillic/Arabic/Latin). Small multi-language
 * lexicons for key patterns: greetings, learning verbs, consume-only, romantic outcomes, elite/superlatives.
 * If language unknown, fall back to script heuristics + minimal Latin heuristics (detectLatinDisplayLang).
 */
/** Social / greeting patterns (lowercase, no accents for Latin). */
const SOCIAL_PATTERNS = [
  /^(bonjour|salut|coucou|hello|hi|hey|yo|ciao|hola|hallo)$/i,
  /^comment\s+(ca|ça)\s+va\s*\??$/i,
  /^how\s+are\s+you\s*\??$/i,
  /^what'?s\s+up\s*\??$/i,
  /^how\s+do\s+you\s+do\s*\??$/i,
  /^(你好|您好|嗨|안녕|안녕하세요)$/,
];

function isSocialGreeting(text: string, extraGreetings?: string[]): boolean {
  const t = normalize(text).toLowerCase();
  const trimmed = t.trim();
  if (!trimmed) return false;
  for (const p of SOCIAL_PATTERNS) {
    if (p.test(trimmed)) return true;
  }
  if (extraGreetings?.length) {
    const set = new Set(extraGreetings.map((g) => g.toLowerCase().trim()).filter(Boolean));
    if (set.has(trimmed)) return true;
  }
  return false;
}

/** "faire pizza", "faire des pizzas" → action de faire/créer (actionable). */
function isFairePlusNoun(text: string): boolean {
  const lower = normalize(text).toLowerCase();
  return /^\s*faire\s+(des?\s+)?[\p{L}]+/u.test(lower) || /^\s*(make|build|create)\s+[\p{L}]+/iu.test(lower);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "manger pizza", "eat pizza" → consume only, pas objectif apprentissage (borderline). */
function isConsumeOnly(text: string, extraConsumeVerbs?: string[]): boolean {
  const lower = normalize(text).toLowerCase();
  if (/^\s*(manger|eat|drink|boire|consommer)\s+/u.test(lower)) return true;
  if (extraConsumeVerbs?.length) {
    const escaped = extraConsumeVerbs.map((v) => escapeRegex(v.trim().toLowerCase()).replace(/\s+/g, '\\s+')).filter(Boolean);
    if (escaped.length) {
      try {
        const re = new RegExp(`^\\s*(${escaped.join('|')})\\s+`, 'u');
        if (re.test(lower)) return true;
      } catch {
        /* ignore invalid regex */
      }
    }
  }
  return false;
}

/** Learning/skill verb + something (apprendre, learn, improve). */
function hasLearningVerb(text: string, extraLearningVerbs?: string[]): boolean {
  const lower = normalize(text).toLowerCase();
  if (/\b(apprendre|learn|improve|ameliorer|study|étudier)\b/i.test(lower)) return true;
  if (extraLearningVerbs?.length) {
    const escaped = extraLearningVerbs.map((v) => escapeRegex(v.trim()).replace(/\s+/g, '\\s+')).filter(Boolean);
    if (escaped.length) {
      try {
        const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
        if (re.test(lower)) return true;
      } catch {
        /* ignore invalid regex */
      }
    }
  }
  return false;
}

/** Wellbeing / grounding keywords (including vague emotional/relationship intents). Romance → WELLBEING. */
function hasWellbeingHint(text: string): boolean {
  const lower = normalize(text).toLowerCase();
  return (
    /\b(meditation|mindfulness|breath|respiration|sleep|sommeil|stress|relax|yoga|pleine conscience)\b/i.test(lower) ||
    /\b(triste|sad|récupérer|recover|bien-être|wellbeing|émotion|emotion|sentiment|feeling)\b/i.test(lower) ||
    /\b(ex\s+copine|ex\s+copain|ex\s+partner|mon ex)\b/i.test(lower) ||
    /\b(get\s+my\s+ex\s+back|get\s+ex\s+back|win\s+.*\s+back)\b/i.test(lower)
  );
}

/** Challenge / transformation keywords. */
function hasChallengeHint(text: string): boolean {
  const lower = normalize(text).toLowerCase();
  return /\b(challenge|défi|transformation|habitude|routine)\b/i.test(lower);
}

/** Infer category from intent (heuristic only; classifier can override). Optional lexicon tokens augment baseline. */
export function inferCategoryFromIntent(
  text: string,
  lexiconTokens?: LexiconPackTokens | null,
): string | undefined {
  const normalized = normalize(text);
  if (!normalized) return undefined;
  if (isSocialGreeting(normalized, lexiconTokens?.greetings)) return Category.SOCIAL;
  if (hasLearningVerb(normalized, lexiconTokens?.learning_verbs)) return Category.LEARN;
  if (isFairePlusNoun(normalized)) return Category.CREATE;
  if (hasWellbeingHint(normalized)) return Category.WELLBEING;
  if (hasChallengeHint(normalized)) return Category.CHALLENGE;
  return undefined;
}

/**
 * Actionability Gate v2: décision sans LLM.
 * @param text - Intention utilisateur
 * @param timeframe_days - Optionnel; si présent et objectif apprentissage, favorise ACTIONABLE
 * @param lexiconTokens - Optionnel; tokens d'un pack lexique (getLexiconForIntent / getLexSignals) pour signaux additionnels
 */
export function runActionabilityV2(
  text: string,
  timeframe_days?: number,
  lexiconTokens?: LexiconPackTokens | null,
): ActionabilityResult {
  const normalized = normalize(text);
  const letters = lettersOnly(normalized);
  const scriptStats = detectScriptStats(normalized);
  const inferredCategory = inferCategoryFromIntent(normalized, lexiconTokens);

  const features: ActionabilityFeatures = {
    char_count_effective: letters.length,
    has_digit: /\d/.test(normalized),
    has_cefr: hasCefr(normalized),
    has_structure: hasStructure(normalized),
    only_emoji_or_punct: onlyEmojiOrPunct(normalized),
    latin_word_count: latinWordCount(normalized),
  };

  if (features.only_emoji_or_punct) {
    return {
      action: 'not_actionable_inline',
      reason_code: 'noise',
      category: inferredCategory,
      debug: {
        dominant_script: scriptStats.dominant_script,
        ratios: scriptStats.ratios,
        features,
        category: inferredCategory,
      },
    };
  }

  if (isSocialGreeting(normalized)) {
    return {
      action: 'not_actionable_inline',
      reason_code: 'social_chitchat',
      category: inferredCategory,
      debug: {
        dominant_script: scriptStats.dominant_script,
        ratios: scriptStats.ratios,
        features,
        category: inferredCategory,
      },
    };
  }

  if (features.has_digit || features.has_cefr || features.has_structure) {
    return {
      action: 'actionable',
      reason_code: 'actionable',
      category: inferredCategory,
      debug: {
        dominant_script: scriptStats.dominant_script,
        ratios: scriptStats.ratios,
        features,
        category: inferredCategory,
      },
    };
  }

  const { dominant_script } = scriptStats;
  const { char_count_effective, latin_word_count } = features;

  if (dominant_script === 'latin' || scriptStats.ratios.latin >= 0.5) {
    if (isFairePlusNoun(normalized)) {
      return {
        action: 'actionable',
        reason_code: 'actionable',
        category: inferredCategory,
        debug: {
          dominant_script,
          ratios: scriptStats.ratios,
          features,
          category: inferredCategory,
        },
      };
    }
    if (isConsumeOnly(normalized, lexiconTokens?.consume_verbs)) {
      return {
        action: 'borderline',
        reason_code: 'borderline_actionable',
        category: inferredCategory,
        debug: {
          dominant_script,
          ratios: scriptStats.ratios,
          features,
          category: inferredCategory,
        },
      };
    }
    if (typeof timeframe_days === 'number' && timeframe_days >= 30 && hasLearningVerb(normalized) && latin_word_count >= 2) {
      return {
        action: 'actionable',
        reason_code: 'actionable',
        category: inferredCategory,
        debug: {
          dominant_script,
          ratios: scriptStats.ratios,
          features,
          category: inferredCategory,
        },
      };
    }
  }

  if (dominant_script === 'cjk' || dominant_script === 'hangul') {
    if (char_count_effective >= 6) {
      return {
        action: 'actionable',
        reason_code: 'actionable',
        category: inferredCategory,
        debug: {
          dominant_script,
          ratios: scriptStats.ratios,
          features,
          category: inferredCategory,
        },
      };
    }
    if (char_count_effective <= 2) {
      return {
        action: 'not_actionable_inline',
        reason_code: 'too_short_cjk',
        category: inferredCategory,
        debug: {
          dominant_script,
          ratios: scriptStats.ratios,
          features,
          category: inferredCategory,
        },
      };
    }
    return {
      action: 'borderline',
      reason_code: 'borderline_actionable',
      category: inferredCategory,
      debug: {
        dominant_script,
        ratios: scriptStats.ratios,
        features,
        category: inferredCategory,
      },
    };
  }

  if (latin_word_count >= 3 || char_count_effective >= 24) {
    return {
      action: 'actionable',
      reason_code: 'actionable',
      category: inferredCategory,
      debug: {
        dominant_script,
        ratios: scriptStats.ratios,
        features,
        category: inferredCategory,
      },
    };
  }
  if (latin_word_count <= 1) {
    return {
      action: 'not_actionable_inline',
      reason_code: 'single_term',
      category: inferredCategory,
      debug: {
        dominant_script,
        ratios: scriptStats.ratios,
        features,
        category: inferredCategory,
      },
    };
  }
  return {
    action: 'borderline',
    reason_code: 'borderline_actionable',
    category: inferredCategory,
    debug: {
      dominant_script,
      ratios: scriptStats.ratios,
      features,
      category: inferredCategory,
    },
  };
}

/** Map rule-based result to unified gate result (status uppercase, mode inline). */
export function toGateResult(result: ActionabilityResult): ActionabilityGateResult {
  const status: ActionabilityStatus =
    result.action === 'actionable'
      ? 'ACTIONABLE'
      : result.action === 'not_actionable_inline'
        ? 'NOT_ACTIONABLE_INLINE'
        : 'BORDERLINE';
  return {
    status,
    reason_code: result.reason_code as ActionabilityGateResult['reason_code'],
    mode: 'inline',
    category: result.category,
    debug: result.debug
      ? {
          dominant_script: result.debug.dominant_script,
          ratios: result.debug.ratios,
          features: result.debug.features as Record<string, unknown>,
          category: result.debug.category,
        }
      : undefined,
  };
}
