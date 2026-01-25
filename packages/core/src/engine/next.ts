import type {
  EffortType,
  LearningPath,
  ProgressEvent,
  Step,
} from '../blueprint/types';

type IndexedStep = Step & { levelId: string; levelIndex: number; stepIndex: number };

type NextStepResult = {
  nextStepId: string | null;
  reason: string;
  remediationFor?: string;
};

const buildStepIndex = (path: LearningPath) => {
  const steps: IndexedStep[] = [];
  path.levels.forEach((level, levelIndex) => {
    level.steps.forEach((step, stepIndex) => {
      steps.push({ ...step, levelId: level.id, levelIndex, stepIndex });
    });
  });
  const stepById = new Map(steps.map((step) => [step.id, step]));
  return { steps, stepById };
};

const sortEvents = (events: ProgressEvent[]) =>
  [...events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

const pickWithEffortVariety = (
  candidates: IndexedStep[],
  lastEffortType?: EffortType,
  lastResult?: ProgressEvent['result'],
) => {
  if (!lastEffortType) {
    return candidates[0] ?? null;
  }
  const differentEffort = candidates.filter((step) => step.effortType !== lastEffortType);
  if (differentEffort.length > 0) {
    return differentEffort[0];
  }
  if (lastResult === 'fail') {
    return candidates.find((step) => step.effortType !== lastEffortType) ?? candidates[0] ?? null;
  }
  return candidates[0] ?? null;
};

export function computeNextStep(path: LearningPath, events: ProgressEvent[]): NextStepResult {
  const { steps, stepById } = buildStepIndex(path);
  const orderedEvents = sortEvents(events);
  const lastEvent = orderedEvents[orderedEvents.length - 1];
  const lastStep = lastEvent ? stepById.get(lastEvent.stepId) : undefined;
  const lastEffortType = lastStep?.effortType;
  const lastResult = lastEvent?.result;

  const completed = new Set(
    orderedEvents.filter((event) => event.result === 'success').map((event) => event.stepId),
  );

  const needsNoGating =
    path.validationMode === 'presence' || path.ritualMode === 'practice';

  const pickRemediation = () => {
    if (!lastEvent || (lastEvent.result !== 'fail' && lastEvent.result !== 'partial')) {
      return null;
    }
    const sameCompetency = steps.filter(
      (step) =>
        step.competencyId === lastStep?.competencyId && !completed.has(step.id),
    );
    if (sameCompetency.length === 0) {
      return null;
    }
    return pickWithEffortVariety(sameCompetency, lastEffortType, lastResult);
  };

  if (path.gatingMode === 'soft' && !needsNoGating) {
    const remediation = pickRemediation();
    if (remediation) {
      return {
        nextStepId: remediation.id,
        reason: 'soft-remediation',
        remediationFor: remediation.competencyId,
      };
    }
  }

  if (path.gatingMode === 'strict' && !needsNoGating) {
    for (const level of path.levels) {
      const levelSteps = steps.filter((step) => step.levelId === level.id);
      const requiredIncomplete = levelSteps.filter(
        (step) => step.required && !completed.has(step.id),
      );
      if (requiredIncomplete.length > 0) {
        const pick = pickWithEffortVariety(requiredIncomplete, lastEffortType, lastResult);
        return {
          nextStepId: pick?.id ?? null,
          reason: 'strict-required',
        };
      }
      const incomplete = levelSteps.filter((step) => !completed.has(step.id));
      if (incomplete.length > 0) {
        const nextLevelIndex = path.levels.findIndex((entry) => entry.id === level.id) + 1;
        const nextLevel = path.levels[nextLevelIndex];
        if (nextLevel) {
          const nextSteps = steps.filter(
            (step) => step.levelId === nextLevel.id && !completed.has(step.id),
          );
          const pick = pickWithEffortVariety(nextSteps, lastEffortType, lastResult);
          if (pick) {
            return { nextStepId: pick.id, reason: 'strict-next-level' };
          }
        }
        const pick = pickWithEffortVariety(incomplete, lastEffortType, lastResult);
        return { nextStepId: pick?.id ?? null, reason: 'strict-optional' };
      }
    }
    return { nextStepId: null, reason: 'complete' };
  }

  if (needsNoGating) {
    const remaining = steps.filter((step) => !completed.has(step.id));
    const pick = pickWithEffortVariety(remaining, lastEffortType, lastResult);
    return { nextStepId: pick?.id ?? null, reason: 'no-gating' };
  }

  const remediation = pickRemediation();
  if (remediation) {
    return {
      nextStepId: remediation.id,
      reason: 'soft-remediation',
      remediationFor: remediation.competencyId,
    };
  }

  const remaining = steps.filter((step) => !completed.has(step.id));
  const pick = pickWithEffortVariety(remaining, lastEffortType, lastResult);
  return { nextStepId: pick?.id ?? null, reason: 'next-available' };
}

export function summarizeProgress(path: LearningPath, events: ProgressEvent[]) {
  const { steps, stepById } = buildStepIndex(path);
  const orderedEvents = sortEvents(events);
  const lastEvent = orderedEvents[orderedEvents.length - 1];
  const lastStep = lastEvent ? stepById.get(lastEvent.stepId) : undefined;
  const completedSteps = new Set(
    orderedEvents.filter((event) => event.result === 'success').map((event) => event.stepId),
  );
  return {
    totalSteps: steps.length,
    completedSteps: completedSteps.size,
    lastEvent,
    lastEffortType: lastStep?.effortType,
  };
}
