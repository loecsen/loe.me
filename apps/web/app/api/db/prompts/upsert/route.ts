/**
 * Upsert a prompt catalog entry. Dev-only. Used by admin or seed script.
 */

import { NextResponse } from 'next/server';
import { getPromptStore } from '../../../../lib/db/provider';
import type { PromptCatalogEntryV1 } from '../../../../lib/db/types';
import { PROMPT_CATALOG_SCHEMA_VERSION } from '../../../../lib/db/types';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Partial<PromptCatalogEntryV1> & {
      name: string;
      version: string;
      purpose_en: string;
      prompt_text: string;
    };
    const now = new Date().toISOString();
    const id = body.id ?? `prompt:${body.name}@${body.version}`;
    const entry: PromptCatalogEntryV1 = {
      id,
      schema_version: PROMPT_CATALOG_SCHEMA_VERSION,
      created_at: body.created_at ?? now,
      updated_at: body.updated_at ?? now,
      name: body.name ?? '',
      version: body.version ?? '1',
      version_semver: body.version_semver ?? body.version,
      purpose_en: body.purpose_en ?? '',
      where_used: Array.isArray(body.where_used) ? body.where_used : [],
      prompt_text: body.prompt_text ?? '',
      input_schema: body.input_schema,
      output_schema: body.output_schema,
      tags: Array.isArray(body.tags) ? body.tags : [],
      token_budget_target: body.token_budget_target,
      safety_notes_en: body.safety_notes_en,
    };
    const store = getPromptStore();
    await store.upsert(entry);
    return NextResponse.json({ ok: true, id: entry.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
