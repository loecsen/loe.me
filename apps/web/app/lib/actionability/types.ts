/**
 * Contrat unique du gate actionability (rule-based + LLM fallback).
 * mode est toujours "inline" (pas de page / redirect).
 */

export type ActionabilityStatus =
  | 'BLOCKED'
  | 'NOT_ACTIONABLE_INLINE'
  | 'BORDERLINE'
  | 'ACTIONABLE';

export type ActionabilityReasonCode =
  | 'too_vague'
  | 'social_chitchat'
  | 'pure_noun_topic'
  | 'no_action_or_outcome'
  | 'ambiguous_goal'
  | 'noise'
  | 'too_short_cjk'
  | 'single_term'
  | 'borderline_actionable'
  | 'ok'
  | 'actionable'
  | 'classifier_error';

export type ActionabilityGateResult = {
  status: ActionabilityStatus;
  reason_code: ActionabilityReasonCode;
  mode: 'inline';
  normalized_intent?: string;
  suggested_rephrase?: string | null;
  debug?: {
    dominant_script?: string;
    ratios?: Record<string, number>;
    features?: Record<string, unknown>;
  };
};
