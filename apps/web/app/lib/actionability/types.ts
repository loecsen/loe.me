/**
 * Actionability and controllability contracts.
 * mode is always "inline" (no dedicated page / redirect).
 */

/** Controllability gate: outcome depends on user vs external. */
export type ControllabilityLevel = 'high' | 'medium' | 'low';

export type ControllabilityReasonCode =
  | 'depends_on_other_people'
  | 'depends_on_institution'
  | 'depends_on_random_outcome'
  | 'life_goal_elite_role'
  | 'romantic_outcome'
  | 'approval_or_selection'
  | 'health_outcome_external'
  | 'money_market_outcome'
  | 'unknown';

export interface ControllabilityResult {
  level: ControllabilityLevel;
  reason_code: ControllabilityReasonCode;
  confidence: number;
  meta?: Record<string, unknown>;
}

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
  | 'classifier_error'
  | 'safety_no_suggestion'
  | 'blocked';

export type ActionabilityGateResult = {
  status: ActionabilityStatus;
  reason_code: ActionabilityReasonCode;
  mode: 'inline';
  normalized_intent?: string;
  suggested_rephrase?: string | null;
  category?: string;
  debug?: {
    dominant_script?: string;
    ratios?: Record<string, number>;
    features?: Record<string, unknown>;
    category?: string;
  };
};
