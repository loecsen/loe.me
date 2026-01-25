import type { MissionBlueprintV2 } from '@loe/core';
import { buildImageKey, getFreeQuota, requestMissionImage } from './utils';
import { getMissionIndex } from './missionIndex';
import { getSelectedStyleId } from './styleSelection';

type MissionData = {
  path?: {
    blueprint?: {
      levels?: Array<{
        steps?: Array<{ missionId?: string }>;
      }>;
    };
  };
};

type BlueprintLike = {
  levels?: Array<{
    steps?: Array<{ missionId?: string }>;
  }>;
};

export async function prefetchMissionImages(
  missions: MissionBlueprintV2[],
  missionData?: MissionData | BlueprintLike,
  limit = 3,
  concurrency = 2,
) {
  const quota = getFreeQuota();
  const capped = Math.min(limit, Number.isFinite(quota) ? quota : limit);
  const queue = missions.slice(0, capped);
  const running = new Set<Promise<void>>();

  const runOne = async (mission: MissionBlueprintV2) => {
    const index = getMissionIndex(mission.id, missionData);
    if (index && index > quota) {
      return;
    }
    const key = await buildImageKey(mission.id);
    await requestMissionImage(
      key,
      mission.summary ?? mission.title,
      '340x190',
      getSelectedStyleId(),
      {
        title: mission.title,
        summary: mission.summary,
      },
    );
  };

  while (queue.length > 0) {
    while (running.size < concurrency && queue.length > 0) {
      const mission = queue.shift();
      if (!mission) break;
      const task = runOne(mission).finally(() => running.delete(task));
      running.add(task);
    }
    if (running.size > 0) {
      await Promise.race(running);
    }
  }
  await Promise.all(running);
}

