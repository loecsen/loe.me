/**
 * Rule doc for Borderline → Classify (LLM fallback).
 * Registry entry only; logic in api/actionability/classify/route.ts + prompts/actionabilityClassifier.ts.
 */

import type { RuleDoc } from '../types';

export const ruleClassifier: RuleDoc = {
  id: 'classifier',
  gate: 'classifier',
  applies_when: 'When actionability_v2 returns BORDERLINE; intent, timeframe_days, display_lang',
  outcome: 'ACTIONABLE | NEEDS_REPHRASE_INLINE | BLOCKED',
  reason_codes: [
    'too_vague',
    'social_chitchat',
    'pure_noun_topic',
    'no_action_or_outcome',
    'ambiguous_goal',
    'ok',
    'safety_no_suggestion',
    'blocked',
    'classifier_error',
  ],
  examples_pass: [
    'manger pizza → suggestion "learn to make pizza" or similar',
    'fluent Korean in 20 days (SOCIAL → ok)',
  ],
  examples_fail: [
    'Pure greetings → NEEDS_REPHRASE_INLINE',
    'Single noun without action → NEEDS_REPHRASE_INLINE',
    'Consume-only without learning → NEEDS_REPHRASE_INLINE + suggested_rephrase',
  ],
  notes:
    'Returns category, normalized_intent, suggested_rephrase. File: apps/web/app/api/actionability/classify/route.ts',
};
