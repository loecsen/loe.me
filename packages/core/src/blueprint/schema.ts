import { z } from 'zod';

export const RitualModeSchema = z.enum(['progression', 'practice', 'maintenance']);
export const ValidationModeSchema = z.enum(['automatic', 'self_report', 'presence']);
export const GatingModeSchema = z.enum(['strict', 'soft', 'none']);
export const AxisSchema = z.enum(['understand', 'do', 'perceive', 'consolidate']);
export const EffortTypeSchema = z.enum([
  'quiz',
  'listen',
  'speak',
  'read',
  'write',
  'drill',
  'simulation',
  'checklist',
  'reflection',
  'watch',
  'practice',
  'review',
]);
export const ResourceTypeSchema = z.enum(['loecsen', 'youtube', 'web', 'user']);

export const ResourceLinkSchema = z.object({
  id: z.string().min(1),
  type: ResourceTypeSchema,
  title: z.string().min(1),
  url: z.string(),
  whyThis: z.string().min(1),
  language: z.string().optional(),
  providerHint: z.string().optional(),
});

export const ResourcePolicySchema = z
  .object({
    mode: z.enum(['prefer_cached', 'search_if_missing', 'manual_only']).optional(),
    allowEnglishFallback: z.boolean().optional(),
    maxExternalLinksPerMission: z.number().int().positive().optional(),
  })
  .default({})
  .transform((value) => ({
    mode: value.mode ?? 'prefer_cached',
    allowEnglishFallback: value.allowEnglishFallback ?? true,
    maxExternalLinksPerMission: value.maxExternalLinksPerMission ?? 3,
  }));

export const BudgetHintsSchema = z
  .object({
    maxTokensPerMission: z.number().int().positive().optional(),
    maxSearchCallsPerMission: z.number().int().nonnegative().optional(),
    maxImagesPerMission: z.number().int().nonnegative().optional(),
    imageGenerationMode: z.enum(['none', 'first_only', 'top_k']).optional(),
    topKImages: z.number().int().positive().optional(),
  })
  .default({})
  .transform((value) => ({
    maxTokensPerMission: value.maxTokensPerMission,
    maxSearchCallsPerMission: value.maxSearchCallsPerMission ?? 1,
    maxImagesPerMission: value.maxImagesPerMission,
    imageGenerationMode: value.imageGenerationMode ?? 'top_k',
    topKImages: value.topKImages ?? 4,
  }));

export const CompetencySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  successCriteria: z.array(z.string().min(1)).optional(),
});

export const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  competencyId: z.string().min(1),
  axis: AxisSchema,
  effortType: EffortTypeSchema,
  durationMin: z.number().int(),
  required: z.boolean(),
  missionId: z.string().optional(),
  resources: z.array(ResourceLinkSchema).optional(),
  imageKey: z.string().optional(),
});

export const LevelSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  steps: z.array(StepSchema),
});

export const LearningPathSchema = z.object({
  id: z.string().min(1),
  pathTitle: z.string().min(1),
  pathSummary: z.string().min(1),
  pathDescription: z.string().optional(),
  feasibilityNote: z.string().optional(),
  ritualMode: RitualModeSchema,
  validationMode: ValidationModeSchema,
  gatingMode: GatingModeSchema,
  competencies: z.array(CompetencySchema).min(1),
  resourcePolicy: ResourcePolicySchema,
  budgetHints: BudgetHintsSchema,
  levels: z.array(LevelSchema).min(1),
});

export const MissionBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1) }),
  z.object({
    type: z.literal('media'),
    mediaType: z.enum(['image', 'video']),
    url: z.string().min(1),
    caption: z.string().optional(),
  }),
  z.object({ type: z.literal('checklist'), items: z.array(z.string().min(1)).min(1) }),
  z.object({
    type: z.literal('quiz'),
    question: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2),
    correctIndex: z.number().int().nonnegative().optional(),
  }),
]);

export const MissionStubSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  missionType: EffortTypeSchema.optional(),
  competencyId: z.string().min(1),
  axis: AxisSchema,
  durationMin: z.number().int(),
  resources: z.array(ResourceLinkSchema).optional(),
  imageSubject: z.string().optional(),
});

export const MissionFullSchema = MissionStubSchema.extend({
  blocks: z.array(MissionBlockSchema).min(1),
});
