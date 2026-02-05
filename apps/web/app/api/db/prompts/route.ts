/**
 * List prompt catalog. Dev-only. Used by admin Knowledge page.
 */

import { NextResponse } from 'next/server';
import { getPromptStore } from '../../../lib/db/provider';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ entries: [] });
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
    const store = getPromptStore();
    const entries = await store.list(limit);
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}
