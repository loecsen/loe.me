import {
  LearningPathSchema,
  MissionFullSchema,
  MissionStubSchema,
} from './schema';
import type { LearningPath, MissionFull, MissionStub } from './types';

const clampDuration = (value: number) => Math.min(10, Math.max(5, value));

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export function validateLearningPath(payload: unknown): ValidationResult<LearningPath> {
  const parsed = LearningPathSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const normalized: LearningPath = {
    ...parsed.data,
    resourcePolicy: parsed.data.resourcePolicy,
    budgetHints: parsed.data.budgetHints,
    levels: parsed.data.levels.map((level) => ({
      ...level,
      steps: level.steps.map((step) => ({
        ...step,
        durationMin: clampDuration(step.durationMin),
      })),
    })),
  };

  const errors: string[] = [];
  normalized.levels.forEach((level) => {
    if (level.steps.length > 5) {
      errors.push(`Level ${level.id} has too many steps (${level.steps.length}).`);
    }
  });

  const competencyIds = new Set(normalized.competencies.map((entry) => entry.id));
  normalized.levels.forEach((level) => {
    level.steps.forEach((step) => {
      if (!competencyIds.has(step.competencyId)) {
        errors.push(`Missing competency for step ${step.id} (${step.competencyId}).`);
      }
    });
  });

  if (normalized.validationMode === 'presence' && normalized.gatingMode !== 'none') {
    errors.push('validationMode presence requires gatingMode none.');
  }

  if (normalized.ritualMode === 'practice' && normalized.gatingMode === 'strict') {
    errors.push('ritualMode practice cannot use strict gating.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: normalized };
}

export function validateMissionStub(payload: unknown): ValidationResult<MissionStub> {
  const parsed = MissionStubSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  }
  const normalized: MissionStub = {
    ...parsed.data,
    durationMin: clampDuration(parsed.data.durationMin),
  };
  return { ok: true, value: normalized };
}

export function validateMissionFull(payload: unknown): ValidationResult<MissionFull> {
  const parsed = MissionFullSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  }
  const normalized: MissionFull = {
    ...parsed.data,
    durationMin: clampDuration(parsed.data.durationMin),
  };
  return { ok: true, value: normalized };
}
