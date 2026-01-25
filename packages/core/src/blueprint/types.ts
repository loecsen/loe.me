import type { Block } from '../models';

export type RitualMode = 'progression' | 'practice' | 'maintenance';
export type ValidationMode = 'automatic' | 'self_report' | 'presence';
export type GatingMode = 'strict' | 'soft' | 'none';
export type Axis = 'understand' | 'do' | 'perceive' | 'consolidate';
export type EffortType =
  | 'quiz'
  | 'listen'
  | 'speak'
  | 'read'
  | 'write'
  | 'drill'
  | 'simulation'
  | 'checklist'
  | 'reflection'
  | 'watch'
  | 'practice'
  | 'review';
export type ResourceType = 'loecsen' | 'youtube' | 'web' | 'user';

export type ResourceLink = {
  id: string;
  type: ResourceType;
  title: string;
  url: string;
  whyThis: string;
  language?: string;
  providerHint?: string;
};

export type ResourcePolicy = {
  mode: 'prefer_cached' | 'search_if_missing' | 'manual_only';
  allowEnglishFallback: boolean;
  maxExternalLinksPerMission: number;
};

export type BudgetHints = {
  maxTokensPerMission?: number;
  maxSearchCallsPerMission?: number;
  maxImagesPerMission?: number;
  imageGenerationMode?: 'none' | 'first_only' | 'top_k';
  topKImages?: number;
};

export type ProgressEvent = {
  ritualId: string;
  stepId: string;
  missionId?: string;
  timestamp: string;
  result: 'success' | 'fail' | 'skipped' | 'partial';
  difficulty?: 1 | 2 | 3 | 4 | 5;
  confidence?: 1 | 2 | 3 | 4 | 5;
  timeSpentMin?: number;
  notes?: string;
};

export type Competency = {
  id: string;
  title: string;
  description: string;
  successCriteria?: string[];
};

export type Step = {
  id: string;
  title: string;
  competencyId: string;
  axis: Axis;
  effortType: EffortType;
  durationMin: number;
  required: boolean;
  missionId?: string;
  resources?: ResourceLink[];
  imageKey?: string;
};

export type Level = {
  id: string;
  title: string;
  steps: Step[];
};

export type LearningPath = {
  id: string;
  pathTitle: string;
  pathSummary: string;
  pathDescription?: string;
  feasibilityNote?: string;
  ritualMode: RitualMode;
  validationMode: ValidationMode;
  gatingMode: GatingMode;
  competencies: Competency[];
  resourcePolicy: ResourcePolicy;
  budgetHints: BudgetHints;
  levels: Level[];
};

export type MissionBlock = Block;

export type MissionStub = {
  id: string;
  title: string;
  summary: string;
  missionType?: EffortType;
  competencyId: string;
  axis: Axis;
  durationMin: number;
  resources?: ResourceLink[];
  imageSubject?: string;
};

export type MissionFull = MissionStub & {
  blocks: MissionBlock[];
};
