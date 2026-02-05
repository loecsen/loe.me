import { NextResponse } from 'next/server';
import { getPrompt } from '../../../lib/prompts/store';
import { buildUserMessage, runJudgeLLM } from '../../../lib/decisionEngine/judges/runJudge';
import { upsert } from '../../../lib/db/ideaRoutineStore.file';
import type { IdeaRoutineV1, IdeaRoutineCategory } from '../../../lib/db/types';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

const PROMPT_NAME = 'idea_routines_generator_v1';

const CATEGORY_NAMES: Record<IdeaRoutineCategory, string> = {
  LEARN: 'Learn & understand',
  CREATE: 'Create & express',
  PERFORM: 'Progress & perform',
  WELLBEING: 'Change & ground',
  SOCIAL: 'Social & collective',
  CHALLENGE: 'Challenges & transformations',
};

function normalizeIntent(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  let body: { category?: IdeaRoutineCategory; ui_locale?: string };
  try {
    body = (await request.json()) as { category?: IdeaRoutineCategory; ui_locale?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const category = body.category ?? 'LEARN';
  const validCategories: IdeaRoutineCategory[] = ['LEARN', 'CREATE', 'PERFORM', 'WELLBEING', 'SOCIAL', 'CHALLENGE'];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
  }

  const promptEntry = getPrompt(PROMPT_NAME, { allowDraft: true });
  if (!promptEntry?.user_template) {
    return NextResponse.json({ error: 'prompt_not_found' }, { status: 500 });
  }
  const category_name = CATEGORY_NAMES[category];
  const userContent = buildUserMessage(promptEntry.user_template, { category, category_name });
  const content = await runJudgeLLM(PROMPT_NAME, promptEntry, userContent, {
    maxTokens: 1500,
    timeoutMs: 15_000,
    whereUsed: ['api/idea-routines/generate'],
  });
  if (!content) {
    return NextResponse.json({ error: 'llm_failed' }, { status: 502 });
  }

  let parsed: { routines?: Array<{ title?: string; intent?: string; tags?: string[] }> };
  try {
    const cleaned = content.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    parsed = JSON.parse(cleaned) as { routines?: Array<{ title?: string; intent?: string; tags?: string[] }> };
  } catch {
    return NextResponse.json({ error: 'invalid_llm_json' }, { status: 502 });
  }
  const rawRoutines = parsed.routines ?? [];
  const seen = new Set<string>();
  const now = new Date().toISOString();
  let added = 0;
  for (const r of rawRoutines) {
    const title = (r.title ?? '').trim();
    const intent = (r.intent ?? title).trim();
    if (!title || !intent) continue;
    const norm = normalizeIntent(intent);
    if (seen.has(norm)) continue;
    seen.add(norm);
    const id = `idea-${category.toLowerCase()}-${crypto.randomBytes(4).toString('hex')}`;
    const record: IdeaRoutineV1 = {
      id,
      category,
      canonical_lang: 'en',
      title_en: title,
      intent_en: intent,
      created_at: now,
      updated_at: now,
      source: 'llm',
      tags: r.tags,
    };
    await upsert(record);
    added++;
    if (added >= 21) break;
  }
  return NextResponse.json({ ok: true, added, category });
}
