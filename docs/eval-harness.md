# Evaluation Harness

Dev-only harness to run a structured test suite across all categories and subcategories through the decision pipeline (V2 first; legacy fallback when needed). Results are stored in the dev DB and rendered in Admin → Eval Harness.

## Overview

- **Single source of truth**: `apps/web/app/lib/eval/scenarios.ts` defines `EVAL_SCENARIOS` (data-driven; no scattered ad-hoc tests).
- **Runner**: `lib/eval/runner.ts` runs one scenario through: audience_safety (DB-first) → decision engine V2. It does **not** call `missions/generate`; we only evaluate gating and what UI would show.
- **Storage**: `PourLaMaquette/db/tables/eval_runs.ndjson` and `indexes/eval_runs.index.json`. Store: `lib/db/evalStore.file.ts`.
- **Admin UI**: `/admin/eval` — sortable/filterable table, “Run all scenarios”, “Rebuild eval indexes”, row expand for full JSON and gate trace.

## Pipeline order (runner)

1. Lexicon resolution (if enabled) + language signals  
2. Safety gate (inside decision engine)  
3. Audience safety assess (DB-first, then API if needed)  
4. Actionability V2 (category inference, etc.)  
5. Ambition confirmation / life-goal intercept  
6. Controllability (DB-first, then API if needed)  
7. Realism (if applicable)  
8. Final outcome selection (PROCEED vs show blocks)

The harness **always uses V2** in the runner (ignores `NEXT_PUBLIC_FORCE_LEGACY`).

## Adding scenarios

Edit `apps/web/app/lib/eval/scenarios.ts`:

- Add an object to `EVAL_SCENARIOS` with: `id`, `title_en`, `intent`, `timeframe_days`, `intent_lang`, `ui_locale`, `tags`, and optional `expected` (partial expectations for regression detection).
- `expected` can include: `category`, `sub_category`, `audience_safety_level`, `should_show_angles`, `should_block`, `tone`, `notes`.
- Keep coverage: 3–4 serious scenarios per category, 2 borderline, 2 humor/trivial, 1 adult_only (allowed), 1 blocked, plus multi-language (EN/FR/ES/RO) and special cases (romantic, money, institutional, health external, nonsense).

Scenario IDs must be stable and unique; they are used for deterministic `eval_run_id` (with policy version and engine version).

## Interpreting the table

- **ui_outcome**: Which block would be shown: `blocked`, `needs_clarify`, `show_angles`, `show_ambition_confirm`, `show_realism_adjust`, `choose_category`, `proceed`.
- **audience_safety_level**: `all_ages`, `adult_only`, or `blocked`.
- **DB cache (aud/ctrl)**: Whether audience_safety or controllability came from cache.
- **Gate trace** (expand row): Timeline of gates (audience_safety, decision_engine, etc.) and outcomes.

Use filters (category, outcome, lang, tag, audience_safety_level) and text search (intent/title) to find regressions. Expected fields on scenarios are **partial**; the harness is for detecting regressions, not strict assertion of every field.

## API (dev-only)

- `POST /api/eval/run` — body: `{ scenario_id?: string, run_all?: boolean }`. Run one scenario or all; results are stored.
- `GET /api/eval/runs` — query: `limit`, `category`, `outcome`, `lang`, `tag`, `audience_safety_level`, `q` (text search). Returns `{ runs: EvalRunResultV1[] }`.
- `POST /api/eval/indexes/rebuild` — Rebuild eval_runs index.

All routes return 403 in production.

## Smoke

- `npm run smoke:eval` — Asserts scenarios file exists with enough entries, eval store and Admin page paths, API routes.
- Included in `npm run smoke:sanity`.

## Future

- `review_status` and `review_notes_en` on `EvalRunResultV1` are placeholders for manually marking runs as good/bad and feeding improvements.
