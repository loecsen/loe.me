import { NextResponse } from 'next/server';
import { rebuildIndex } from '../../../../../lib/db/ideaRoutineStore.file';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  await rebuildIndex();
  return NextResponse.json({ ok: true });
}
