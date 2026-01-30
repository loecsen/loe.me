/**
 * Rule doc for ActionabilityV2 (lib/actionability.ts).
 * Registry entry only; logic stays in actionability.ts.
 */

import type { RuleDoc } from '../types';

export const ruleActionabilityV2: RuleDoc = {
  id: 'actionability_v2',
  gate: 'actionability_v2',
  applies_when: 'intent + days; rule-based, no LLM',
  outcome: 'ACTIONABLE | BORDERLINE | NOT_ACTIONABLE_INLINE',
  reason_codes: [
    'noise',
    'social_chitchat',
    'single_term',
    'too_short_cjk',
    'borderline_actionable',
    'actionable',
    'not_actionable_inline',
  ],
  examples_pass: [
    'faire pizza (14 days)',
    'apprendre le chinois A2 en 90 jours',
    '学习中文A2 90天',
    '피자 만들기 (14 days)',
    'Learn Spanish basics in 14 days',
    'me préparer à un entretien en anglais (30 days)',
  ],
  examples_fail: [
    'pizza (single_term)',
    'bonjour (social_chitchat)',
    '你好 (too_short_cjk)',
    '피자 (single_term / too_short)',
    'x (noise / single_term)',
  ],
  notes: 'Outputs category (inferred). File: apps/web/app/lib/actionability.ts',
};
