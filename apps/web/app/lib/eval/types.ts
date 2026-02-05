/**
 * Evaluation Harness — types.
 * Dev-only. Single source of truth for scenario + run result shapes.
 */

/** Optional partial expectations for a scenario (regression detection). */
export type EvalScenarioExpectedV1 = {
  category?: string;
  sub_category?: string;
  audience_safety_level?: 'all_ages' | 'adult_only' | 'blocked';
  should_show_angles?: boolean;
  should_block?: boolean;
  tone?: 'serious' | 'humorous' | 'neutral' | 'supportive';
  notes?: string;
};

/** One evaluation scenario: intent + context + optional expectations. */
export type EvalScenarioV1 = {
  id: string;
  title_en: string;
  intent: string;
  timeframe_days: number;
  intent_lang: string;
  ui_locale: string;
  expected?: EvalScenarioExpectedV1;
  tags: string[];
};

/** UI outcome chosen by the pipeline (which block would be shown). */
export type EvalUiOutcome =
  | 'blocked'
  | 'needs_clarify'
  | 'show_angles'
  | 'show_ambition_confirm'
  | 'show_realism_adjust'
  | 'choose_category'
  | 'playful_nonsense'
  | 'proceed';

/** Gate trace entry for timeline. */
export type EvalGateTraceEntry = {
  gate: string;
  outcome?: string;
  reason_code?: string;
  confidence?: number;
  from_cache?: boolean;
  at: string;
};

/** Full pipeline trace + final outcome for one run. */
export type EvalRunResultV1 = {
  eval_run_id: string;
  scenario_id: string;
  scenario: EvalScenarioV1;
  policy_version: string;
  /** Engine version / config hint for reproducibility. */
  engine_version?: string;

  /** Final UI outcome. */
  ui_outcome: EvalUiOutcome;
  /** Gate trace timeline. */
  gate_trace: EvalGateTraceEntry[];

  /** Decision engine outcome + payload (raw). */
  decision_outcome?: string;
  decision_payload?: Record<string, unknown>;
  decision_debug?: Record<string, unknown>;

  /** Category / subcategory chosen. */
  category?: string;
  sub_category?: string | null;

  /** Audience safety. */
  audience_safety_level?: 'all_ages' | 'adult_only' | 'blocked';
  audience_safety_from_cache?: boolean;

  /** Controllability. */
  controllability_level?: string;
  controllability_reason_code?: string;
  controllability_from_cache?: boolean;

  /** Realism (if applicable). */
  realism_result?: 'realistic' | 'unrealistic' | null;
  realism_why_short?: string | null;

  /** Tone / aspiration (if available). */
  tone?: string | null;

  /** Final suggestions shown (angles chips, rewrites, adjusted days). */
  suggestions?: {
    angles?: Array<{ label: string; next_intent: string; days?: number }>;
    rewrites?: Array<{ label: string; next_intent: string }>;
    adjusted_days?: number | null;
  } | null;

  /** Classification payloads (classify response, audience_safety response, lexicon pack). */
  classification?: Record<string, unknown> | null;

  /** Copy variant used for support/angles block (from resolveCopyVariant). */
  copy_variant?: string | null;
  /** Short English explanation of why this variant was chosen. */
  copy_debug_why?: string | null;

  created_at: string;
  updated_at: string;

  /** Future: manual review. */
  review_status?: 'pending' | 'good' | 'bad' | null;
  review_notes_en?: string | null;
};
