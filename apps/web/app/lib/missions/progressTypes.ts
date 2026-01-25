import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export type Outcome = 'success' | 'fail' | 'partial' | 'skipped';

export type ProgressEvent = {
  id: string;
  ritualId: string;
  missionId: string;
  stepId: string;
  createdAt: string;
  outcome: Outcome;
  score?: number;
  timeSpentMin?: number;
  notes?: string;
  quiz?: {
    questionId?: string;
    selectedIndex?: number;
    correct?: boolean;
  };
  meta?: {
    client?: 'web';
    locale?: string;
    validationMode?: string;
  };
};

const clampNumber = (value: unknown, min: number, max: number) =>
  typeof value === 'number' ? Math.min(Math.max(value, min), max) : value;

export const ProgressEventSchema = z.object({
  id: z.string().min(1),
  ritualId: z.string().min(1),
  missionId: z.string().min(1),
  stepId: z.string().min(1),
  createdAt: z.string().min(1),
  outcome: z.enum(['success', 'fail', 'partial', 'skipped']),
  score: z
    .preprocess((value) => clampNumber(value, 0, 1), z.number().min(0).max(1))
    .optional(),
  timeSpentMin: z
    .preprocess((value) => clampNumber(value, 0, 60), z.number().min(0).max(60))
    .optional(),
  notes: z
    .preprocess((value) => (typeof value === 'string' ? value.slice(0, 280) : value), z.string())
    .optional(),
  quiz: z
    .object({
      questionId: z.string().optional(),
      selectedIndex: z.number().int().optional(),
      correct: z.boolean().optional(),
    })
    .optional(),
  meta: z
    .object({
      client: z.literal('web').optional(),
      locale: z.string().optional(),
      validationMode: z.string().optional(),
    })
    .optional(),
});

export type ProgressEventInput = {
  ritualId: string;
  missionId: string;
  stepId: string;
  outcome: Outcome;
  score?: number;
  timeSpentMin?: number;
  notes?: string;
  quiz?: ProgressEvent['quiz'];
  meta?: ProgressEvent['meta'];
};

export function buildProgressEvent(input: ProgressEventInput) {
  const raw: ProgressEvent = {
    id: randomUUID(),
    ritualId: input.ritualId,
    missionId: input.missionId,
    stepId: input.stepId,
    createdAt: new Date().toISOString(),
    outcome: input.outcome,
    score: input.score,
    timeSpentMin: input.timeSpentMin,
    notes: input.notes,
    quiz: input.quiz,
    meta: input.meta,
  };
  return ProgressEventSchema.safeParse(raw);
}
