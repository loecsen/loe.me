import { NextResponse } from 'next/server';
import { fileExists } from '../../../../lib/storage/fsStore';
import {
  getLockPath,
  getRitualPath,
  readRitualStatus,
  type RitualStatusRecord,
} from '../../../../lib/rituals/statusStore';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const ritualId = params?.id ?? '';
  if (!ritualId) {
    return NextResponse.json({ error: 'missing_ritual_id' }, { status: 400 });
  }

  const ritualPath = getRitualPath(ritualId);
  if (await fileExists(ritualPath)) {
    return NextResponse.json({ status: 'ready' });
  }

  const status = (await readRitualStatus(ritualId)) as RitualStatusRecord | null;
  if (status?.status) {
    return NextResponse.json({
      status: status.status,
      ...(status.lastError ? { lastError: status.lastError } : {}),
    });
  }

  if (await fileExists(getLockPath(ritualId))) {
    return NextResponse.json({ status: 'pending', locked: true });
  }

  return NextResponse.json({ status: 'pending' });
}
