# Dev-only local database (PourLaMaquette/db)

This folder holds the **dev-only** local "database" used for AI doubt resolution and prompt catalog. It is **not** used in production.

## What is stored here

- **tables/**  
  - `decision_records.ndjson` — one JSON object per line (NDJSON). Each row is an AI "doubt resolution" outcome (classify or controllability) keyed by a deterministic unique key.  
  - `prompt_catalog.ndjson` — one JSON object per line. Each row is a prompt used to call LLMs (name, version, purpose_en, prompt_text, etc.).

- **indexes/**  
  - `decision_records.index.json` — maps `unique_key:context_hash` → `{ id, updated_at }` for fast lookup.  
  - `prompt_catalog.index.json` — maps `name@version` → `{ id, updated_at }`.

All files are under `apps/web/app/PourLaMaquette/db/`. No business component imports this path; only `apps/web/app/lib/db` and API routes use it.

## How to clean in one commit

Remove or truncate the NDJSON files and index files under `tables/` and `indexes/`. The app will recreate them on next write. You can also delete the entire `db/` folder and let the first upsert recreate `tables/` and `indexes/`.

## How to promote

There is no "promote" to production for this dev DB. In production, the same repository interfaces (`DecisionStore`, `PromptStore`) can be implemented with Postgres (see "Migrate to Postgres" below).

## How to migrate to Postgres later

1. **Table schemas (SQL)**  
   - `decision_records`: columns `id` (PK), `schema_version`, `created_at`, `updated_at`, `intent_raw`, `intent_lang`, `ui_locale`, `days`, `category`, `gates` (JSONB), `verdict`, `reason_code`, `suggestions` (JSONB), `notes_en`, `model` (JSONB), `unique_key`, `context_hash`, `confidence`.  
   - Unique constraint on `(unique_key, context_hash)` or a single composite unique index.  
   - `prompt_catalog`: columns `id` (PK), `schema_version`, `created_at`, `updated_at`, `name`, `version`, `purpose_en`, `where_used` (JSONB or array), `prompt_text`, `input_schema` (JSONB), `output_schema` (JSONB), `tags` (array), `safety_notes_en`.  
   - Unique constraint on `(name, version)`.

2. **Indexes**  
   - `decision_records`: unique index on `(unique_key, context_hash)`; optional B-tree on `updated_at`, GIN on `intent_raw` for search.  
   - `prompt_catalog`: unique index on `(name, version)`.

3. **Import procedure**  
   - Read each NDJSON line, parse JSON, insert into Postgres (with conflict handling for upsert).  
   - Or use a script that reads the NDJSON files and runs `INSERT ... ON CONFLICT (unique_key, context_hash) DO UPDATE` (or equivalent for prompt_catalog).

See `docs/db-migrate-postgres.md` (if added) for exact SQL and a small Node script example.
