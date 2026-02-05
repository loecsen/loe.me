/**
 * List latest decision records. Dev-only. Used by admin Knowledge page.
 */

import { NextResponse } from 'next/server';
import { getDecisionStore } from '../../../lib/db/provider';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ records: [] });
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const store = getDecisionStore();
    const records = await store.list(limit);
    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ records: [] });
  }
}
