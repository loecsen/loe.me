import { describe, expect, it } from 'vitest';
import type { LearningPath } from '../blueprint/types';
import { computeNextStep } from '../engine/next';
import { validateLearningPath } from '../blueprint/validate';

const basePath = (): LearningPath => ({
  id: 'path-1',
  pathTitle: 'Learn basics',
  pathSummary: 'A short path summary.',
  ritualMode: 'progression',
  validationMode: 'automatic',
  gatingMode: 'strict',
  competencies: [
    {
      id: 'comp-1',
      title: 'Core skill',
      description: 'Build the core skill.',
    },
  ],
  resourcePolicy: {
    mode: 'prefer_cached',
    allowEnglishFallback: true,
    maxExternalLinksPerMission: 3,
  },
  budgetHints: {
    imageGenerationMode: 'top_k',
    topKImages: 4,
    maxSearchCallsPerMission: 1,
  },
  levels: [
    {
      id: 'level-1',
      title: 'Level 1',
      steps: [
        {
          id: 'step-1',
          title: 'Step 1',
          competencyId: 'comp-1',
          axis: 'understand',
          effortType: 'read',
          durationMin: 8,
          required: true,
        },
        {
          id: 'step-2',
          title: 'Step 2',
          competencyId: 'comp-1',
          axis: 'do',
          effortType: 'listen',
          durationMin: 8,
          required: false,
        },
      ],
    },
    {
      id: 'level-2',
      title: 'Level 2',
      steps: [
        {
          id: 'step-3',
          title: 'Step 3',
          competencyId: 'comp-1',
          axis: 'consolidate',
          effortType: 'review',
          durationMin: 8,
          required: true,
        },
      ],
    },
  ],
});

describe('blueprint v2 validation', () => {
  it('rejects missing competencies referenced by steps', () => {
    const payload = basePath();
    payload.levels[0].steps[0].competencyId = 'missing';
    const result = validateLearningPath(payload);
    expect(result.ok).toBe(false);
  });

  it('rejects presence validation with strict gating', () => {
    const payload = basePath();
    payload.validationMode = 'presence';
    payload.gatingMode = 'strict';
    const result = validateLearningPath(payload);
    expect(result.ok).toBe(false);
  });
});

describe('computeNextStep', () => {
  it('strict gating advances once required steps are done', () => {
    const path = basePath();
    const events = [
      {
        ritualId: 'r1',
        stepId: 'step-1',
        timestamp: new Date().toISOString(),
        result: 'success',
      },
    ];
    const next = computeNextStep(path, events);
    expect(next.nextStepId).toBe('step-3');
  });

  it('avoids repeating effortType twice in a row', () => {
    const path = basePath();
    const events = [
      {
        ritualId: 'r1',
        stepId: 'step-1',
        timestamp: new Date().toISOString(),
        result: 'success',
      },
    ];
    const next = computeNextStep(path, events);
    expect(next.nextStepId).not.toBe('step-1');
  });

  it('soft gating schedules remediation after fail', () => {
    const path = basePath();
    path.gatingMode = 'soft';
    path.levels[0].steps.push({
      id: 'step-4',
      title: 'Step 4',
      competencyId: 'comp-1',
      axis: 'perceive',
      effortType: 'speak',
      durationMin: 8,
      required: false,
    });
    const events = [
      {
        ritualId: 'r1',
        stepId: 'step-1',
        timestamp: new Date().toISOString(),
        result: 'fail',
      },
    ];
    const next = computeNextStep(path, events);
    expect(next.nextStepId).toBe('step-2');
    expect(next.reason).toBe('soft-remediation');
  });
});
