import { NextResponse } from 'next/server';
import { getDataPath, readJson } from '../../../lib/storage/fsStore';
import type { ProgressEventInput } from '../../../lib/missions/progressTypes';
import { recordProgressEvent } from '../../../lib/missions/progressStore';

type Payload = Omit<ProgressEventInput, 'meta'>;

type RitualSnapshot = {
  ritualId: string;
  locale?: string;
  path?: { validationMode?: string };
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Payload>;
  if (!body?.ritualId || !body?.missionId || !body?.stepId || !body?.outcome) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const ritualPath = getDataPath('rituals', `ritual_${body.ritualId}.json`);
  let ritual: RitualSnapshot | null = null;
  try {
    ritual = await readJson<RitualSnapshot>(ritualPath);
  } catch {
    return NextResponse.json(
      { error: 'ritual_not_found', ritualId: body.ritualId, ritualPath },
      { status: 404 },
    );
  }

  const result = await recordProgressEvent({
    ritualId: body.ritualId,
    missionId: body.missionId,
    stepId: body.stepId,
    outcome: body.outcome,
    score: body.score,
    timeSpentMin: body.timeSpentMin,
    notes: body.notes,
    quiz: body.quiz,
    meta: {
      client: 'web',
      locale: ritual?.locale,
      validationMode: ritual?.path?.validationMode,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, details: result.details, ritualPath: result.ritualPath },
      { status: 400 },
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[missions.progress]', {
      ritualId: body.ritualId,
      missionId: body.missionId,
      outcome: body.outcome,
      score: body.score,
    });
  }

  return NextResponse.json({ ok: true, progressEvent: result.progressEvent });
}
