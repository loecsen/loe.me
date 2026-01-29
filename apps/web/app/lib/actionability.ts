/**
 * Actionability Gate v2 — sans LLM.
 * Décide si une intention est "actionable" pour créer un rituel, ou si on demande une précision inline.
 */

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
  debug: {
    dominant_script: DominantScript;
    ratios: Record<string, number>;
    features: ActionabilityFeatures;
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

function inRange(code: number, [lo, hi]: [number, number]) {
  return code >= lo && code <= hi;
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
 * Actionability Gate v2: décision sans LLM.
 */
export function runActionabilityV2(text: string): ActionabilityResult {
  const normalized = normalize(text);
  const letters = lettersOnly(normalized);
  const scriptStats = detectScriptStats(normalized);

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
      debug: {
        dominant_script: scriptStats.dominant_script,
        ratios: scriptStats.ratios,
        features,
      },
    };
  }

  if (features.has_digit || features.has_cefr || features.has_structure) {
    return {
      action: 'actionable',
      reason_code: 'actionable',
      debug: {
        dominant_script: scriptStats.dominant_script,
        ratios: scriptStats.ratios,
        features,
      },
    };
  }

  const { dominant_script } = scriptStats;
  const { char_count_effective, latin_word_count } = features;

  if (dominant_script === 'cjk' || dominant_script === 'hangul') {
    if (char_count_effective >= 6) {
      return {
        action: 'actionable',
        reason_code: 'actionable',
        debug: {
          dominant_script,
          ratios: scriptStats.ratios,
          features,
        },
      };
    }
    if (char_count_effective <= 2) {
      return {
        action: 'not_actionable_inline',
        reason_code: 'too_short_cjk',
        debug: {
          dominant_script,
          ratios: scriptStats.ratios,
          features,
        },
      };
    }
    return {
      action: 'borderline',
      reason_code: 'borderline_actionable',
      debug: {
        dominant_script,
        ratios: scriptStats.ratios,
        features,
      },
    };
  }

  if (latin_word_count >= 3 || char_count_effective >= 24) {
    return {
      action: 'actionable',
      reason_code: 'actionable',
      debug: {
        dominant_script,
        ratios: scriptStats.ratios,
        features,
      },
    };
  }
  if (latin_word_count <= 1) {
    return {
      action: 'not_actionable_inline',
      reason_code: 'single_term',
      debug: {
        dominant_script,
        ratios: scriptStats.ratios,
        features,
      },
    };
  }
  return {
    action: 'borderline',
    reason_code: 'borderline_actionable',
    debug: {
      dominant_script,
      ratios: scriptStats.ratios,
      features,
    },
  };
}
