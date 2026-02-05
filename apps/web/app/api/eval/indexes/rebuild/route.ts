/**
 * Rebuild eval_runs index. Dev-only.
 */

import { NextResponse } from 'next/server';
import { rebuildEvalIndex } from '../../../../lib/db/evalStore.file';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    await rebuildEvalIndex();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
