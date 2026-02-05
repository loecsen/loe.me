/**
 * Dev-only local DB types. Postgres-friendly shapes; stored as NDJSON.
 * English-only for notes_en, purpose_en, safety_notes_en.
 */

export const DECISION_RECORD_SCHEMA_VERSION = 'decision-record-v1';
export const PROMPT_CATALOG_SCHEMA_VERSION = 'prompt-catalog-v1';

export type DecisionVerdict = 'ACTIONABLE' | 'NEEDS_CLARIFY' | 'BLOCKED';

export type DecisionRecordGates = {
  actionability?: string;
  controllability?: string;
  realism?: string;
  ambition?: string;
  safety?: string;
  audience_safety?: string;
  tone?: string;
  clarify_chips?: string;
};

export type DecisionSuggestionAngle = {
  label: string; // ui_locale
  next_intent: string; // intent_lang
};

export type DecisionSuggestions = {
  rewritten_intent?: string; // intent_lang
  angles?: DecisionSuggestionAngle[];
};

export type DecisionRecordV1 = {
  id: string;
  schema_version: typeof DECISION_RECORD_SCHEMA_VERSION;
  created_at: string;
  updated_at: string;
  intent_raw: string;
  intent_lang: string;
  ui_locale: string;
  days: number;
  category?: string | null;
  gates: DecisionRecordGates;
  verdict: DecisionVerdict;
  reason_code?: string | null;
  suggestions: DecisionSuggestions;
  notes_en?: string;
  model?: { provider: string; model: string; prompt_id?: string; cost_hint?: string };
  unique_key: string;
  context_hash: string;
  confidence?: number;
  /** Policy version at record time; bump when rules/prompts change. */
  policy_version?: string;
  /** Gate that produced this decision. Decision Engine V2 adds: equivalence | safety | category | tone | category_analysis | realism | decision_engine */
  gate?:
    | 'classify'
    | 'controllability'
    | 'realism_ambition'
    | 'equivalence'
    | 'safety'
    | 'category'
    | 'tone'
    | 'category_analysis'
    | 'realism'
    | 'decision_engine'
    | 'audience_safety'
    | 'clarify_chips';
  /** For ACTIONABLE reuse: normalized intent from classifier */
  normalized_intent?: string;
  /** For ACTIONABLE reuse: realism short reason */
  realism_why_short?: string;
  /** For ACTIONABLE reuse: realism adjustments */
  realism_adjustments?: Array<{ label: string; intent: string; days?: number }>;
  /** Decision Engine V2: outcome + payload for cache replay */
  engine_outcome?: string;
  engine_payload?: Record<string, unknown>;
  /** For similarity lookup: deterministic fingerprint (e.g. fp_v1). Not part of unique_key. */
  intent_fingerprint?: string;
  intent_fingerprint_algo?: string;
};

export type PromptCatalogEntryV1 = {
  id: string;
  schema_version: typeof PROMPT_CATALOG_SCHEMA_VERSION;
  created_at: string;
  updated_at: string;
  /** Stable identifier used in code (same as name). */
  name: string;
  version: string;
  /** Semver-like or prompt rev, e.g. "1.0.0" or "2026-01-31". */
  version_semver?: string;
  purpose_en: string;
  where_used: string[];
  prompt_text: string;
  /** JSON schema-ish: { intent, intent_lang, ui_locale, days, category, ... }. */
  input_schema?: Record<string, unknown>;
  /** Shape: e.g. { level, reason_code, angles[], rewritten_intent }. */
  output_schema?: Record<string, unknown>;
  tags: string[];
  /** Target token budget, e.g. 80 or 120. */
  token_budget_target?: number;
  safety_notes_en?: string;
};

/** Clarify chips cache entry (dev-only). No raw intent stored. */
export type ClarifyChipsCacheEntry = {
  id: string;
  cache_key: string;
  prompt_version: string;
  template_key: string;
  lang: string;
  days: number;
  value_json: Record<string, unknown>;
  created_at: string;
  expires_at: string;
};

