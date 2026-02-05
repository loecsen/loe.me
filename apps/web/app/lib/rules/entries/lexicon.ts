/**
 * Rule doc for Lexicon pack selection and fallbacks.
 * Registry entry only; logic in lib/lexicon/registry.ts, bootstrap, and server routes.
 */

import type { RuleDoc } from '../types';

export const ruleLexicon: RuleDoc = {
  id: 'lexicon',
  gate: 'lexicon',
  applies_when:
    'Server routes (classify, missions/generate) resolve tokens for intent + ui_locale; client uses getLexSignals (fallback only, no FS).',
  outcome: 'ok',
  reason_codes: ['published', 'draft', 'fallback'],
  examples_pass: [
    'Published pack for intentLang (e.g. en) → tokens from packs/<lang>.json',
    'Draft pack in dev for intentLang → tokens from PourLaMaquette/lexicon-drafts/<lang>.json',
  ],
  examples_fail: [
    'No pack for intentLang → fallback script pack (latin_generic, cjk_generic, etc.) used; no FS read for client.',
    'Bootstrap in production → pack returned but not persisted to disk.',
  ],
  notes:
    'When pack is selected: published > draft (dev only) > fallback. Fallback signals are script-based (getFallbackPackForIntent). Bootstrap creates a draft only in dev. Safety: packs generated without user intent; sanitize/blocklist in lib/lexicon/validate; no suggestion if unsafe. Files: lib/lexicon/registry.ts, api/lexicon/bootstrap, api/actionability/classify, api/missions/generate.',
};
