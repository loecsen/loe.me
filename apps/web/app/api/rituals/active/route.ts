import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { getDataPath, readJson, fileExists } from '../../../lib/storage/fsStore';

export const runtime = 'nodejs';

type RitualFile = {
  ritualId?: string;
  intention?: string;
  path?: {
    pathTitle?: string;
    pathSummary?: string;
    pathDescription?: string;
    levels?: Array<{
      id: string;
      title: string;
      steps: Array<{ id: string; title: string; missionId?: string }>;
    }>;
    imageUrl?: string;
  };
  missionStubs?: Array<{ id: string; stepId: string; title: string; summary?: string }>;
  missionsById?: Record<string, { id: string; imageUrl?: string }>;
};

const readLatestRitualId = async () => {
  const indexPath = getDataPath('index', 'rituals.ndjson');
  try {
    const raw = await fs.readFile(indexPath, 'utf-8');
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length === 0) {
      return null;
    }
    const last = JSON.parse(lines[lines.length - 1]) as { ritualId?: string };
    return last?.ritualId ?? null;
  } catch {
    return null;
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ritualIdParam = searchParams.get('ritualId') ?? undefined;
  const ritualId = ritualIdParam ?? (await readLatestRitualId());
  if (!ritualId) {
    return NextResponse.json({ error: 'ritual_not_found' }, { status: 404 });
  }
  const ritualPath = getDataPath('rituals', `ritual_${ritualId}.json`);
  const exists = await fileExists(ritualPath);
  if (!exists) {
    return NextResponse.json({ error: 'ritual_not_found', ritualId }, { status: 404 });
  }
  const ritual = await readJson<RitualFile>(ritualPath);
  const level = ritual.path?.levels?.[0];
  const step = level?.steps?.[0];
  const currentStep = step
    ? {
        levelId: level?.id,
        levelTitle: level?.title,
        stepId: step.id,
        stepTitle: step.title,
        levelIndex: 1,
        stepIndex: 1,
      }
    : null;
  const currentMissionStub = step
    ? ritual.missionStubs?.find((stub) => stub.stepId === step.id) ?? null
    : null;
  const missionId = currentMissionStub?.id ?? step?.missionId ?? null;
  const imageUrl =
    ritual.path?.imageUrl ?? (missionId ? ritual.missionsById?.[missionId]?.imageUrl : undefined);

  return NextResponse.json({
    ritualId,
    ritual,
    currentStep,
    currentMissionStub,
    imageUrl,
  });
}
