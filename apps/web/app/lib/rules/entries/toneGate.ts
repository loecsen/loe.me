/**
 * Rule doc for Tone gate (playful / nonsense / unclear).
 * Registry entry only; logic in lib/actionability/tone.ts.
 * EN-only.
 */

import type { RuleDoc } from '../types';

export const ruleToneGate: RuleDoc = {
  id: 'tone_gate',
  gate: 'tone',
  applies_when:
    'Intent is playful, nonsense, or unclear (single-word food, fantasy, trivial consumption). Deterministic heuristics only; no LLM in harness.',
  outcome: 'PLAYFUL_OR_NONSENSE',
  reason_codes: ['fantasy_playful', 'food_trivial', 'single_word_trivial', 'single_word_unclear'],
  examples_pass: ['pizza', 'become a dragon in 7 days', 'eat 100 pizzas in a month'],
  examples_fail: ['learn Italian in 7 days', 'improve my sleep in 14 days'],
  notes: 'Routes to humor_response (choose concrete goal). File: apps/web/app/lib/actionability/tone.ts. Decision engine runs tone gate after safety, before category.',
};
