import type { LearningPathState, RemediationPlan } from '../models';
import { clonePath } from './helpers';
import { recomputeStates } from './recomputeStates';
import { getNextAvailableStep } from './stepQueries';

function getStepRef(path: LearningPathState, levelId: string, stepId: string) {
  const levelIndex = path.progress.levels.findIndex((level) => level.id === levelId);
  if (levelIndex === -1) {
    return null;
  }
  const stepIndex = path.progress.levels[levelIndex].steps.findIndex((step) => step.id === stepId);
  if (stepIndex === -1) {
    return null;
  }
  return { levelIndex, stepIndex };
}

function nextDayISO(now: string): string {
  const date = new Date(now);
  const next = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return next.toISOString();
}

export function markStepStarted(
  path: LearningPathState,
  levelId: string,
  stepId: string,
  now: string,
): LearningPathState {
  const next = clonePath(path);
  const ref = getStepRef(next, levelId, stepId);
  if (!ref) {
    return path;
  }

  const step = next.progress.levels[ref.levelIndex].steps[ref.stepIndex];
  if (step.state !== 'available') {
    return path;
  }

  step.state = 'in_progress';
  step.startedAt = step.startedAt ?? now;
  step.attempts += 1;

  next.progress.current = { levelId, stepId };
  next.progress.updatedAt = now;

  return recomputeStates(next);
}

export function markStepCompleted(
  path: LearningPathState,
  levelId: string,
  stepId: string,
  now: string,
  result: { score?: number },
): LearningPathState {
  const next = clonePath(path);
  const ref = getStepRef(next, levelId, stepId);
  if (!ref) {
    return path;
  }

  const step = next.progress.levels[ref.levelIndex].steps[ref.stepIndex];
  if (step.state === 'locked') {
    return path;
  }

  step.state = 'completed';
  step.completedAt = now;
  step.score = result.score;
  step.remediation = undefined;

  next.progress.updatedAt = now;

  const recomputed = recomputeStates(next);
  const nextStep = getNextAvailableStep(recomputed);
  recomputed.progress.current = nextStep;

  return recomputed;
}

export function markStepFailed(
  path: LearningPathState,
  levelId: string,
  stepId: string,
  now: string,
): LearningPathState {
  const next = clonePath(path);
  const ref = getStepRef(next, levelId, stepId);
  if (!ref) {
    return path;
  }

  const step = next.progress.levels[ref.levelIndex].steps[ref.stepIndex];
  if (step.state === 'locked') {
    return path;
  }

  const remediation: RemediationPlan = {
    eligibleAt: nextDayISO(now),
    options: ['retry', 'remedial_mission'],
  };

  step.state = 'failed';
  step.failedAt = now;
  step.remediation = remediation;

  next.progress.updatedAt = now;

  const recomputed = recomputeStates(next);
  const nextStep = getNextAvailableStep(recomputed);
  recomputed.progress.current = nextStep;

  return recomputed;
}
