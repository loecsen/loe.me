import type { LearningPathState } from '../models';

export type ValidationError = {
  code: string;
  message: string;
  levelId?: string;
};

export function validatePath(path: LearningPathState): ValidationError[] {
  const errors: ValidationError[] = [];
  const levelIds = new Set<string>();

  path.blueprint.levels.forEach((level, levelIndex) => {
    if (levelIds.has(level.id)) {
      errors.push({
        code: 'level.duplicate',
        message: `Duplicate level id: ${level.id}`,
        levelId: level.id,
      });
    }
    levelIds.add(level.id);

    if (level.steps.length < 3 || level.steps.length > 5) {
      errors.push({
        code: 'level.steps.count',
        message: `Level ${level.id} must have 3 to 5 steps, got ${level.steps.length}.`,
        levelId: level.id,
      });
    }

    const stepIds = new Set<string>();
    level.steps.forEach((step) => {
      if (stepIds.has(step.id)) {
        errors.push({
          code: 'step.duplicate',
          message: `Duplicate step id: ${step.id} in level ${level.id}.`,
          levelId: level.id,
        });
      }
      stepIds.add(step.id);

      if (!step.title.trim()) {
        errors.push({
          code: 'step.title.empty',
          message: `Step ${step.id} in level ${level.id} has an empty title.`,
          levelId: level.id,
        });
      }
    });

    const progressLevel = path.progress.levels[levelIndex];
    if (!progressLevel || progressLevel.id !== level.id) {
      errors.push({
        code: 'progress.level.mismatch',
        message: `Progress level mismatch at index ${levelIndex}.`,
        levelId: level.id,
      });
      return;
    }

    if (progressLevel.steps.length !== level.steps.length) {
      errors.push({
        code: 'progress.steps.count',
        message: `Progress steps count mismatch for level ${level.id}.`,
        levelId: level.id,
      });
    }
  });

  return errors;
}
