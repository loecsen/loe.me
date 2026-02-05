import { NextResponse } from 'next/server';
import { list } from '../../../lib/db/ideaRoutineStore.file';
import type { IdeaRoutineCategory } from '../../../lib/db/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') as IdeaRoutineCategory | null;
  const q = searchParams.get('q') ?? undefined;
  const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
  const hasTranslationForLocale = searchParams.get('hasTranslationForLocale') ?? undefined;
  const items = await list({
    category: category ?? undefined,
    q,
    limit,
    hasTranslationForLocale,
  });
  return NextResponse.json({ items });
}
