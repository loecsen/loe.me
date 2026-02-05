type StepLike = Record<string, unknown>;

type LevelLike = {
  title?: string;
  steps?: StepLike[];
};

type PlanLike = {
  levels?: LevelLike[];
  competencies?: Array<{ id?: string }>;
  [key: string]: unknown;
};

type NormalizeRitualPlanOptions = {
  locale?: string;
  stepsPerLevel?: number;
};

export type NormalizeRitualPlanResult = {
  plan: PlanLike & {
    levels: Array<{ id: string; title: string; steps: StepLike[] }>;
    generationSchemaVersion: number;
    totalSteps: number;
    stepsPerLevel: number;
    levelsCount: number;
  };
  meta: {
    totalSteps: number;
    stepsPerLevel: number;
    levelsCount: number;
    autofillCount: number;
    truncatedCount: number;
    autofillStepIds: string[];
  };
};

const isNonEmptyString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const resolveLocaleLabel = (locale: string | undefined, en: string, fr: string) =>
  locale?.startsWith('fr') ? fr : en;

const ensurePositiveInt = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;

const normalizeAxis = (value: unknown) => {
  if (typeof value !== 'string') return null;
  return ['understand', 'do', 'perceive', 'consolidate'].includes(value) ? value : null;
};

const normalizeEffortType = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const allowed = [
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
  ];
  return allowed.includes(value) ? value : null;
};

export function normalizeRitualPlan(
  inputPlan: PlanLike,
  totalStepsInput: number,
  options: NormalizeRitualPlanOptions = {},
): NormalizeRitualPlanResult {
  const totalSteps = ensurePositiveInt(totalStepsInput, 7);
  const stepsPerLevel = ensurePositiveInt(options.stepsPerLevel ?? 7, 7);
  const locale = options.locale;
  const dayLabel = resolveLocaleLabel(locale, 'Day', 'Jour');
  const weekLabel = resolveLocaleLabel(locale, 'Week', 'Semaine');

  const sourceLevels = Array.isArray(inputPlan.levels) ? inputPlan.levels : [];
  const levelTitles = sourceLevels.map((level) =>
    isNonEmptyString(level?.title) ? String(level.title).trim() : undefined,
  );

  const rawSteps: StepLike[] = sourceLevels.flatMap((level) =>
    Array.isArray(level.steps) ? level.steps : [],
  );
  const orderedSteps: StepLike[] = (() => {
    const withIndex = rawSteps.map((step, index) => {
      const dayIndex = Number((step as { dayIndex?: unknown }).dayIndex);
      const order = Number((step as { order?: unknown }).order);
      const orderGlobal = Number((step as { orderGlobal?: unknown }).orderGlobal);
      const levelIndex = Number((step as { levelIndex?: unknown }).levelIndex);
      const stepIndex = Number((step as { stepIndex?: unknown }).stepIndex);
      const hasExplicit =
        Number.isFinite(dayIndex) ||
        Number.isFinite(order) ||
        Number.isFinite(orderGlobal) ||
        (Number.isFinite(levelIndex) && Number.isFinite(stepIndex));
      const explicitOrder = Number.isFinite(dayIndex)
        ? dayIndex
        : Number.isFinite(order)
          ? order
          : Number.isFinite(orderGlobal)
            ? orderGlobal
            : Number.isFinite(levelIndex) && Number.isFinite(stepIndex)
              ? levelIndex * 1000 + stepIndex
              : index;
      return { step, index, hasExplicit, explicitOrder };
    });
    const shouldSort = withIndex.some((entry) => entry.hasExplicit);
    if (!shouldSort) {
      return rawSteps;
    }
    return withIndex
      .sort((a, b) => a.explicitOrder - b.explicitOrder || a.index - b.index)
      .map((entry) => entry.step);
  })();

  const competencyFallback =
    inputPlan.competencies?.find((entry) => isNonEmptyString(entry?.id))?.id ??
    (orderedSteps.find((step) => isNonEmptyString(step?.competencyId)) as
      | { competencyId?: string }
      | undefined)?.competencyId ??
    'comp-1';

  const axisFallback =
    normalizeAxis((orderedSteps[0] as { axis?: unknown } | undefined)?.axis) ?? 'understand';
  const effortFallback =
    normalizeEffortType((orderedSteps[0] as { effortType?: unknown } | undefined)?.effortType) ??
    'practice';

  const normalizedSteps: Array<StepLike & { is_autofill?: boolean }> = [];
  const truncatedCount = Math.max(0, orderedSteps.length - totalSteps);
  const autofillCount = Math.max(0, totalSteps - orderedSteps.length);

  for (let i = 0; i < Math.min(orderedSteps.length, totalSteps); i += 1) {
    const step = orderedSteps[i] ?? {};
    const title = isNonEmptyString((step as { title?: unknown }).title)
      ? String((step as { title?: unknown }).title).trim()
      : `${dayLabel} ${i + 1}`;
    normalizedSteps.push({
      ...step,
      title,
      competencyId: isNonEmptyString((step as { competencyId?: unknown }).competencyId)
        ? (step as { competencyId?: string }).competencyId
        : competencyFallback,
      axis: normalizeAxis((step as { axis?: unknown }).axis) ?? axisFallback,
      effortType:
        normalizeEffortType((step as { effortType?: unknown }).effortType) ?? effortFallback,
      durationMin:
        typeof (step as { durationMin?: unknown }).durationMin === 'number'
          ? (step as { durationMin?: number }).durationMin
          : 5,
      required:
        typeof (step as { required?: unknown }).required === 'boolean'
          ? (step as { required?: boolean }).required
          : true,
    });
  }

  for (let i = normalizedSteps.length; i < totalSteps; i += 1) {
    normalizedSteps.push({
      title: `${dayLabel} ${i + 1}`,
      description: 'Auto-filled step',
      is_autofill: true,
      autofillReason: 'missing_step',
      competencyId: competencyFallback,
      axis: axisFallback,
      effortType: effortFallback,
      durationMin: 5,
      required: true,
    });
  }

  const levels: Array<{ id: string; title: string; steps: StepLike[] }> = [];
  const autofillStepIds: string[] = [];
  let globalIndex = 0;

  for (let levelIndex = 0; globalIndex < normalizedSteps.length; levelIndex += 1) {
    const chunk = normalizedSteps.slice(globalIndex, globalIndex + stepsPerLevel);
    const title = levelTitles[levelIndex] ?? `${weekLabel} ${levelIndex + 1}`;
    const steps = chunk.map((step, stepIndex) => {
      const stepId = `step-${levelIndex + 1}-${stepIndex + 1}`;
      if ((step as { is_autofill?: boolean }).is_autofill) {
        autofillStepIds.push(stepId);
      }
      return {
        ...step,
        id: stepId,
        levelIndex: levelIndex + 1,
        stepIndex: stepIndex + 1,
        orderGlobal: globalIndex + stepIndex,
      };
    });
    levels.push({ id: `level-${levelIndex + 1}`, title, steps });
    globalIndex += stepsPerLevel;
  }

  const plan = {
    ...inputPlan,
    levels,
    generationSchemaVersion: 2,
    totalSteps,
    stepsPerLevel,
    levelsCount: levels.length,
  };

  return {
    plan,
    meta: {
      totalSteps,
      stepsPerLevel,
      levelsCount: levels.length,
      autofillCount,
      truncatedCount,
      autofillStepIds,
    },
  };
}
