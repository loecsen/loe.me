import type { LearningPathState, StepProgress } from '../models';
import { clonePath } from './helpers';

function areRequiredStepsCompleted(levelSteps: { id: string; required: boolean }[],
  progressSteps: StepProgress[],
): boolean {
  return levelSteps.every((step) => {
    if (!step.required) {
      return true;
    }
    const progress = progressSteps.find((s) => s.id === step.id);
    return progress?.state === 'completed';
  });
}

export function recomputeStates(path: LearningPathState): LearningPathState {
  const next = clonePath(path);

  next.progress.levels.forEach((levelProgress, index) => {
    const levelBlueprint = next.blueprint.levels[index];
    const previousLevel = index > 0 ? next.blueprint.levels[index - 1] : null;
    const previousProgress = index > 0 ? next.progress.levels[index - 1] : null;

    const gatingSatisfied =
      index === 0 ||
      (previousLevel && previousProgress
        ? areRequiredStepsCompleted(previousLevel.steps, previousProgress.steps)
        : false);

    if (!gatingSatisfied) {
      levelProgress.state = 'locked';
      levelProgress.steps = levelProgress.steps.map((step) => {
        if (step.state === 'completed' || step.state === 'failed') {
          return step;
        }
        return { ...step, state: 'locked' };
      });
      return;
    }

    let hasInProgress = false;
    let allCompleted = true;

    levelProgress.steps = levelProgress.steps.map((step) => {
      if (step.state === 'in_progress') {
        hasInProgress = true;
      }

      if (step.state !== 'completed') {
        allCompleted = false;
      }

      if (step.state === 'locked') {
        return { ...step, state: 'available' };
      }

      return step;
    });

    if (allCompleted) {
      levelProgress.state = 'completed';
    } else if (hasInProgress) {
      levelProgress.state = 'in_progress';
    } else {
      levelProgress.state = 'available';
    }
  });

  return next;
}
