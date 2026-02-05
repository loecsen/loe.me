/**
 * Search decision records. Dev-only. Used by admin Knowledge page.
 */

import { NextResponse } from 'next/server';
import { getDecisionStore } from '../../../../lib/db/provider';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ records: [] });
  }
  try {
    const body = (await request.json()) as {
      intent_substring?: string;
      category?: string;
      intent_lang?: string;
      limit?: number;
    };
    const store = getDecisionStore();
    const records = await store.search({
      intent_substring: body.intent_substring,
      category: body.category,
      intent_lang: body.intent_lang,
      limit: body.limit ?? 50,
    });
    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ records: [] });
  }
}
