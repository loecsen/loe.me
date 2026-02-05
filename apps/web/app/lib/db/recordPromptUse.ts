/**
 * Helper: record prompt use so the catalog stays in sync.
 * Call from every LLM route (classify, controllability, lexicon bootstrap, etc.).
 * Dev-only; no-op in production.
 */

import { getPromptStore } from './provider';
import type { PromptCatalogEntryV1 } from './types';
import { PROMPT_CATALOG_SCHEMA_VERSION } from './types';

export type RecordPromptUseInput = {
  prompt_name: string;
  version: string;
  purpose_en: string;
  where_used: string[];
  prompt_text: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  token_budget_target?: number;
  safety_notes_en?: string;
  version_semver?: string;
  tags?: string[];
};

/** Record or update prompt in catalog. Call after building prompt, before or after LLM call. No-op in production. */
export async function recordPromptUse(input: RecordPromptUseInput): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  try {
    const now = new Date().toISOString();
    const id = `prompt:${input.prompt_name}@${input.version}`;
    const entry: PromptCatalogEntryV1 = {
      id,
      schema_version: PROMPT_CATALOG_SCHEMA_VERSION,
      created_at: now,
      updated_at: now,
      name: input.prompt_name,
      version: input.version,
      version_semver: input.version_semver ?? input.version,
      purpose_en: input.purpose_en,
      where_used: input.where_used ?? [],
      prompt_text: input.prompt_text,
      input_schema: input.input_schema,
      output_schema: input.output_schema,
      tags: input.tags ?? [],
      token_budget_target: input.token_budget_target,
      safety_notes_en: input.safety_notes_en,
    };
    const store = getPromptStore();
    await store.upsert(entry);
  } catch {
    /* best-effort; do not fail the request */
  }
}