/** Gate that produced the decision. Decision Engine V2 adds new kinds. */
export type DecisionGateKind =
  | 'classify'
  | 'controllability'
  | 'realism_ambition'
  | 'equivalence'
  | 'safety'
  | 'category'
  | 'tone'
  | 'category_analysis'
  | 'realism'
  | 'decision_engine'
  | 'audience_safety'
  | 'clarify_chips';

/** Unique key parts for debugging. */
export type DecisionUniqueKeyParts = {
  intent_normalized: string;
  intent_lang: string;
  category: string | null;
  days_bucket: string;
  requires_feasibility: boolean;
  gate: DecisionGateKind;
  policy_version: string;
  schema_version: string;
  gate_context_hash: string;
};

export type BuildDecisionKeyInput = {
  intent: string;
  intent_lang: string;
  category?: string | null;
  days?: number;
  gate: DecisionGateKind;
  policy_version?: string;
  schema_version?: string;
  context_flags?: { requires_feasibility?: boolean };
};

export type BuildDecisionKeyResult = {
  unique_key: string;
  context_hash: string;
  key_parts?: DecisionUniqueKeyParts;
};

/** Repository interface; later swap to PostgresDecisionStore. */
export interface DecisionStore {
  getById(id: string): Promise<DecisionRecordV1 | null>;
  getByUniqueKey(uniqueKey: string, contextHash: string): Promise<DecisionRecordV1 | null>;
  upsert(record: DecisionRecordV1): Promise<void>;
  search(params: {
    intent_substring?: string;
    category?: string;
    intent_lang?: string;
    gate?: string;
    intent_fingerprint?: string;
    days_bucket?: string;
    policy_version?: string;
    limit?: number;
  }): Promise<DecisionRecordV1[]>;
  list(limit: number): Promise<DecisionRecordV1[]>;
}

/** Idea routine (suggested routine chip). V1 dev-only; NDJSON table idea_routines. */
export type IdeaRoutineCategory = 'LEARN' | 'CREATE' | 'PERFORM' | 'WELLBEING' | 'SOCIAL' | 'CHALLENGE';

export type IdeaRoutineV1 = {
  id: string;
  category: IdeaRoutineCategory;
  subcategory?: string | null;
  canonical_lang: 'en';
  title_en: string;
  intent_en: string;
  translations?: Record<string, { title: string; intent: string }>;
  created_at: string;
  updated_at: string;
  source: 'seed' | 'llm';
  tags?: string[];
};

/** Community ritual (beta seed). Read from PourLaMaquette/community-rituals. */
export type CommunityRitualV1 = {
  id: string;
  category: IdeaRoutineCategory;
  ui_locale: string;
  title: string;
  description: string;
  days: number;
  image_ref?: string | null;
  rating?: number | null;
  levels?: string | null;
  participants?: number | null;
  community_progress?: number | null;
};

/** Repository interface; later swap to PostgresPromptStore. */
export interface PromptStore {
  getByNameVersion(name: string, version: string): Promise<PromptCatalogEntryV1 | null>;
  getById(id: string): Promise<PromptCatalogEntryV1 | null>;
  upsert(entry: PromptCatalogEntryV1): Promise<void>;
  list(limit?: number): Promise<PromptCatalogEntryV1[]>;
}

/** One tier of routing: which provider/model/base_url to use for that usage (default vs reasoning). */
export type DevLlmRoutingTierConfig = {
  provider?: 'openai' | 'qwen';
  model?: string;
  base_url?: string;
};

/** Dev-only LLM playground defaults. Stored in PourLaMaquette/db/llm_settings.json. Never store API key. */
export type DevLlmSettingsV1 = {
  version: 'dev-llm-settings-v1';
  updated_at: string;
  provider: 'openai' | 'qwen';
  model?: string;
  base_url?: string;
  pricing?: Record<string, { input_per_1k: number; output_per_1k: number }>;
  /** Per-tier config: default (light), reasoning (heavy), fast (cheap/micro). Empty = use site default. */
  routing?: {
    default?: DevLlmRoutingTierConfig;
    reasoning?: DevLlmRoutingTierConfig;
    fast?: DevLlmRoutingTierConfig;
  };
};
