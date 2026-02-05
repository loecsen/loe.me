/**
 * Heuristics for elite/extreme life-goal aspirations (client-only).
 * Block "Tu confirmes ?" only for elite/superlative aspirations, not normal jobs.
 * - Guards: actionable frame or learning verb => hit=false.
 * - Intercept = true only if: (A) superlative/absolute OR (B) role in ELITE_ROLES.
 */

export type LangHint = 'fr' | 'en' | 'es' | 'zh' | 'ko' | 'ja' | 'other';

export type LifeGoalResult = {
  hit: boolean;
  marker?: string;
  langHint?: LangHint;
};

/** Guard: intent contains actionable frame (en X jours, for X days, minutes par jour, etc.) => no intercept */
const GUARD_ACTIONABLE_FRAME =
  /\d+\s*(jours?|days?|mois|months?|semaines?|weeks?|minutes?|heures?|hours?|min\s*\/\s*jour|per\s*day)|(en|in|for)\s+\d+\s*(jours?|days?|mois|months?)|(write|ship|learn|speak|improve|build|create|prepare)\s+.*\s+(in|en|for)\s+\d+/i;

/** Guard: intent contains concrete learning/training verb => no intercept */
const GUARD_LEARNING_VERB =
  /\b(apprendre|s'entraîner|s'entrainer|entraîner|entrainer|pratiquer|améliorer|improve|train|training|learn|learning|study|étudier|studier|练习|学习|연습|勉強)\b/i;

/**
 * Intercept only if intent contains one of these (elite roles or superlative/absolute).
 * Order: more specific first.
 */
const ELITE_OR_SUPERLATIVE_PATTERNS: Array<{ re: RegExp; marker: string; langHint: LangHint }> = [
  // FR — rôles élite
  { re: /\b(président|présidente)\s+de\s+la\s+république\b/i, marker: 'président de la république', langHint: 'fr' },
  { re: /\bpremier\s+ministre\b/i, marker: 'premier ministre', langHint: 'fr' },
  { re: /\bme\s+faire\s+élire\b/i, marker: 'me faire élire', langHint: 'fr' },
  { re: /\baccéder\s+à\s+(la\s+)?(présidence|direction)\b/i, marker: 'accéder à', langHint: 'fr' },
  { re: /\b(devenir|être)\s+(président|présidente|ministre|député|maire|PDG|CEO)\b/i, marker: 'devenir/être rôle', langHint: 'fr' },
  { re: /\bobtenir\s+(un\s+)?(prix\s+nobel|oscar)\b/i, marker: 'obtenir Nobel/Oscar', langHint: 'fr' },
  { re: /\b(prix\s+nobel|oscar|Oscar)\b/i, marker: 'prix Nobel/Oscar', langHint: 'fr' },
  // FR — superlatifs / absolus
  { re: /\bchampion\s+du\s+monde\b/i, marker: 'champion du monde', langHint: 'fr' },
  { re: /\b(milliardaire|millionnaire)\b/i, marker: 'milliardaire/millionnaire', langHint: 'fr' },
  { re: /\b(le\s+)?meilleur\b/i, marker: 'meilleur', langHint: 'fr' },
  { re: /\bcélèbre\b/i, marker: 'célèbre', langHint: 'fr' },
  { re: /\b(devenir|être)\s+star\b/i, marker: 'star', langHint: 'fr' },
  // EN — elite roles / selection
  { re: /\bget\s+accepted\s+to\s+(harvard|stanford|mit|ivy\s+league)\b/i, marker: 'get accepted', langHint: 'en' },
  { re: /\b(harvard|stanford|mit|ivy\s+league)\b/i, marker: 'elite institution', langHint: 'en' },
  { re: /\bbecome\s+(a\s+)?(president|billionaire|millionaire|world\s+champion|CEO|prime\s+minister|astronaut)\b/i, marker: 'become', langHint: 'en' },
  { re: /\b(president|billionaire|world\s+champion)\s+(of\s+the\s+)?(country|world)?\b/i, marker: 'president/billionaire', langHint: 'en' },
  { re: /\bwin\s+(a\s+)?(nobel|oscar)\b/i, marker: 'win nobel/oscar', langHint: 'en' },
  { re: /\bnobel\s+prize\b/i, marker: 'nobel prize', langHint: 'en' },
  // EN — superlatives / absolus
  { re: /\b(world-class|#1|GOAT|the\s+best)\b/i, marker: 'world-class/#1/GOAT/best', langHint: 'en' },
  { re: /\bfamous\b/i, marker: 'famous', langHint: 'en' },
  // ES
  { re: /\b(convertirme|ser)\s+en\s+(presidente?|millonario|campeón)\b/i, marker: 'convertirme/ser', langHint: 'es' },
  { re: /\b(presidente|millonario|premio\s+nobel)\b/i, marker: 'presidente/millonario/nobel', langHint: 'es' },
  // ZH
  { re: /成为(总统|亿万?富翁|诺贝尔)/, marker: '成为', langHint: 'zh' },
  { re: /当上(总统|总理)/, marker: '当上', langHint: 'zh' },
  { re: /(总统|亿万?富翁|诺贝尔)/, marker: '总统/亿万富翁/诺贝尔', langHint: 'zh' },
  // KO
  { re: /대통령/, marker: '대통령', langHint: 'ko' },
  { re: /억만장자/, marker: '억만장자', langHint: 'ko' },
  // JA
  { re: /大統領/, marker: '大統領', langHint: 'ja' },
  { re: /億万長者/, marker: '億万長者', langHint: 'ja' },
];

/**
 * Detects elite/extreme life-goal aspirations only. Normal jobs (pet sitter, developer, etc.) => hit=false.
 * Guards: actionable frame or learning verb => hit=false.
 * Intercept only if intent contains a superlative/absolute or a role from ELITE_ROLES.
 */
export function isLifeGoalOrRoleAspiration(intent: string): LifeGoalResult {
  const trimmed = intent.trim();
  if (!trimmed) return { hit: false };

  if (GUARD_ACTIONABLE_FRAME.test(trimmed)) return { hit: false };
  if (GUARD_LEARNING_VERB.test(trimmed)) return { hit: false };

  for (const { re, marker, langHint } of ELITE_OR_SUPERLATIVE_PATTERNS) {
    if (re.test(trimmed)) return { hit: true, marker, langHint };
  }
  return { hit: false };
}

const ELITE_OR_SUPERLATIVE_REGEXES = ELITE_OR_SUPERLATIVE_PATTERNS.map((p) => p.re);

export function needsAmbitionConfirmation(intent: string): boolean {
  const trimmed = intent.trim();
  if (!trimmed) return false;
  if (GUARD_ACTIONABLE_FRAME.test(trimmed)) return false;
  if (GUARD_LEARNING_VERB.test(trimmed)) return false;
  return ELITE_OR_SUPERLATIVE_REGEXES.some((re) => re.test(trimmed));
}
