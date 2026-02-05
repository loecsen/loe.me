/**
 * Rule doc for Decision Engine selection on Home. V2 by default, legacy fallback only when V2 has no renderable outcome.
 */

import type { RuleDoc } from '../types';

export const ruleDecisionEngineSelection: RuleDoc = {
  id: 'decision_engine_selection',
  gate: 'decision_engine_selection',
  applies_when:
    'Home submit: V2 is used by default (no flag). Overrides: NEXT_PUBLIC_FORCE_LEGACY=1 → legacy only; NEXT_PUBLIC_FORCE_V2=1 → force V2. If V2 returns a non-renderable result (or exception/timeout), fallback to legacy with debug trace decision_engine_fallback and reason (api_error, no_usable_outcome, exception).',
  outcome: 'ok',
  reason_codes: ['api_error', 'no_usable_outcome', 'exception'],
  examples_pass: [
    'No env flags → engine=v2, /api/decision/resolve called first.',
    'V2 returns BLOCKED_SAFETY / SHOW_ANGLES / ASK_CLARIFICATION / etc. → no fallback, outcome displayed.',
    'V2 returns empty or non-renderable → fallback_to_legacy=true, legacy pipeline runs, debug shows fallback_reason.',
  ],
  examples_fail: [
    'Showing "0 réponse" or generic "action + result" when gate is ACTIONABLE.',
    'Fallback for cosmetic reasons; fallback only for no_usable_outcome, api_error, or exception.',
  ],
  notes:
    'Renderable = at least one of: blocked/safety message, clarification question+choices, angles (≥1), realism pending, ambition confirmation, proceedToMission. Debug panel shows engine, fallback_to_legacy, fallback_reason, ui_branch_id.',
};
