/**
 * Rule doc for Controllability gate (low controllability => supportive block).
 * Registry entry only; logic in lib/actionability/controllability.ts + Home submit flow.
 */

import type { RuleDoc } from '../types';

export const ruleControllability: RuleDoc = {
  id: 'controllability',
  gate: 'controllability',
  applies_when:
    'intent outcome depends on others/external (heuristic or micro LLM). Early intercept before actionability/classify.',
  outcome: 'controllability_support',
  reason_codes: [
    'depends_on_other_people',
    'depends_on_institution',
    'depends_on_random_outcome',
    'romantic_outcome',
    'approval_or_selection',
    'life_goal_elite_role',
    'money_market_outcome',
    'unknown',
  ],
  examples_pass: [
    'get my ex back',
    'become president',
    'get hired at Google',
    'win the lottery',
    'get my visa approved',
    'become a billionaire',
  ],
  examples_fail: [
    'practice public speaking to run for mayor in 90 days',
    'learn Chinese A2 in 90 days',
    'improve my sleep routine',
  ],
  notes:
    'Shows Supportive Controllability block on Home: title + body + 2–4 controllable angle chips + "Keep my original intent". File: apps/web/app/lib/actionability/controllability.ts',
};
