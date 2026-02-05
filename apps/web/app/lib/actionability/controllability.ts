/**
 * Controllability gate: detects when intent outcome depends on others/external factors.
 * Heuristic-first; micro LLM fallback only when level === 'medium' or confidence < threshold.
 * All code/comments in English.
 */

import type { ControllabilityResult, ControllabilityLevel, ControllabilityReasonCode } from './types';
import type { CategoryId } from '../taxonomy/categories';

const CONFIDENCE_HIGH = 0.85;
const CONFIDENCE_MEDIUM = 0.6;

/** Actionable frame: "in 30 days", "daily", "practice", "learn", "study", "prepare", "apply" => reduce low. */
const GUARD_ACTIONABLE_FRAME =
  /\d+\s*(jours?|days?|mois|months?|semaines?|weeks?|minutes?|heures?|hours?|min\s*\/\s*jour|per\s*day)|(en|in)\s+\d+\s*(jours?|days?|mois|months?)/i;
const GUARD_ACTION_VERBS =
  /\b(practice|train|learning|learn|study|studying|prepare|preparing|apply|applying|improve|améliorer|pratiquer|s'entraîner|étudier|练习|学习|연습|勉強)\b/i;

/** Relationship / romantic outcome: "get my ex back", "récupérer mon ex", "take back my ex", FR/ES/EN + basic CJK/Hangul. */
const PATTERNS_ROMANTIC: Array<{ re: RegExp; reason: ControllabilityReasonCode }> = [
  { re: /\b(get|récupérer|recover|reconquérir)\s+(my\s+ex|mon\s+ex|ma\s+ex|him|her|back)\b/i, reason: 'romantic_outcome' },
  { re: /\b(take|bring|get)\s+back\s+(my\s+ex|mon\s+ex|ma\s+ex|him|her)\b/i, reason: 'romantic_outcome' },
  { re: /\b(make|faire)\s+(her|him|them|someone)\s+(love|come\s+back|return)\b/i, reason: 'romantic_outcome' },
  { re: /\b(ex\s+copine|ex\s+copain|mon\s+ex|my\s+ex)\b.*\b(récupérer|back|recover)\b/i, reason: 'romantic_outcome' },
  { re: /\b(force|forcer)\b.*\b(love|come\s+back)\b/i, reason: 'depends_on_other_people' },
  { re: /挽回|復縁|재결합/i, reason: 'romantic_outcome' },
];

/** Elected / appointed / accepted: "become president", "get hired", "get admitted", "win election". */
const PATTERNS_APPROVAL: Array<{ re: RegExp; reason: ControllabilityReasonCode }> = [
  { re: /\b(become|devenir)\s+(president|président|prime\s+minister)\b/i, reason: 'approval_or_selection' },
  { re: /\b(get\s+hired|être\s+embauché|être\s+recruté|get\s+the\s+job)\b/i, reason: 'approval_or_selection' },
  { re: /\b(get\s+admitted|be\s+accepted|être\s+accepté)\b/i, reason: 'approval_or_selection' },
  { re: /\b(win\s+the\s+election|win\s+election)\b/i, reason: 'approval_or_selection' },
];

/** Competitive / lottery: "become world champion", "win the lottery", "become #1". */
const PATTERNS_COMPETITIVE: Array<{ re: RegExp; reason: ControllabilityReasonCode }> = [
  { re: /\b(become|devenir)\s+(world\s+champion|champion\s+du\s+monde|#1|number\s+one)\b/i, reason: 'depends_on_random_outcome' },
  { re: /\b(win\s+the\s+lottery|gagner\s+au\s+loto)\b/i, reason: 'depends_on_random_outcome' },
  { re: /\b(become\s+famous|devenir\s+célèbre)\b/i, reason: 'depends_on_other_people' },
];

/** Institution decisions: "get my visa approved", "get citizenship", "court wins". */
const PATTERNS_INSTITUTION: Array<{ re: RegExp; reason: ControllabilityReasonCode }> = [
  { re: /\b(get\s+my\s+visa\s+approved|obtenir\s+mon\s+visa)\b/i, reason: 'depends_on_institution' },
  { re: /\b(get\s+citizenship|obtenir\s+la\s+nationalité)\b/i, reason: 'depends_on_institution' },
  { re: /\b(court\s+win|win\s+the\s+case)\b/i, reason: 'depends_on_institution' },
];

/** Market outcomes: "become billionaire", "double my stock portfolio". */
const PATTERNS_MARKET: Array<{ re: RegExp; reason: ControllabilityReasonCode }> = [
  { re: /\b(become\s+(a\s+)?billionaire|devenir\s+milliardaire)\b/i, reason: 'money_market_outcome' },
  { re: /\b(double\s+my\s+(stock|portfolio)|triple\s+my\s+investments)\b/i, reason: 'money_market_outcome' },
];

/** Life goal / elite role: "become president", "champion du monde" (already covered above; use for meta). */
const PATTERNS_LIFE_GOAL: Array<{ re: RegExp; reason: ControllabilityReasonCode }> = [
  { re: /\b(devenir|become)\s+(président|president|champion\s+du\s+monde|world\s+champion)\b/i, reason: 'life_goal_elite_role' },
];

function matchPatterns(
  trimmed: string,
  patternGroups: Array<Array<{ re: RegExp; reason: ControllabilityReasonCode }>>,
): { reason: ControllabilityReasonCode; matched: boolean } | null {
  for (const group of patternGroups) {
    for (const { re, reason } of group) {
      if (re.test(trimmed)) return { reason, matched: true };
    }
  }
  return null;
}

/**
 * Heuristic controllability detection. Conservative: avoid false positives.
 * When intent contains actionable frame or action verbs, reduce likelihood (return medium).
 */
export function detectControllability(
  intent: string,
  _locale: string,
  _category?: CategoryId,
): ControllabilityResult {
  const trimmed = intent.trim();
  if (!trimmed) {
    return { level: 'high', reason_code: 'unknown', confidence: 1 };
  }

  const hasActionableFrame = GUARD_ACTIONABLE_FRAME.test(trimmed);
  const hasActionVerb = GUARD_ACTION_VERBS.test(trimmed);
  if (hasActionableFrame && hasActionVerb) {
    return { level: 'high', reason_code: 'unknown', confidence: CONFIDENCE_HIGH };
  }

  const allPatterns = [
    PATTERNS_ROMANTIC,
    PATTERNS_APPROVAL,
    PATTERNS_COMPETITIVE,
    PATTERNS_INSTITUTION,
    PATTERNS_MARKET,
    PATTERNS_LIFE_GOAL,
  ];
  const hit = matchPatterns(trimmed, allPatterns);
  if (!hit) {
    return { level: 'high', reason_code: 'unknown', confidence: CONFIDENCE_HIGH };
  }

  if (hasActionableFrame || hasActionVerb) {
    return {
      level: 'medium',
      reason_code: hit.reason,
      confidence: CONFIDENCE_MEDIUM,
      meta: { guarded: true },
    };
  }

  const level: ControllabilityLevel = 'low';
  return {
    level,
    reason_code: hit.reason,
    confidence: CONFIDENCE_HIGH,
    meta: { pattern_group: hit.reason },
  };
}

/** Legacy: map level to CONTROLLED / PARTIALLY_EXTERNAL / EXTERNAL for existing two-path logic. */
export const Controllability = {
  CONTROLLED: 'CONTROLLED',
  PARTIALLY_EXTERNAL: 'PARTIALLY_EXTERNAL',
  EXTERNAL: 'EXTERNAL',
} as const;

export type ControllabilityLevelLegacy = (typeof Controllability)[keyof typeof Controllability];

export type ControllabilityResultLegacy = {
  controllability: ControllabilityLevelLegacy;
  marker?: string;
};

/** For backward compatibility where only CONTROLLED | PARTIALLY_EXTERNAL | EXTERNAL is needed. */
export function detectControllabilityLegacy(intent: string): ControllabilityResultLegacy {
  const result = detectControllability(intent, 'en');
  if (result.level === 'high') return { controllability: 'CONTROLLED' };
  if (result.level === 'low' && result.reason_code === 'romantic_outcome') return { controllability: 'EXTERNAL', marker: result.reason_code };
  if (result.level === 'low') return { controllability: 'PARTIALLY_EXTERNAL', marker: result.reason_code };
  return { controllability: 'PARTIALLY_EXTERNAL', marker: result.reason_code };
}
