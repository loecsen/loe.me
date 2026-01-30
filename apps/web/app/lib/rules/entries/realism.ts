/**
 * Rule doc for Soft realism (LEARN / CREATE / WELLBEING).
 * Registry entry only; logic in lib/actionability/realism.ts.
 */

import type { RuleDoc } from '../types';

export const ruleRealism: RuleDoc = {
  id: 'realism_soft',
  gate: 'realism_soft',
  applies_when: 'intent, days, category (LEARN/CREATE/WELLBEING), locale (UI)',
  outcome: 'ok | stretch | unrealistic',
  reason_codes: ['ok', 'stretch', 'unrealistic'],
  category_behavior: 'requires feasibility',
  examples_pass: [
    'apprendre le chinois A2 en 90 jours → ok/stretch',
    'Learn Spanish basics in 14 days → ok',
    'fluent Korean in 20 days (SOCIAL) → ok (no feasibility check)',
  ],
  examples_fail: [
    'maîtriser le chinois en 90 jours → unrealistic',
    '精通中文 90天 → unrealistic',
    '한국어 유창하게 60일 → unrealistic',
  ],
  notes:
    'Adjustments: reduce_scope, increase_duration. File: apps/web/app/lib/actionability/realism.ts',
};
