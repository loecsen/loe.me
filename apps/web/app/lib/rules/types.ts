/**
 * Types for the rules registry (single source of truth for Admin rules page).
 * RuleDoc = documentation + inventory; logic stays in actionability.ts, realism.ts, etc.
 */

export type RuleGate =
  | 'actionability_v2'
  | 'classifier'
  | 'category'
  | 'realism_soft'
  | 'confirmation';

export type RuleOutcome =
  | 'ACTIONABLE'
  | 'BORDERLINE'
  | 'NOT_ACTIONABLE_INLINE'
  | 'NEEDS_REPHRASE_INLINE'
  | 'BLOCKED'
  | 'CONFIRMATION'
  | 'ok'
  | 'stretch'
  | 'unrealistic';

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
