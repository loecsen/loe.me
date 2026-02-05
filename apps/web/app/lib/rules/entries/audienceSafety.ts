/**
 * Rule doc for Audience safety gate (minors-safe classification).
 * all_ages | adult_only | blocked. Pipeline: hard checks → heuristics → API (doubt only).
 * EN only. Logic in lib/actionability/audienceSafety.ts, API /api/audience-safety/classify.
 */

import type { RuleDoc } from '../types';

export const ruleAudienceSafety: RuleDoc = {
  id: 'audience_safety',
  gate: 'audience_safety',
  applies_when:
    'Classify request for minors safety: all_ages vs adult_only vs blocked. Hard checks (CSAM/sexual minors, self-harm instructions, bomb/explosive how-to, sexual violence) → blocked. Heuristics (adult sexual, nudity, drugs, weapons, gambling) → adult_only. Else API (audience_safety_classifier_v1).',
  outcome: 'ok',
  reason_codes: [
    'sexual_content',
    'nudity',
    'weapons',
    'drugs',
    'violence',
    'self_harm',
    'hate',
    'crime_howto',
    'sexual_minors',
    'sexual_violence',
    'explosives_howto',
    'unknown',
  ],
  examples_pass: [
    'Pratiquer le Kamasutra → adult_only',
    'Do a detox program → all_ages',
    'How to make a bomb → blocked',
    'Learn Spanish in 30 days → all_ages',
  ],
  examples_fail: [
    'Bypassing hard blocks (CSAM, self-harm instructions, explosives how-to).',
    'Treating adult_only as allow-anything; adult_only restricts public/community and forces safe image prompt.',
  ],
  notes:
    'DB-first: lookup gate=audience_safety; if fresh use record; else classify + upsert. adult_only: no public/community; badge "Adults only: private/friends"; image: safe prompt or no image. blocked: no image, no generation. Prompt: lib/prompts/published/audience_safety_classifier_v1.json.',
};
