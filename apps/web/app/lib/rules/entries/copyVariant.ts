/**
 * Rule doc for UI copy variants (support/angles block).
 * Centralized reason_code → copy variant to avoid "outside your control" for pizza.
 * Registry entry only; logic in lib/gates/copyVariant.ts. EN-only.
 */

import type { RuleDoc } from '../types';

export const ruleCopyVariant: RuleDoc = {
  id: 'ui_copy_variants',
  gate: 'ui_copy_variants',
  applies_when:
    'User sees the support/angles block (show_angles). Resolver takes audience_safety, tone, ui_outcome, controllability_reason_code, classify_reason_code and returns variant + title_key + body_key + debug_why.',
  outcome: 'support_external_outcome | support_unclear_goal | support_playful_nonsense | support_health_sensitive | support_generic_angles',
  reason_codes: [
    'romantic_outcome',
    'approval_or_selection',
    'depends_on_other_people',
    'depends_on_institution',
    'money_market_outcome',
    'depends_on_random_outcome',
    'life_goal_elite_role',
    'health_outcome_external',
    'unknown',
    'ambiguous_goal',
  ],
  examples_pass: [
    'pizza => support_playful_nonsense (never external_outcome)',
    'get my ex back => support_external_outcome',
    'x (too short) => support_unclear_goal or inline hint path',
  ],
  examples_fail: ['pizza must not show "outside your control"'],
  notes:
    'Blocked is handled separately by blocked UI; copy variants apply to supportive flows (e.g. show_angles). Priority: (1) tone playful/nonsense → support_playful_nonsense; (2) ui_outcome choose_category or needs_clarify → support_unclear_goal; (3) controllability_reason_code mapped → that variant; (4) classify_reason_code mapped → that variant; (5) else support_generic_angles. File: apps/web/app/lib/gates/copyVariant.ts.',
};
