import { NextResponse } from 'next/server';
import { upsert } from '../../../lib/db/ideaRoutineStore.file';
import type { IdeaRoutineV1 } from '../../../lib/db/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  let body: IdeaRoutineV1;
  try {
    body = (await request.json()) as IdeaRoutineV1;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.id || !body.category || !body.title_en || !body.intent_en) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const record: IdeaRoutineV1 = {
    id: body.id,
    category: body.category,
    subcategory: body.subcategory ?? null,
    canonical_lang: 'en',
    title_en: body.title_en,
    intent_en: body.intent_en,
    translations: body.translations,
    created_at: body.created_at ?? now,
    updated_at: now,
    source: body.source ?? 'seed',
    tags: body.tags,
  };
  await upsert(record);
  return NextResponse.json({ ok: true, id: record.id });
}
