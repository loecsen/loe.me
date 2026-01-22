export type StepState = 'locked' | 'available' | 'in_progress' | 'completed' | 'failed';
export type LevelState = 'locked' | 'available' | 'in_progress' | 'completed';
export type PassCriteria = 'completion' | 'score' | 'mixed';

export type TextBlock = {
  type: 'text';
  text: string;
};

export type MediaBlock = {
  type: 'media';
  mediaType: 'image' | 'video';
  url: string;
  caption?: string;
};

export type ChecklistBlock = {
  type: 'checklist';
  items: string[];
};

export type QuizBlock = {
  type: 'quiz';
  question: string;
  choices: string[];
  correctIndex?: number;
};

export type Block = TextBlock | MediaBlock | ChecklistBlock | QuizBlock;

export type MissionBlueprintV2 = {
  id: string;
  title: string;
  summary?: string;
  passCriteria: PassCriteria;
  minScore?: number;
  blocks: Block[];
};

export type Step = {
  id: string;
  title: string;
  missionId?: string;
  required: boolean;
  passCriteria: PassCriteria;
};

export type Level = {
  id: string;
  title: string;
  steps: Step[];
};

export type LearningPathBlueprintV2 = {
  id: string;
  title: string;
  summary?: string;
  levels: Level[];
};

export type RemediationPlan = {
  eligibleAt: string;
  options: Array<'retry' | 'remedial_mission'>;
};

export type StepProgress = {
  id: string;
  state: StepState;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  score?: number;
  attempts: number;
  remediation?: RemediationPlan;
};

export type LevelProgress = {
  id: string;
  state: LevelState;
  steps: StepProgress[];
};

export type LearningPathProgress = {
  levels: LevelProgress[];
  current?: { levelId: string; stepId: string } | null;
  updatedAt?: string;
};

export type LearningPathState = {
  blueprint: LearningPathBlueprintV2;
  progress: LearningPathProgress;
};
