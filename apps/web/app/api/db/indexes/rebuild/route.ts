/**
 * Rebuild all DB indexes. Dev-only. Used by admin Knowledge page.
 */

import { NextResponse } from 'next/server';
import { rebuildAllIndexes } from '../../../../lib/db/provider';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    await rebuildAllIndexes();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
