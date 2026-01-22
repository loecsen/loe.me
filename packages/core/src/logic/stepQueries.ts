import type { LearningPathState } from '../models';
import { recomputeStates } from './recomputeStates';

export function getNextAvailableStep(
  path: LearningPathState,
): { levelId: string; stepId: string } | null {
  const recomputed = recomputeStates(path);

  for (const level of recomputed.progress.levels) {
    for (const step of level.steps) {
      if (step.state === 'available') {
        return { levelId: level.id, stepId: step.id };
      }
    }
  }

  return null;
}

export function canOpenStep(path: LearningPathState, levelId: string, stepId: string): boolean {
  const recomputed = recomputeStates(path);
  const level = recomputed.progress.levels.find((item) => item.id === levelId);
  if (!level) {
    return false;
  }
  const step = level.steps.find((item) => item.id === stepId);
  return step?.state === 'available';
}
