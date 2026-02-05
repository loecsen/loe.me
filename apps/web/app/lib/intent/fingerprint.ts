/**
 * Deterministic intent fingerprint for similarity/cache lookup.
 * No LLM; category-aware (LEARN strips weak verbs + stopwords so "apprendre à faire de la couture" → couture).
 */

export const FINGERPRINT_ALGO = 'fp_v1';

const FR_STOPWORDS = new Set([
  'à', 'a', 'au', 'aux', 'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', "d'", 'd’', 'en', 'pour', 'comment',
  'et', 'ou', 'que', 'qui', 'dans', 'sur', 'avec', 'par', 'sans', 'sous', 'entre', 'vers', 'chez',
]);
const EN_STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'and', 'or', 'how',
]);
/** Weak verbs / filler to strip so LEARN intents collapse to subject (e.g. "apprendre la couture" → couture). */
const WEAK_VERBS = new Set([
  'apprendre', 'learn', 'study', 'improve', 'pratiquer', 'practice', 'faire', 'do', 'become', 'devenir',
  'vouloir', 'want', 'get', 'master', 'maîtriser', 'understand', 'comprendre', 'know', 'savoir',
]);

function stripAccentsLatin(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function tokenize(s: string): string[] {
  const normalized = s
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];
  return normalized.split(' ').filter((t) => t.length > 0);
}

function isLatinLang(lang: string): boolean {
  const l = lang.toLowerCase().slice(0, 2);
  return l === 'fr' || l === 'en' || l === 'es' || l === 'de' || l === 'it';
}

export type IntentFingerprintResult = {
  fp: string;
  algo: string;
  tokens: string[];
};

/**
 * Compute deterministic fingerprint for similarity lookup.
 * Pre-category (category=null): use language stopwords + weak verbs so "apprendre à faire de la couture" and "apprendre la couture" → same fp.
 * LEARN: same plus strip weak verbs so core subject remains.
 */
export function computeIntentFingerprint(
  intent: string,
  intentLang: string,
  category?: string | null,
): IntentFingerprintResult {
  const lang = intentLang?.toLowerCase().slice(0, 2) ?? 'en';
  const stripAccents = isLatinLang(lang);
  let tokens = tokenize(intent);
  if (stripAccents) {
    tokens = tokens.map((t) => stripAccentsLatin(t));
  }

  const stopwords = lang === 'fr' ? FR_STOPWORDS : lang === 'en' ? EN_STOPWORDS : new Set([...FR_STOPWORDS, ...EN_STOPWORDS]);
  const isLearn = category?.toUpperCase() === 'LEARN';

  // Remove "à faire" / "to do" pattern so "apprendre à faire X" → X (for LEARN or generic)
  const dropPattern: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if ((tokens[i] === 'à' || tokens[i] === 'a') && (tokens[i + 1] === 'faire' || tokens[i + 1] === 'do')) {
      dropPattern.push(tokens[i], tokens[i + 1]);
    }
  }
  const dropSet = new Set(dropPattern);
  tokens = tokens.filter((t) => !dropSet.has(t));

  tokens = tokens.filter((t) => {
    if (stopwords.has(t)) return false;
    if (isLearn && WEAK_VERBS.has(t)) return false;
    if (!isLearn && WEAK_VERBS.has(t)) return false; // strip weak verbs for generic too so "apprendre X" → X
    return true;
  });

  const unique = [...new Set(tokens)].sort();
  const fp = unique.length > 0 ? unique.join('_') : '';
  return { fp, algo: FINGERPRINT_ALGO, tokens: unique };
}
