type BlueprintLike = {
  levels?: Array<{
    steps?: Array<{ missionId?: string }>;
  }>;
};

type MissionData = {
  path?: {
    blueprint?: BlueprintLike;
  };
};

export function getMissionIndex(
  missionId: string,
  source?: MissionData | BlueprintLike,
) {
  let levels: BlueprintLike['levels'] | undefined;
  if (source && 'levels' in source) {
    levels = source.levels;
  } else if (source && 'path' in source) {
    levels = source.path?.blueprint?.levels;
  } else if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('loe.missionData');
      const data = raw ? (JSON.parse(raw) as MissionData) : undefined;
      levels = data?.path?.blueprint?.levels;
    } catch {
      levels = undefined;
    }
  }

  const resolvedLevels = levels ?? [];
  let index = 0;
  for (const level of resolvedLevels) {
    for (const step of level.steps ?? []) {
      if (step.missionId) {
        index += 1;
        if (step.missionId === missionId) {
          return index;
        }
      }
    }
  }
  return null;
}

