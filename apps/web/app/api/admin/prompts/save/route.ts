/**
 * POST: save one published prompt (dev-only). Single source: lib/prompts/published/<name>.json.
 */

import { NextResponse } from 'next/server';
import { writePublishedPrompt, KNOWN_PROMPT_NAMES } from '../../../../lib/prompts/store';
import type { PromptEntry } from '../../../../lib/prompts/store';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  let body: { name?: string; entry?: PromptEntry };
  try {
    body = (await request.json()) as { name?: string; entry?: PromptEntry };
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const entry = body.entry;
  if (!name || !entry || typeof entry.user_template !== 'string') {
    return NextResponse.json({ error: 'name and entry.user_template required' }, { status: 400 });
  }
  const allowed = new Set(KNOWN_PROMPT_NAMES);
  if (!allowed.has(name as (typeof KNOWN_PROMPT_NAMES)[number])) {
    return NextResponse.json({ error: `unknown prompt name: ${name}` }, { status: 400 });
  }
  const normalized: PromptEntry = {
    name: entry.name ?? name,
    version: typeof entry.version === 'string' ? entry.version : '1.0.0',
    purpose_en: typeof entry.purpose_en === 'string' ? entry.purpose_en : '',
    user_template: entry.user_template,
    system: typeof entry.system === 'string' ? entry.system : undefined,
    token_budget_target: typeof entry.token_budget_target === 'number' ? entry.token_budget_target : undefined,
    safety_notes_en: typeof entry.safety_notes_en === 'string' ? entry.safety_notes_en : undefined,
    input_schema: entry.input_schema && typeof entry.input_schema === 'object' ? entry.input_schema : undefined,
    output_schema: entry.output_schema && typeof entry.output_schema === 'object' ? entry.output_schema : undefined,
  };
  try {
    writePublishedPrompt(name, normalized);
    return NextResponse.json({ ok: true, name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
