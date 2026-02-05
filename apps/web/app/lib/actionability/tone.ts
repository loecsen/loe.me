/**
 * Tone gate: detect playful / nonsense / unclear intents (cheap, deterministic first).
 * Used to route to choose_category or humor_response instead of controllability angles.
 * EN-only for reason codes.
 */

export type ToneResult = 'serious' | 'playful' | 'nonsense' | 'unclear';

export type ToneGateResult = {
  tone: ToneResult;
  confidence: number;
  reason_code: string;
  notes_short?: string;
};

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Single-word food / trivial consumption → playful or nonsense */
const SINGLE_WORD_FOOD = /^\s*[a-zàâäéèêëïîôùûüçñ]+\s*$/i;
const FOOD_WORDS = /\b(pizza|pizzas|burger|ice cream|chocolate|sushi|tacos)\b/i;

/** Fantasy / meme / impossible → playful */
const FANTASY_PATTERNS = [
  /\b(become\s+a\s+dragon|dragon\s+in\s+\d+|turn\s+into\s+a\s+dragon)\b/i,
  /\b(devenir\s+un\s+dragon|dragon)\b/i,
  /\b(100\s+pizzas|eat\s+\d+\s+pizzas|manger\s+\d+\s+pizzas)\b/i,
  /\b(fly\s+to\s+the\s+moon|moon\s+in\s+\d+)\b/i,
];

/** Very short intent (1–2 words, no structure) → unclear or nonsense */
function isVeryShortUnstructured(intent: string): boolean {
  const t = normalize(intent);
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 2) return false;
  if (words.length === 0) return true;
  if (/\d+/.test(t) && (/\d+\s*(days?|jours?|weeks?|semaines?)/i.test(t) || /in\s+\d+|en\s+\d+/i.test(t))) return false;
  return true;
}

/**
 * Deterministic tone detection. No API. Use before category/controllability.
 * Returns playful/nonsense/unclear when confident; else serious (caller may use LLM for doubt).
 */
export function detectToneDeterministic(intent: string, _intentLang?: string): ToneGateResult | null {
  const raw = normalize(intent);
  if (!raw) return { tone: 'unclear', confidence: 1, reason_code: 'empty' };

  for (const re of FANTASY_PATTERNS) {
    if (re.test(raw)) return { tone: 'playful', confidence: 0.95, reason_code: 'fantasy_playful' };
  }

  if (FOOD_WORDS.test(raw) && (SINGLE_WORD_FOOD.test(raw) || /eat\s+\d+|manger\s+\d+|100\s+pizzas/i.test(raw))) {
    return { tone: 'playful', confidence: 0.9, reason_code: 'food_trivial' };
  }

  if (raw.split(/\s+/).filter(Boolean).length === 1) {
    const w = raw;
    if (/^(pizza|burger|sushi|tacos|chocolate|dragon)$/i.test(w)) {
      return { tone: 'nonsense', confidence: 0.9, reason_code: 'single_word_trivial' };
    }
    return { tone: 'unclear', confidence: 0.7, reason_code: 'single_word_unclear' };
  }

  return null;
}
