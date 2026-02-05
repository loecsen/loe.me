/**
 * Decision Engine V2 — types.
 * DB-first, cheap AI when uncertain. All docs in English.
 */

import type { CategoryId } from '../taxonomy/categories';

/** Outcome of the decision pipeline. Home renders from this. */
export type DecisionOutcome =
  | 'PROCEED_TO_GENERATE'
  | 'SHOW_ANGLES'
  | 'ASK_CLARIFICATION'
  | 'CONFIRM_AMBITION'
  | 'ASK_USER_CHOOSE_CATEGORY'
  | 'REALISM_ADJUST'
  | 'BLOCKED_SAFETY'
  | 'PLAYFUL_OR_NONSENSE';

/** Angle: label in ui_locale, next_intent in intent_lang. */
export type DecisionAngle = {
  label: string;
  next_intent: string;
  days?: number;
};

/** Payload for PROCEED_TO_GENERATE. */
export type PayloadProceed = {
  rewritten_intent?: string;
  /** When true, rewritten_intent already includes days (v2 reformulation); do not append suffix. */
  reformulation_includes_days?: boolean;
  /** Short guide-style title (no days), for confirmation screen. */
  guide_title?: string;
  /** Up to 3 precise objectives or one summary phrase, in intent language. */
  objectives?: string[];
  days: number;
  category?: CategoryId;
  realism_acknowledged?: boolean;
};

/** Payload for SHOW_ANGLES. */
export type PayloadAngles = {
  primary: string;
  secondary?: string;
  angles: DecisionAngle[];
  original_intent: string;
  rewritten_intent?: string | null;
  /** When true, rewritten_intent already includes days (v2 reformulation); do not append suffix. */
  reformulation_includes_days?: boolean;
};

/** Payload for ASK_CLARIFICATION. */
export type PayloadClarify = {
  clarify_question: string;
  suggested_rewrites?: DecisionAngle[];
};

/** Payload for CONFIRM_AMBITION. */
export type PayloadConfirmAmbition = {
  intent: string;
  days: number;
  marker?: string;
};

/** Payload for ASK_USER_CHOOSE_CATEGORY. */
export type PayloadChooseCategory = {
  suggestions: Array<{ category: CategoryId; label_key: string }>;
};

/** Payload for REALISM_ADJUST (Keep / Adjust). */
export type PayloadRealismAdjust = {
  why_short: string;
  adjustments?: Array<{ label: string; next_intent: string; next_days?: number }>;
  intentionToSend?: string;
  days: number;
  category?: CategoryId;
};

/** Payload for BLOCKED_SAFETY. */
export type PayloadBlocked = {
  reason_code?: string;
  message_key?: string;
};

/** Payload for PLAYFUL_OR_NONSENSE (humor / trivial intent). */
export type PayloadPlayfulOrNonsense = {
  message_key?: string;
  tone?: string;
  reason_code?: string;
};

export type DecisionPayload =
  | PayloadProceed
  | PayloadAngles
  | PayloadClarify
  | PayloadConfirmAmbition
  | PayloadChooseCategory
  | PayloadRealismAdjust
  | PayloadBlocked
  | PayloadPlayfulOrNonsense;

export type DecisionEngineInput = {
  intent: string;
  days: number;
  ui_locale: string;
  /** When true, skip clarification/angles and proceed to generation flow. */
  force_proceed?: boolean;
};

export type PromptTraceEntry = { prompt_name: string; response: string };

export type DecisionEngineOutput = {
  outcome: DecisionOutcome;
  payload: DecisionPayload;
  /** For dev/debug only. */
  debug?: {
    branch: string;
    gate_status?: string;
    category?: string;
    policy_version?: string;
    from_cache?: boolean;
    equivalence_used?: boolean;
    /** Fingerprint similarity hit (fp match + days_bucket). */
    similarity_hit?: boolean;
    matched_record_id?: string;
    fingerprint?: string;
  };
  /** Prompts actually called this run + raw LLM response (dev-only, when collectPromptTrace). */
  prompt_trace?: PromptTraceEntry[];
};

/** Preprocessed intent + context for cache key and judges. */
export type PreprocessedInput = {
  normalized_intent: string;
  intent_lang: string;
  ui_locale: string;
  days: number;
  days_bucket: string;
  policy_version: string;
  schema_version: string;
};
