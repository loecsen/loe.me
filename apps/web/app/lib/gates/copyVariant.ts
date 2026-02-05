/**
 * Centralized reason_code → copy variant resolver.
 * Single source of truth so we never show "outside your control" for pizza/playful.
 * English-only for debug_why; UI copy is localized via i18n keys.
 */

export type CopyVariant =
  | 'support_external_outcome'
  | 'support_unclear_goal'
  | 'support_playful_nonsense'
  | 'support_health_sensitive'
  | 'support_generic_angles';

export type ResolveCopyVariantInput = {
  audience_safety_level?: 'blocked' | 'adult_only' | 'all_ages' | null;
  tone?: 'serious' | 'playful' | 'nonsense' | 'unclear' | null;
  ui_outcome?: string | null;
  controllability_reason_code?: string | null;
  classify_reason_code?: string | null;
};

export type ResolveCopyVariantOutput = {
  variant: CopyVariant;
  title_key: string;
  body_key: string;
  debug_why: string;
};

/** Maps reason_code (controllability / classify) to copy variant. Do NOT map safety_no_suggestion here. */
const COPY_VARIANT_BY_REASON_CODE: Record<string, CopyVariant> = {
  romantic_outcome: 'support_external_outcome',
  approval_or_selection: 'support_external_outcome',
  depends_on_other_people: 'support_external_outcome',
  depends_on_institution: 'support_external_outcome',
  money_market_outcome: 'support_external_outcome',
  depends_on_random_outcome: 'support_external_outcome',
  life_goal_elite_role: 'support_external_outcome',
  health_outcome_external: 'support_health_sensitive',
  unknown: 'support_unclear_goal',
  ambiguous_goal: 'support_unclear_goal',
};

const VARIANT_TO_KEYS: Record<CopyVariant, { title_key: string; body_key: string }> = {
  support_external_outcome: {
    title_key: 'controllabilitySupportTitleExternal',
    body_key: 'controllabilitySupportBodyExternal',
  },
  support_unclear_goal: {
    title_key: 'supportUnclearTitle',
    body_key: 'supportUnclearBody',
  },
  support_playful_nonsense: {
    title_key: 'supportPlayfulTitle',
    body_key: 'supportPlayfulBody',
  },
  support_health_sensitive: {
    title_key: 'supportHealthTitle',
    body_key: 'supportHealthBody',
  },
  support_generic_angles: {
    title_key: 'supportGenericTitle',
    body_key: 'supportGenericBody',
  },
};

/**
 * Resolve copy variant from current gate outputs. Strict priority so we never show
 * "external outcome" language for playful/nonsense or unclear goals.
 * Blocked is handled by the blocked UI outcome; copy variants only apply to show_angles / other supportive flows.
 */
export function resolveCopyVariant(input: ResolveCopyVariantInput): ResolveCopyVariantOutput {
  const {
    tone,
    ui_outcome,
    controllability_reason_code,
    classify_reason_code,
  } = input;

  if (tone === 'playful' || tone === 'nonsense') {
    const keys = VARIANT_TO_KEYS.support_playful_nonsense;
    return {
      variant: 'support_playful_nonsense',
      title_key: keys.title_key,
      body_key: keys.body_key,
      debug_why: `tone=${tone} => playful_nonsense (never external_outcome)`,
    };
  }

  if (ui_outcome === 'choose_category' || ui_outcome === 'needs_clarify') {
    const keys = VARIANT_TO_KEYS.support_unclear_goal;
    return {
      variant: 'support_unclear_goal',
      title_key: keys.title_key,
      body_key: keys.body_key,
      debug_why: `ui_outcome=${ui_outcome} => unclear_goal`,
    };
  }

  if (controllability_reason_code && COPY_VARIANT_BY_REASON_CODE[controllability_reason_code]) {
    const variant = COPY_VARIANT_BY_REASON_CODE[controllability_reason_code];
    const keys = VARIANT_TO_KEYS[variant];
    return {
      variant,
      title_key: keys.title_key,
      body_key: keys.body_key,
      debug_why: `controllability_reason_code=${controllability_reason_code} => ${variant}`,
    };
  }

  if (classify_reason_code && COPY_VARIANT_BY_REASON_CODE[classify_reason_code]) {
    const variant = COPY_VARIANT_BY_REASON_CODE[classify_reason_code];
    const keys = VARIANT_TO_KEYS[variant];
    return {
      variant,
      title_key: keys.title_key,
      body_key: keys.body_key,
      debug_why: `classify_reason_code=${classify_reason_code} => ${variant}`,
    };
  }

  const keys = VARIANT_TO_KEYS.support_generic_angles;
  return {
    variant: 'support_generic_angles',
    title_key: keys.title_key,
    body_key: keys.body_key,
    debug_why: 'no mapped reason_code => generic_angles',
  };
}
