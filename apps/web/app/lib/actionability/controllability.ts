/**
 * Controllability axis: outcome depends on user vs on others.
 * Lightweight heuristic only; no LLM calls.
 * Used with WELLBEING + classify to choose INLINE_TWO_PATHS_CONTROL playbook.
 */

export const Controllability = {
  CONTROLLED: 'CONTROLLED',
  PARTIALLY_EXTERNAL: 'PARTIALLY_EXTERNAL',
  EXTERNAL: 'EXTERNAL',
} as const;

export type ControllabilityLevel = (typeof Controllability)[keyof typeof Controllability];

export type ControllabilityResult = {
  controllability: ControllabilityLevel;
  marker?: string;
};

/** "Make someone do X" / "force" => EXTERNAL */
const EXTERNAL_PATTERNS: Array<{ re: RegExp; marker: string }> = [
  { re: /\b(make|forcer|forçar|hacer\s+que|make\s+someone)\s+(my\s+ex|him|her|them|someone)\s+(love|come\s+back|return)\b/i, marker: 'make someone' },
  { re: /\b(force|forcer|obliger)\b/i, marker: 'force' },
  { re: /\b(faire\s+en\s+sorte\s+que|pour\s+qu['']il|pour\s+qu['']elle)\b/i, marker: 'faire en sorte' },
];

/** "Get my ex back", "get hired", "become famous" => PARTIALLY_EXTERNAL */
const PARTIALLY_EXTERNAL_PATTERNS: Array<{ re: RegExp; marker: string }> = [
  { re: /\b(get|récupérer|recover|reconquérir)\s+(my\s+ex|him|her|back)\b/i, marker: 'get ex back' },
  { re: /\b(get\s+hired|être\s+embauché|être\s+recruté)\b/i, marker: 'get hired' },
  { re: /\b(become\s+famous|devenir\s+célèbre|devenir\s+connu)\b/i, marker: 'become famous' },
  { re: /\b(become\s+president|devenir\s+président|win\s+the\s+election)\b/i, marker: 'become president' },
  { re: /\b(win\s+(a\s+)?(nobel|oscar|prize))\b/i, marker: 'win prize' },
  { re: /\b(obtenir\s+(un\s+)?(prix|poste|job))\b/i, marker: 'obtenir' },
  { re: /\b(ex\s+copine|ex\s+copain|mon\s+ex|my\s+ex)\b/i, marker: 'ex partner' },
  { re: /\b(triste|sad|récupérer|recover)\b.*\b(ex|back|récupérer)\b/i, marker: 'sad/recover ex' },
];

export function detectControllability(intent: string): ControllabilityResult {
  const trimmed = intent.trim();
  if (!trimmed) return { controllability: 'CONTROLLED' };

  for (const { re, marker } of EXTERNAL_PATTERNS) {
    if (re.test(trimmed)) return { controllability: 'EXTERNAL', marker };
  }
  for (const { re, marker } of PARTIALLY_EXTERNAL_PATTERNS) {
    if (re.test(trimmed)) return { controllability: 'PARTIALLY_EXTERNAL', marker };
  }
  return { controllability: 'CONTROLLED' };
}
