/**
 * Bootstrap / Create draft prompt. Dev-only.
 * POST body: { prompt_name }. Creates PourLaMaquette/prompts-drafts/<name>.json if not already published/draft.
 */

import { NextResponse } from 'next/server';
import { loadPublishedPrompt, loadDraftPrompt, writeDraftPrompt } from '../../../lib/prompts/store';
import { getBootstrapStub, isKnownPromptName } from '../../../lib/prompts/bootstrapStubs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Bootstrap is dev-only' }, { status: 404 });
  }
  try {
    const body = (await request.json()) as { prompt_name?: string };
    const prompt_name = typeof body.prompt_name === 'string' ? body.prompt_name.trim() : '';
    if (!prompt_name) {
      return NextResponse.json({ error: 'prompt_name required' }, { status: 400 });
    }
    if (!isKnownPromptName(prompt_name)) {
      return NextResponse.json({ error: 'Unknown prompt name; use a known Decision Engine V2 prompt' }, { status: 400 });
    }
    const published = loadPublishedPrompt(prompt_name);
    if (published?.user_template) {
      return NextResponse.json({ ok: true, already: 'published', name: prompt_name });
    }
    const draft = loadDraftPrompt(prompt_name);
    if (draft) {
      return NextResponse.json({ ok: true, already: 'draft', name: prompt_name });
    }
    const stub = getBootstrapStub(prompt_name);
    if (!stub) {
      return NextResponse.json({ error: 'No bootstrap stub for this name' }, { status: 400 });
    }
    writeDraftPrompt(prompt_name, stub);
    return NextResponse.json({ ok: true, created: true, name: prompt_name, path: `PourLaMaquette/prompts-drafts/${prompt_name}.json` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
