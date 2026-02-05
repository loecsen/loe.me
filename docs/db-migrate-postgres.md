# Migrate dev DB to Postgres

This document describes how to migrate the dev-only NDJSON tables under `apps/web/app/PourLaMaquette/db/` to Postgres.

## Table schemas

### decision_records

```sql
CREATE TABLE decision_records (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL DEFAULT 'decision-record-v1',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  intent_raw TEXT NOT NULL,
  intent_lang TEXT NOT NULL,
  ui_locale TEXT NOT NULL,
  days INTEGER NOT NULL,
  category TEXT,
  gates JSONB DEFAULT '{}',
  verdict TEXT NOT NULL,
  reason_code TEXT,
  suggestions JSONB DEFAULT '{}',
  notes_en TEXT,
  model JSONB,
  unique_key TEXT NOT NULL,
  context_hash TEXT NOT NULL,
  confidence NUMERIC
);

CREATE UNIQUE INDEX idx_decision_records_unique ON decision_records (unique_key, context_hash);
CREATE INDEX idx_decision_records_updated ON decision_records (updated_at DESC);
```

### prompt_catalog

```sql
CREATE TABLE prompt_catalog (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL DEFAULT 'prompt-catalog-v1',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  purpose_en TEXT NOT NULL,
  where_used JSONB DEFAULT '[]',
  prompt_text TEXT NOT NULL,
  input_schema JSONB,
  output_schema JSONB,
  tags JSONB DEFAULT '[]',
  safety_notes_en TEXT
);

CREATE UNIQUE INDEX idx_prompt_catalog_name_version ON prompt_catalog (name, version);
CREATE INDEX idx_prompt_catalog_updated ON prompt_catalog (updated_at DESC);
```

## Import procedure

1. Read each NDJSON file line by line.
2. Parse each line as JSON.
3. Insert into Postgres with `ON CONFLICT (unique_key, context_hash) DO UPDATE` for decision_records and `ON CONFLICT (name, version) DO UPDATE` for prompt_catalog.

Example (Node, pseudocode):

```js
const fs = require('fs');
const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);

async function importDecisionRecords(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);
  for (const line of lines) {
    const row = JSON.parse(line);
    await client.query(
      `INSERT INTO decision_records (id, schema_version, created_at, updated_at, intent_raw, intent_lang, ui_locale, days, category, gates, verdict, reason_code, suggestions, notes_en, model, unique_key, context_hash, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       ON CONFLICT (unique_key, context_hash) DO UPDATE SET
         updated_at = EXCLUDED.updated_at,
         verdict = EXCLUDED.verdict,
         reason_code = EXCLUDED.reason_code,
         suggestions = EXCLUDED.suggestions`,
      [row.id, row.schema_version, row.created_at, row.updated_at, row.intent_raw, row.intent_lang, row.ui_locale, row.days, row.category, JSON.stringify(row.gates ?? {}), row.verdict, row.reason_code, JSON.stringify(row.suggestions ?? {}), row.notes_en ?? null, row.model ? JSON.stringify(row.model) : null, row.unique_key, row.context_hash, row.confidence ?? null]
    );
  }
}
```

For prompt_catalog, use `ON CONFLICT (name, version) DO UPDATE` with the same idea.

## COPY alternative

You can export NDJSON to CSV (with JSON columns stringified) and use `COPY ... FROM` with a program that converts JSON lines to CSV, or use a small script that reads NDJSON and inserts via the client as above.
