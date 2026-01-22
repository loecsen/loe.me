import { describe, expect, it } from 'vitest';
import {
  canOpenStep,
  getNextAvailableStep,
  markStepCompleted,
  markStepFailed,
  markStepStarted,
  recomputeStates,
} from '../logic';
import { createSamplePath_3levels_3_4_3 } from '../sample';

const now = new Date('2025-01-01T10:00:00.000Z').toISOString();

function bootstrapPath() {
  const path = createSamplePath_3levels_3_4_3();
  return recomputeStates(path);
}

describe('Mission Engine gating', () => {
  it('cannot open locked level', () => {
    const path = bootstrapPath();
    expect(canOpenStep(path, 'level-2', 'step-2-1')).toBe(false);
  });

  it('completing last required step unlocks next level', () => {
    let path = bootstrapPath();
    path = markStepStarted(path, 'level-1', 'step-1-1', now);
    path = markStepCompleted(path, 'level-1', 'step-1-1', now, {});
    path = markStepStarted(path, 'level-1', 'step-1-2', now);
    path = markStepCompleted(path, 'level-1', 'step-1-2', now, {});
    path = markStepStarted(path, 'level-1', 'step-1-3', now);
    path = markStepCompleted(path, 'level-1', 'step-1-3', now, {});

    const recomputed = recomputeStates(path);
    expect(canOpenStep(recomputed, 'level-2', 'step-2-1')).toBe(true);
  });

  it('failing a step keeps next level locked', () => {
    let path = bootstrapPath();
    path = markStepStarted(path, 'level-1', 'step-1-1', now);
    path = markStepFailed(path, 'level-1', 'step-1-1', now);

    const recomputed = recomputeStates(path);
    expect(canOpenStep(recomputed, 'level-2', 'step-2-1')).toBe(false);
  });

  it('optional steps do not block next level when required steps completed', () => {
    let path = bootstrapPath();
    path = markStepStarted(path, 'level-1', 'step-1-1', now);
    path = markStepCompleted(path, 'level-1', 'step-1-1', now, {});
    path = markStepStarted(path, 'level-1', 'step-1-2', now);
    path = markStepCompleted(path, 'level-1', 'step-1-2', now, {});
    path = markStepStarted(path, 'level-1', 'step-1-3', now);
    path = markStepCompleted(path, 'level-1', 'step-1-3', now, {});

    path = markStepStarted(path, 'level-2', 'step-2-1', now);
    path = markStepCompleted(path, 'level-2', 'step-2-1', now, {});
    path = markStepStarted(path, 'level-2', 'step-2-2', now);
    path = markStepCompleted(path, 'level-2', 'step-2-2', now, {});
    path = markStepStarted(path, 'level-2', 'step-2-3', now);
    path = markStepCompleted(path, 'level-2', 'step-2-3', now, { score: 90 });

    const recomputed = recomputeStates(path);
    expect(canOpenStep(recomputed, 'level-3', 'step-3-1')).toBe(true);
  });

  it('markStepCompleted updates current pointers correctly', () => {
    let path = bootstrapPath();
    path = markStepStarted(path, 'level-1', 'step-1-1', now);
    path = markStepCompleted(path, 'level-1', 'step-1-1', now, {});

    const next = getNextAvailableStep(path);
    expect(path.progress.current).toEqual(next);
  });
});
