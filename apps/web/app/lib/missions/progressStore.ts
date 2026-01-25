import { getDataPath, readJson, writeJsonAtomic, appendNdjson } from '../storage/fsStore';
import type { ProgressEvent, ProgressEventInput } from './progressTypes';
import { buildProgressEvent } from './progressTypes';

type RitualWithProgress = {
  ritualId: string;
  updatedAt?: string;
  progress?: ProgressEvent[];
  lastProgressByMissionId?: Record<string, ProgressEvent>;
};

type RecordProgressResult =
  | { ok: true; progressEvent: ProgressEvent; ritual: RitualWithProgress }
  | { ok: false; error: string; details?: unknown; ritualPath?: string };

export async function recordProgressEvent(
  input: ProgressEventInput,
): Promise<RecordProgressResult> {
  const ritualPath = getDataPath('rituals', `ritual_${input.ritualId}.json`);
  let ritual: RitualWithProgress;
  try {
    ritual = await readJson<RitualWithProgress>(ritualPath);
  } catch {
    return { ok: false, error: 'ritual_not_found', ritualPath };
  }

  const parsed = buildProgressEvent(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_progress_event', details: parsed.error.issues };
  }

  const progressEvent = parsed.data;
  await appendNdjson(getDataPath('index', 'progress.ndjson'), progressEvent);

  const progress = [...(ritual.progress ?? []), progressEvent];
  const lastProgressByMissionId = {
    ...(ritual.lastProgressByMissionId ?? {}),
    [progressEvent.missionId]: progressEvent,
  };
  const updated = {
    ...ritual,
    progress,
    lastProgressByMissionId,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(ritualPath, updated);

  return { ok: true, progressEvent, ritual: updated };
}
