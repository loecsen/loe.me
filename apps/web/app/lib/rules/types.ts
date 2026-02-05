/**
 * Types for the rules registry (single source of truth for Admin rules page).
 * RuleDoc = documentation + inventory; logic stays in actionability.ts, realism.ts, etc.
 */

export type RuleGate =
  | 'actionability_v2'
  | 'classifier'
  | 'category'
  | 'realism_soft'
  | 'confirmation'
  | 'controllability'
  | 'language_policy'
  | 'lexicon'
  | 'decision_db'
  | 'decision_engine_selection'
  | 'audience_safety'
  | 'ui_copy_variants';

export type RuleOutcome =
  | 'ACTIONABLE'
  | 'BORDERLINE'
  | 'NOT_ACTIONABLE_INLINE'
  | 'NEEDS_REPHRASE_INLINE'
  | 'BLOCKED'
  | 'CONFIRMATION'
  | 'ok'
  | 'stretch'
  | 'unrealistic'
  | 'controllability_support';

export type RuleDoc = {
  id: string;
  gate: RuleGate;
  applies_when: string;
  outcome: RuleOutcome | string;
  reason_codes: string[];
  category_behavior?: 'requires feasibility' | 'no feasibility' | string;
  examples_pass: string[];
  examples_fail: string[];
  notes?: string;
};
