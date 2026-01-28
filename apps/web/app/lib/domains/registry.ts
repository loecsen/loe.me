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

export type ResourceProvider = 'loecsen' | 'youtube' | 'web' | 'userProvided';

export type DomainProfile = {
  label: string;
  intent: string;
  audience?: string;
};

export type ResourcePolicy = {
  allowSearch: boolean;
  maxResources: number;
  preferOrder: ResourceProvider[];
  languageFallback: boolean;
};

export type DomainPlaybook = {
  id: string;
  label: string;
  version: number;
  profile: DomainProfile;
  intentHints?: string[];
  allowedEffortTypes: EffortType[];
  weights: Partial<Record<EffortType, number>>;
  rules: string[];
  remediationRules: string[];
  resourcePolicy: ResourcePolicy;
};

const basePolicy = {
  allowSearch: false,
  maxResources: 3,
  preferOrder: ['loecsen', 'userProvided', 'youtube', 'web'] as ResourceProvider[],
  languageFallback: true,
};

export const DOMAIN_PLAYBOOKS: DomainPlaybook[] = [
  {
    id: 'language',
    label: 'Language learning',
    version: 1,
    profile: {
      label: 'Language acquisition',
      intent: 'Build practical language skills with balanced input/output.',
      audience: 'Learners building real-world language fluency.',
    },
    intentHints: [
      'Spanish A2 in 30 days',
      'Chinese beginner tones',
      'French pronunciation practice',
    ],
    allowedEffortTypes: ['listen', 'speak', 'read', 'write', 'quiz', 'practice', 'review'],
    weights: {
      listen: 2,
      speak: 2,
      read: 1,
      write: 1,
      quiz: 1,
      practice: 2,
      review: 1,
    },
    rules: [
      'Always include a real-life scenario context.',
      'Balance receptive and productive skills.',
      'Prefer short, repeatable drills over long lectures.',
      'Keep instructions concise and action-oriented.',
    ],
    remediationRules: [
      'If the user fails, switch to a simpler skill with more guidance.',
      'Reduce cognitive load by focusing on one skill at a time.',
      'Add extra repetition with gentle feedback.',
    ],
    resourcePolicy: basePolicy,
  },
  {
    id: 'fitness_sport',
    label: 'Fitness & sport',
    version: 1,
    profile: {
      label: 'Physical conditioning',
      intent: 'Improve form, consistency, and measurable fitness outcomes.',
      audience: 'People building healthy training habits.',
    },
    intentHints: ['Learn tennis serve', 'Crawl swimming technique', 'Start running 3x/week'],
    allowedEffortTypes: ['practice', 'drill', 'checklist', 'reflection', 'review'],
    weights: {
      practice: 3,
      drill: 2,
      checklist: 1,
      reflection: 1,
      review: 1,
    },
    rules: [
      'Safety first: emphasize form and rest.',
      'Use short, repeatable sessions.',
      'Progress gradually; avoid overtraining.',
      'Include warm-up and cool-down reminders.',
    ],
    remediationRules: [
      'If skipped, offer a shorter alternative.',
      'Reduce intensity before increasing volume.',
      'Use checklists for accountability.',
    ],
    resourcePolicy: { ...basePolicy, preferOrder: ['userProvided', 'web', 'youtube'] },
  },
  {
    id: 'professional_skills',
    label: 'Professional skills',
    version: 1,
    profile: {
      label: 'Workplace mastery',
      intent: 'Build practical professional skills with measurable outcomes.',
      audience: 'Professionals improving day-to-day performance.',
    },
    intentHints: ['Write better emails', 'Lead better meetings', 'Pitch a project'],
    allowedEffortTypes: ['read', 'write', 'simulation', 'reflection', 'review', 'practice'],
    weights: {
      read: 1,
      write: 2,
      simulation: 2,
      reflection: 1,
      review: 1,
      practice: 2,
    },
    rules: [
      'Keep missions tied to real workplace tasks.',
      'Favor tangible outputs (emails, docs, checklists).',
      'Use simulations to practice difficult scenarios.',
      'Keep timeboxes strict and focused.',
    ],
    remediationRules: [
      'If failing, simplify the deliverable and reattempt.',
      'Add an example or template before retry.',
      'Focus on one sub-skill per remediation.',
    ],
    resourcePolicy: { ...basePolicy, preferOrder: ['userProvided', 'web'] },
  },
  {
    id: 'business_growth',
    label: 'Business growth',
    version: 1,
    profile: {
      label: 'Business execution',
      intent: 'Drive growth via experiments, feedback, and iteration.',
      audience: 'Builders and operators.',
    },
    intentHints: ['Acquire first 100 users', 'Improve conversion rate', 'Launch a newsletter'],
    allowedEffortTypes: ['practice', 'simulation', 'reflection', 'review', 'write'],
    weights: {
      practice: 2,
      simulation: 2,
      reflection: 1,
      review: 1,
      write: 2,
    },
    rules: [
      'Prefer small experiments over big bets.',
      'Always include a measurable outcome.',
      'Keep customer feedback in the loop.',
      'Document learnings after each mission.',
    ],
    remediationRules: [
      'If stuck, reduce scope and repeat the experiment.',
      'Add a checklist to ensure completion.',
      'Shift to reflection to extract insights.',
    ],
    resourcePolicy: { ...basePolicy, preferOrder: ['userProvided', 'web'] },
  },
  {
    id: 'wellbeing_meditation',
    label: 'Wellbeing & meditation',
    version: 1,
    profile: {
      label: 'Wellbeing practice',
      intent: 'Build calm, consistent wellbeing routines.',
      audience: 'People improving mental wellbeing.',
    },
    intentHints: ['Meditate 10 minutes a day', 'Reduce stress before sleep', 'Morning breathing'],
    allowedEffortTypes: ['practice', 'reflection', 'review', 'checklist'],
    weights: {
      practice: 3,
      reflection: 2,
      review: 1,
      checklist: 1,
    },
    rules: [
      'Keep sessions short and gentle.',
      'Emphasize breathing and presence.',
      'Avoid judgmental language.',
      'Encourage consistency over intensity.',
    ],
    remediationRules: [
      'If missed, offer a 2-minute alternative.',
      'Reduce friction with a single-step action.',
      'Focus on grounding before progression.',
    ],
    resourcePolicy: { ...basePolicy, preferOrder: ['userProvided', 'web'] },
  },
  {
    id: 'tech_coding',
    label: 'Tech & coding',
    version: 1,
    profile: {
      label: 'Software mastery',
      intent: 'Build hands-on coding skills with clear deliverables.',
      audience: 'Developers and learners.',
    },
    intentHints: ['Learn React basics', 'Build a todo app in JS', 'Understand TypeScript types'],
    allowedEffortTypes: ['practice', 'drill', 'read', 'write', 'simulation', 'review'],
    weights: {
      practice: 3,
      drill: 2,
      read: 1,
      write: 1,
      simulation: 1,
      review: 1,
    },
    rules: [
      'Favor hands-on tasks with concrete outputs.',
      'Limit scope to one concept per mission.',
      'Include a quick self-check at the end.',
      'Keep setups minimal and explicit.',
    ],
    remediationRules: [
      'If failing, simplify requirements and retry.',
      'Provide a smaller, focused exercise.',
      'Add a short recap before retrying.',
    ],
    resourcePolicy: { ...basePolicy, preferOrder: ['userProvided', 'web'] },
  },
  {
    id: 'music_practice',
    label: 'Music practice',
    version: 1,
    profile: {
      label: 'Musical skills',
      intent: 'Develop technique, ear, and consistency.',
      audience: 'Musicians at any level.',
    },
    intentHints: ['Guitar chord transitions', 'Piano scales', 'Ear training basics'],
    allowedEffortTypes: ['practice', 'drill', 'listen', 'review', 'reflection'],
    weights: {
      practice: 3,
      drill: 2,
      listen: 1,
      review: 1,
      reflection: 1,
    },
    rules: [
      'Short, focused repetitions are preferred.',
      'Include tempo or timing guidance.',
      'Keep practice structured and repeatable.',
      'Encourage recording and listening back.',
    ],
    remediationRules: [
      'Slow down tempo for remediation.',
      'Isolate one bar/phrase at a time.',
      'Shorten the practice goal.',
    ],
    resourcePolicy: { ...basePolicy, preferOrder: ['userProvided', 'youtube'] },
  },
  {
    id: 'craft_cooking_diy',
    label: 'Craft / cooking / DIY',
    version: 1,
    profile: {
      label: 'Hands-on skills',
      intent: 'Build tangible craft and DIY abilities safely.',
      audience: 'People learning practical skills.',
    },
    intentHints: ['Cook 5 easy meals', 'Learn basic sewing', 'DIY a small shelf'],
    allowedEffortTypes: ['practice', 'checklist', 'review', 'reflection', 'watch'],
    weights: {
      practice: 2,
      checklist: 2,
      review: 1,
      reflection: 1,
      watch: 1,
    },
    rules: [
      'Safety and preparation steps are mandatory.',
      'Use checklists for materials and steps.',
      'Prefer small, repeatable outcomes.',
      'Keep instructions very concrete.',
    ],
    remediationRules: [
      'If failed, break into smaller steps.',
      'Offer a simplified version of the task.',
      'Reconfirm safety prerequisites.',
    ],
    resourcePolicy: { ...basePolicy, preferOrder: ['userProvided', 'web', 'youtube'] },
  },
  {
    id: 'academics_exam',
    label: 'Academics & exams',
    version: 1,
    profile: {
      label: 'Academic mastery',
      intent: 'Improve recall, understanding, and exam readiness.',
      audience: 'Students preparing for exams.',
    },
    intentHints: ['Prepare math exam', 'History revision plan', 'Biology flashcards'],
    allowedEffortTypes: ['read', 'quiz', 'practice', 'review', 'reflection'],
    weights: {
      read: 1,
      quiz: 2,
      practice: 2,
      review: 1,
      reflection: 1,
    },
    rules: [
      'Include retrieval practice frequently.',
      'Keep summaries short and actionable.',
      'Use spaced review checkpoints.',
      'Avoid overly long reading missions.',
    ],
    remediationRules: [
      'Switch to a simpler quiz format.',
      'Provide a brief summary before retry.',
      'Add a quick practice drill.',
    ],
    resourcePolicy: { ...basePolicy, preferOrder: ['userProvided', 'web'] },
  },
  {
    id: 'personal_productivity',
    label: 'Personal productivity',
    version: 1,
    profile: {
      label: 'Organization & focus',
      intent: 'Build clear priorities, simple routines, and consistent focus.',
      audience: 'People seeking better personal organization.',
    },
    intentHints: ['Organize my week', 'Build a morning routine', 'Focus better at work'],
    allowedEffortTypes: ['practice', 'checklist', 'reflection', 'review', 'write'],
    weights: {
      practice: 2,
      checklist: 2,
      reflection: 1,
      review: 1,
      write: 1,
    },
    rules: [
      'Use short, focused timeboxes.',
      'Make tasks observable and measurable.',
      'Favor planning + review loops.',
      'Encourage single-task focus.',
      'Avoid workplace jargon; keep it personal.',
    ],
    remediationRules: [
      'If skipped, propose a 5-minute version.',
      'Reduce scope and remove blockers.',
      'Use a checklist to rebuild momentum.',
    ],
    resourcePolicy: { ...basePolicy, preferOrder: ['userProvided', 'web'] },
  },
  {
    id: 'skill_performance',
    label: 'Skill performance',
    version: 1,
    profile: {
      label: 'Practical skill building',
      intent: 'Build a concrete skill through drills, repetition, and self-checks.',
      audience: 'People learning a hands-on skill from scratch.',
    },
    intentHints: ['Learn guitar basics', 'Play chess openings', 'Learn to draw faces'],
    allowedEffortTypes: ['read', 'listen', 'practice', 'drill', 'review', 'reflection'],
    weights: {
      practice: 3,
      drill: 2,
      read: 1,
      listen: 1,
      review: 1,
      reflection: 1,
    },
    rules: [
      'Keep missions 5–10 minutes and very concrete.',
      'One micro-skill per mission with a clear self-check.',
      'Favor hands-on drills over theory.',
      'Use simple repetition and visible progress.',
    ],
    remediationRules: [
      'If stuck, reduce the step to a single drill.',
      'Add a short example before the action.',
      'Shorten the practice goal and retry.',
    ],
    resourcePolicy: {
      allowSearch: false,
      maxResources: 3,
      preferOrder: ['loecsen', 'userProvided'],
      languageFallback: true,
    },
  },
  {
    id: 'wellbeing_mind',
    label: 'Wellbeing (mind)',
    version: 1,
    profile: {
      label: 'Mental wellbeing',
      intent: 'Build calm routines for stress, sleep, and mental clarity.',
      audience: 'People seeking gentle, consistent mental wellbeing.',
    },
    intentHints: ['Reduce stress', 'Meditate 10 min/day', 'Sleep better'],
    allowedEffortTypes: ['practice', 'reflection', 'checklist', 'review'],
    weights: {
      practice: 3,
      reflection: 2,
      checklist: 1,
      review: 1,
    },
    rules: [
      'Keep sessions short, gentle, and calming.',
      'Focus on breathing, grounding, or short journaling.',
      'Use non-judgmental, supportive language.',
      'Make goals easy to complete daily.',
    ],
    remediationRules: [
      'If skipped, offer a 2-minute alternative.',
      'Reduce friction to a single simple action.',
      'Emphasize comfort over performance.',
    ],
    resourcePolicy: {
      allowSearch: false,
      maxResources: 3,
      preferOrder: ['loecsen', 'userProvided'],
      languageFallback: true,
    },
  },
];
