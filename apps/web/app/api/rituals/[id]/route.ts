import { NextResponse } from 'next/server';
import { fileExists, readJson } from '../../../../lib/storage/fsStore';
import { getRitualPath } from '../../../../lib/rituals/statusStore';

export const runtime = 'nodejs';

type RitualFile = {
  ritualId?: string;
  path?: unknown;
  missionStubs?: unknown[];
  missionsById?: Record<string, unknown>;
  category?: string;
  audience_safety_level?: 'all_ages' | 'adult_only' | 'blocked';
  debugMeta?: Record<string, unknown>;
};

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const ritualId = params?.id ?? '';
  if (!ritualId) {
    return NextResponse.json({ error: 'missing_ritual_id' }, { status: 400 });
  }

  const ritualPath = getRitualPath(ritualId);
  if (!(await fileExists(ritualPath))) {
    return NextResponse.json({ error: 'ritual_not_found' }, { status: 404 });
  }

  const ritual = await readJson<RitualFile>(ritualPath);
  return NextResponse.json({
    ritualId: ritual.ritualId ?? ritualId,
    path: ritual.path,
    missionStubs: ritual.missionStubs ?? [],
    missions: ritual.missionsById ? Object.values(ritual.missionsById) : [],
    category: ritual.category ?? undefined,
    audience_safety_level: ritual.audience_safety_level,
    debugMeta: ritual.debugMeta,
  });
}
