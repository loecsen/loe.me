/**
 * Canonical UI outcome resolver. Used by Home and eval runner so admin/eval is truthful.
 * Maps gate results (decision outcome + payload, audience_safety, tone) to a single UI outcome enum.
 */

export type UiOutcome =
  | 'blocked'
  | 'needs_clarify'
  | 'show_angles'
  | 'show_ambition_confirm'
  | 'show_realism_adjust'
  | 'choose_category'
  | 'playful_nonsense'
  | 'proceed';

export type DecideUiOutcomeInput = {
  decisionOutcome: string;
  decisionPayload?: Record<string, unknown> | null;
  decisionDebug?: Record<string, unknown> | null;
  audienceSafetyLevel?: 'all_ages' | 'adult_only' | 'blocked' | null;
  tone?: 'serious' | 'playful' | 'nonsense' | 'unclear' | null;
};

export type DecideUiOutcomeResult = {
  ui_outcome: UiOutcome;
  tone: string | null;
  category: string | null;
  subcategory: string | null;
  suggestions: {
    angles?: Array<{ label: string; next_intent: string; days?: number }>;
    rewrites?: Array<{ label: string; next_intent: string }>;
    adjusted_days?: number | null;
  } | null;
  debug: Record<string, unknown>;
};

function decisionOutcomeToUiOutcome(decisionOutcome: string): UiOutcome {
  switch (decisionOutcome) {
    case 'BLOCKED_SAFETY':
      return 'blocked';
    case 'ASK_CLARIFICATION':
      return 'needs_clarify';
    case 'SHOW_ANGLES':
      return 'show_angles';
    case 'CONFIRM_AMBITION':
      return 'show_ambition_confirm';
    case 'REALISM_ADJUST':
      return 'show_realism_adjust';
    case 'ASK_USER_CHOOSE_CATEGORY':
      return 'choose_category';
    case 'PLAYFUL_OR_NONSENSE':
      return 'playful_nonsense';
    case 'PROCEED_TO_GENERATE':
      return 'proceed';
    default:
      return 'blocked';
  }
}

/**
 * Single canonical resolver: same logic for Home and eval runner.
 */
export function decideUiOutcome(input: DecideUiOutcomeInput): DecideUiOutcomeResult {
  const { decisionOutcome, decisionPayload, decisionDebug, audienceSafetyLevel, tone } = input;
  const debug: Record<string, unknown> = { ...(decisionDebug ?? {}) };

  if (audienceSafetyLevel === 'blocked') {
    return {
      ui_outcome: 'blocked',
      tone: tone ?? null,
      category: null,
      subcategory: null,
      suggestions: null,
      debug: { ...debug, branch: 'audience_safety_blocked' },
    };
  }

  const ui_outcome = decisionOutcomeToUiOutcome(decisionOutcome);
  const payload = decisionPayload ?? {};
  const category = (payload.category as string) ?? (decisionDebug?.category as string) ?? null;
  const subcategory = (payload.subcategory as string) ?? (payload.sub_category as string) ?? null;
  let suggestions: DecideUiOutcomeResult['suggestions'] = null;
  if (payload.angles && Array.isArray(payload.angles)) {
    suggestions = {
      angles: payload.angles as Array<{ label: string; next_intent: string; days?: number }>,
      rewrites: payload.suggested_rewrites as Array<{ label: string; next_intent: string }> | undefined,
      adjusted_days: payload.days as number | undefined ?? null,
    };
  }

  return {
    ui_outcome,
    tone: tone ?? null,
    category,
    subcategory,
    suggestions,
    debug,
  };
}
