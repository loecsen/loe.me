/**
 * Rule doc for Decision Engine V2. Registry entry only; logic in lib/decisionEngine, api/decision, Home.
 */

import type { RuleDoc } from '../types';

export const ruleDecisionEngineV2: RuleDoc = {
  id: 'decision_engine_v2',
  gate: 'decision_engine_v2',
  applies_when:
    'V2 is default on Home (see decision_engine_selection). DB-first pipeline: preprocess → exact cache → similarity (equivalence judge) → safety → category → tone → category_analysis → realism. Outcomes: PROCEED_TO_GENERATE, SHOW_ANGLES, ASK_CLARIFICATION, CONFIRM_AMBITION, ASK_USER_CHOOSE_CATEGORY, REALISM_ADJUST, BLOCKED_SAFETY. Every LLM call persists DecisionRecord and recordPromptUse.',
  outcome: 'ok',
  reason_codes: ['exact_cache', 'equivalence', 'safety', 'category', 'tone', 'category_analysis', 'realism'],
  examples_pass: [
    '"take back my ex" / "récupérer mon ex" → SHOW_ANGLES with controllable angles in intent_lang (no manipulation).',
    '"trouver de l\'argent" → safe angles in French (budgeting, earning skills).',
    'Cached (normalized_intent, days_bucket, gate=decision_engine) → return cached outcome after safety check on raw intent.',
  ],
  examples_fail: [
    'Showing generic "action + result" hint when outcome is ACTIONABLE/PROCEED (clarification must come from ASK_CLARIFICATION with custom question).',
    'Bypassing safety gate before showing cached or fresh suggestions.',
  ],
  notes:
    'Dev-only V1. Single API /api/decision/resolve. Prompts in lib/prompts/published (JSON); drafts in PourLaMaquette/prompts-drafts. Admin Prompts page: /admin/prompts. Promote script: scripts/promote-prompt.mjs.',
};
