/**
 * Rule doc for Ambition confirmation (life-goal / role intercept).
 * Registry entry only; logic in lib/actionability/ambitionConfirmation.ts.
 */

import type { RuleDoc } from '../types';

export const ruleAmbition: RuleDoc = {
  id: 'confirmation',
  gate: 'confirmation',
  applies_when: 'intent (client-only). Intercept only if elite/superlative; guards: actionable frame or learning verb => no block.',
  outcome: 'CONFIRMATION',
  reason_codes: ['needs_confirmation (elite role or superlative/absolute)'],
  examples_pass: [
    'devenir président de la république',
    'devenir champion du monde',
    'devenir le meilleur pet sitter (superlatif)',
    'become a billionaire',
  ],
  examples_fail: [
    'devenir pet sitter (normal job)',
    'devenir pet sitter en 30 jours (actionable frame)',
    'apprendre le chinois (learning verb)',
  ],
  notes:
    'Shows "Confirm ambition" block on Home. File: apps/web/app/lib/actionability/ambitionConfirmation.ts',
};
