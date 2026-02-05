/**
 * Rule doc for prompt policy (Decision Engine V2). Registry entry only.
 */

import type { RuleDoc } from '../types';

export const rulePromptPolicy: RuleDoc = {
  id: 'prompt_policy',
  gate: 'prompt_policy',
  applies_when:
    'Every LLM prompt used by Decision Engine or judges must be listed in Admin Prompts. Published: lib/prompts/published/<name>.json. Drafts: PourLaMaquette/prompts-drafts/<name>.json. JSON shape: name, version, purpose_en, token_budget_target, safety_notes_en, system?, user_template, input_schema, output_schema. recordPromptUse() called from every judge/engine route. Promote via scripts/promote-prompt.mjs.',
  outcome: 'ok',
  reason_codes: ['published', 'draft', 'catalog'],
  examples_pass: [
    'equivalence_judge_v1.json in published with purpose_en, token_budget_target, output_schema.',
    'New judge prompt: create draft, bootstrap via Admin Prompts, promote when ready.',
  ],
  examples_fail: [
    'Using an LLM prompt not in published or draft store.',
    'Missing recordPromptUse() after LLM call.',
  ],
  notes:
    'Admin Prompts page: /admin/prompts. All prompt docs in English. Runtime messages localized by ui_locale.',
};
