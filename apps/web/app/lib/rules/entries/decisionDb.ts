/**
 * Rule doc for Decision DB (dev-only). Registry entry only; logic in lib/db, API routes, Home.
 */

import type { RuleDoc } from '../types';

export const ruleDecisionDb: RuleDoc = {
  id: 'decision_db',
  gate: 'decision_db',
  applies_when:
    'Doubt triggers: actionability BORDERLINE, controllability medium/low, life-goal hit, realism unrealistic, language uncertainty, or lexicon missing for non-core latin. Consult decision_records by unique key first; if found and fresh (per gate: controllability 90d, classify 7–14d), reuse; else call cheap AI and persist. Unique key includes policy_version (bump when rules/prompts change).',
  outcome: 'ok',
  reason_codes: ['cached', 'classify', 'controllability'],
  examples_pass: [
    'French "récupérer mon ex" → DB lookup; if cached, show controllable angles in French (intent_lang).',
    'French "trouver de l\'argent" → controllable angles in French, safe.',
    'English "become president" → confirmation or controllability support path.',
  ],
  examples_fail: [
    'Direct import of PourLaMaquette/db from business components (forbidden; use lib/db provider only).',
    'Production: decision DB is not used (lookup/upsert return 403/404).',
  ],
  notes:
    'Dev-only. policy_version in constants.ts; bump when rules/prompts change so cache hits are comparable. Unique key: intent_normalized, intent_lang, category, days_bucket, gate, policy_version, schema_version, context_hash. Freshness: controllability 90d, classify 7–14d. Doubt triggers: lib/db/doubtTriggers.ts. Tables/indexes under PourLaMaquette/db. Files: lib/db/*, api/db/*, admin/knowledge.',
};
