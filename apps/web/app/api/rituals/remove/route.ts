import { NextResponse } from 'next/server';
import { appendNdjson, getDataPath } from '../../../lib/storage/fsStore';

export const runtime = 'nodejs';

type RemovePayload = { id?: string };

export async function POST(request: Request) {
  let payload: RemovePayload | null = null;
  try {
    payload = (await request.json()) as RemovePayload;
  } catch {
    payload = null;
  }

  const ritualId = payload?.id?.trim();
  if (!ritualId) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const now = new Date().toISOString();
  await appendNdjson(getDataPath('index', 'rituals.ndjson'), {
    ritualId,
    hidden: true,
    updatedAt: now,
    lastViewedAt: now,
  });

  return NextResponse.json({ ok: true });
}
