/**
 * Rule doc for Category inference.
 * Registry entry only; logic in lib/actionability.ts (inferCategoryFromIntent) + classifier.
 */

import type { RuleDoc } from '../types';

export const ruleCategory: RuleDoc = {
  id: 'category',
  gate: 'category',
  applies_when: 'intent (heuristic) or classifier response',
  outcome: 'LEARN | CREATE | PERFORM | WELLBEING | SOCIAL | CHALLENGE',
  reason_codes: ['LEARN', 'CREATE', 'PERFORM', 'WELLBEING', 'SOCIAL', 'CHALLENGE'],
  category_behavior: 'requires feasibility for LEARN, CREATE, WELLBEING; no feasibility for PERFORM, SOCIAL, CHALLENGE',
  examples_pass: [
    'apprendre le chinois → LEARN',
    '피자 만들기 → CREATE',
    'courir un marathon → PERFORM / CHALLENGE',
    'fluent Korean in 20 days → SOCIAL',
  ],
  examples_fail: [],
  notes: 'File: apps/web/app/lib/actionability.ts (inferCategoryFromIntent), lib/category.ts',
};
