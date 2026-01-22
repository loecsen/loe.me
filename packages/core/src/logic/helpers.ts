import type {
  LearningPathBlueprintV2,
  LearningPathProgress,
  LearningPathState,
  Step,
  StepProgress,
} from '../models';

export function buildInitialProgress(blueprint: LearningPathBlueprintV2): LearningPathProgress {
  return {
    levels: blueprint.levels.map((level) => ({
      id: level.id,
      state: 'locked',
      steps: level.steps.map((step) => buildStepProgress(step)),
    })),
    current: null,
  };
}

export function buildStepProgress(step: Step): StepProgress {
  return {
    id: step.id,
    state: 'locked',
    attempts: 0,
  };
}

export function clonePath(path: LearningPathState): LearningPathState {
  return {
    blueprint: path.blueprint,
    progress: {
      ...path.progress,
      levels: path.progress.levels.map((level) => ({
        ...level,
        steps: level.steps.map((step) => ({ ...step })),
      })),
      current: path.progress.current ? { ...path.progress.current } : path.progress.current,
    },
  };
}
