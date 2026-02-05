/**
 * List/search eval runs. Dev-only.
 * GET ?limit=&category=&outcome=&lang=&tag=&q=
 */

import { NextResponse } from 'next/server';
import * as evalStore from '../../../lib/db/evalStore.file';

export const dynamic = 'force-dynamic';

function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const forbidden = devOnly();
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100));
    const q = searchParams.get('q')?.trim();
    const category = searchParams.get('category') ?? undefined;
    const outcome = searchParams.get('outcome') ?? undefined;
    const lang = searchParams.get('lang') ?? undefined;
    const tag = searchParams.get('tag') ?? undefined;
    const audience_safety_level = searchParams.get('audience_safety_level') ?? undefined;

    if (q) {
      const rows = await evalStore.searchEvalRuns(q, limit);
      return NextResponse.json({ runs: rows });
    }

    const filters = {
      category,
      ui_outcome: outcome,
      intent_lang: lang,
      tag,
      audience_safety_level,
    };
    const rows = await evalStore.listEvalRuns(limit, filters);
    return NextResponse.json({ runs: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
