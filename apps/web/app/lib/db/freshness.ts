/**
 * Freshness per gate: cache hits only within window.
 * Controllability: 60–90 days (human patterns don't change fast).
 * Classify NEEDS_REPHRASE / BLOCKED / safety_no_suggestion: 7–14 days (prompts/rules tweaked often).
 * Classify ACTIONABLE: 14 days.
 */

import type { DecisionGateKind } from './types';
import type { DecisionVerdict } from './types';

const MS_DAY = 24 * 60 * 60 * 1000;

/** Freshness window in ms for (gate, verdict). */
export function getFreshnessMsForGate(
  gate: DecisionGateKind,
  verdict?: DecisionVerdict | null,
): number {
  if (gate === 'controllability') {
    return 90 * MS_DAY;
  }
  if (gate === 'classify') {
    if (verdict === 'NEEDS_CLARIFY' || verdict === 'BLOCKED') return 14 * MS_DAY;
    if (verdict === 'ACTIONABLE') return 14 * MS_DAY;
    return 7 * MS_DAY; // safety_no_suggestion etc.
  }
  if (gate === 'realism_ambition') return 14 * MS_DAY;
  // Decision Engine V2 gates
  if (gate === 'safety') return 7 * MS_DAY;
  if (
    gate === 'equivalence' ||
    gate === 'category' ||
    gate === 'tone' ||
    gate === 'category_analysis' ||
    gate === 'realism' ||
    gate === 'decision_engine' ||
    gate === 'audience_safety' ||
    gate === 'clarify_chips'
  ) {
    return 14 * MS_DAY;
  }
  return 14 * MS_DAY;
}

export function isRecordFresh(
  updatedAt: string,
  gate: DecisionGateKind,
  verdict?: DecisionVerdict | null,
): boolean {
  const ms = new Date(updatedAt).getTime();
  const windowMs = getFreshnessMsForGate(gate, verdict);
  return Date.now() - ms < windowMs;
}
