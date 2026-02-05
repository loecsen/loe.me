# Decision Engine V2 — Analysis & Coherence

## Spec summary

- **Goal**: DB-first, "cheap AI when uncertain" routing. Reuse prior decisions; call small LLM judges only when needed; persist every LLM decision; produce localized suggestions; reduce regex reliance.
- **Scope**: V1 dev-only, feature flag `NEXT_PUBLIC_DECISION_ENGINE_V2=1` (default off). File-DB under PourLaMaquette; Postgres-ready design.
- **Pipeline**: Preprocess → exact cache → similarity cache (equivalence judge) → safety → category → tone → category analysis → controllability → realism → proceed (+ objectives_preview). Inline refine uses clarify_chips on demand. Outcomes: PROCEED_TO_GENERATE | SHOW_ANGLES | ASK_CLARIFICATION | CONFIRM_AMBITION | ASK_USER_CHOOSE_CATEGORY | BLOCKED_SAFETY.

## Coherence check

| Area | Spec | Existing code | Adjustment |
|------|------|---------------|------------|
| **DB** | gate_kind: equivalence \| safety \| category \| tone \| category_analysis \| realism \| decision_engine | `DecisionGateKind` = classify \| controllability \| realism_ambition | Extend type and key builder to accept new gate kinds; keep backward compat. |
| **Exact cache key** | normalized_intent, days_bucket, gate_kind, policy_version, schema_version | key = f(intent_normalized, intent_lang, category, days_bucket, gate, policy_version, schema_version) | For full-decision cache use gate='decision_engine' and omit category (or use category after step 4). Include intent_lang in key. |
| **Similarity** | Only if intent length > 20; trigram Jaccard; score [0.70, 0.90] → equivalence_judge | No existing similarity | New module; candidate retrieval via search(intent_lang, gate_kind). |
| **Safety** | Always before suggestions; deterministic first, then safety_judge_v1 | safetyGate, hardBlock, moderation | Reuse deterministic gates; add judge API for uncertain; persist with gate='safety'. |
| **Prompts** | JSON in lib/prompts/published/*.json, drafts in PourLaMaquette/prompts-drafts | Prompts in lib/prompts/*.ts (classify, controllability, etc.) | New store.ts loads JSON; legacy prompts unchanged. |
| **Admin Prompts** | /admin/prompts, list published + drafts, bootstrap draft, promote script | Admin Rules, Admin Knowledge | New page; link from Home (dev) and Rules. |
| **Home** | Single API /api/decision/resolve when flag on; render outcomes; no generic "action+result" for ACTIONABLE | handleSubmit with runActionabilityV2, controllability, classify, generate | Branch on flag; call resolve; map outcome → existing UI blocks (angles, confirm, etc.) or new ones. |
| **Freshness** | Per-gate freshness | getFreshnessMsForGate(gate, verdict) | Add cases for new gate kinds (safety, category, tone, category_analysis, realism, decision_engine). |

## Adjustments adopted

1. **Exact cache**: Key for full decision = (normalized_intent, intent_lang, days_bucket, gate='decision_engine', policy_version, schema_version). Category not in key so we can cache before category step; optional 1bis "same intent, different days" can reuse partial and recompute realism.
2. **Similarity**: Candidates from `search({ intent_lang, limit })` then filter by gate if index supports; else search by intent_substring from normalized_intent prefix. Trigram Jaccard implemented in JS (no new deps).
3. **Judge APIs**: Each judge validates output schema, sanitizes, persists DecisionRecord, calls recordPromptUse. Dev-only (check NODE_ENV or explicit header).
4. **Prompt JSON shape**: `{ name, version, purpose_en, token_budget_target, safety_notes_en, system?, user_template, input_schema, output_schema }`. Published under lib/prompts/published/, drafts under PourLaMaquette/prompts-drafts/.
5. **Lint**: If staged touches lib/decisionEngine/**, api/judge/**, lib/prompts/**, admin/prompts/**, require rules registry or prompt catalog update (extend lint-ui-rules.mjs).

## Maintenance (admin + debug)

Quand on ajoute **un nouveau prompt** ou **un nouveau texte user-facing** :

- **Admin Prompts** : ajouter le nom dans `KNOWN_PROMPT_NAMES`, créer un stub dans `bootstrapStubs.ts` et vérifier la présence dans `prompt_catalog.ndjson`.
- **Admin Messages** : ajouter la clé i18n dans `lib/admin/scenarioMessages.ts` pour éditer le texte côté admin.
- **Home debug** : garder la trace visible dans le bloc debug (PipelinePromptsEditor + legend des étapes) tant que le debug est actif.

### Smoke test manuel — clarify chips

1. Intent `Apprendre le temps en espagnol` (days=14) → écran de confirmation → `Je précise` :
   - chips contextuels liés à la langue (pas de restaurant par défaut)
   - `Options par défaut` uniquement si fallback
2. Intent `Suédois au restaurant` (days=14) :
   - contexte “restaurant” possible dans les options
3. Simuler erreur API (devtools, offline) :
   - fallback affiché + “Options par défaut”
4. `Mettre à jour` :
   - déclenche la génération avec `goal_clarification` (keys uniquement)

## Implementation order

1. Types (decisionEngine + DB gate extension) + preprocess + similarity
2. Prompt store + published/drafts dirs + DB gate_kind + freshness
3. Engine orchestrator + /api/decision/resolve + judge API stubs
4. Admin Prompts page + promote script + Rules entry
5. Home V2 branch + smoke scripts + lint

## Implementation status (à jour)

- **Pipeline** : Preprocess → cache exact → **cache similarité par empreinte d’intention** (intent_fingerprint) → safety → **reformulation** (intent_reformulation_v1) → category → category analysis → controllability → realism → proceed (+ objectives_preview). Inline refine: `clarify_chips_v1` via `/api/decision/clarify-chips`. Issues implémentées : PROCEED_TO_GENERATE, SHOW_ANGLES, ASK_CLARIFICATION, CONFIRM_AMBITION, ASK_USER_CHOOSE_CATEGORY, BLOCKED_SAFETY.
- **Similarité** : basée sur **intent_fingerprint** (normalisation, stop words, verbes faibles) ; recherche par (intent_fingerprint, gate, intent_lang, days_bucket, policy_version). Pas de trigram Jaccard ni equivalence_judge LLM pour le cache.
- **Reformulation** : juge `runIntentReformulation` (prompt intent_reformulation_v1) ; sortie style titre de méthode, sans jours ; utilisée comme `rewritten_intent` dans tous les payloads et persistée dans DecisionRecord.
- **DB** : file-store sous PourLaMaquette ; DecisionRecord avec champs `intent_fingerprint`, `intent_fingerprint_algo`, `rewritten_intent` ; search par intent_fingerprint + days_bucket + policy_version.
- **Home** : appel unique `/api/decision/resolve` (flag V2) ; affichage « En réflexion », blocs NeedPrecisions, « Ton projet : … en X jours », clic suggestion → texte dans le champ intention ; debug fingerprint / similarity_hit / matched_record_id.
- **Admin** : /admin/prompts, /admin/lexicon, /admin/knowledge (décisions avec intent_fingerprint), /admin/eval (harness + scénarios similarity).
- **Smoke** : smoke:decision-engine, smoke:db, smoke:prompts, smoke:fingerprint ; smoke:sanity enchaîne l’ensemble.
