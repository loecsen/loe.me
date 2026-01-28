export type RealismStatus = 'ok' | 'needs_reformulation';
export type RealismReasonCode =
  | 'unrealistic_timeframe'
  | 'unrealistic_scope'
  | 'unrealistic_level_claim'
  | 'unrealistic_unknown';

export type RealismChoice = {
  label_key: string;
  params?: Record<string, unknown>;
  intention: string;
};

export type RealismGateResult = {
  status: RealismStatus;
  reasonCode?: RealismReasonCode;
  cleanIntention?: string;
  choices: RealismChoice[];
};

const levelClaimPatterns = [
  /fluent/i,
  /bilingu/i,
  /native/i,
  /like a native/i,
  /maîtriser parfaitement/i,
  /maitriser parfaitement/i,
  /\bexpert\b/i,
  /\bpro\b/i,
  /champion/i,
];

const languageKeywords = [
  'language',
  'langue',
  'anglais',
  'english',
  'espagnol',
  'spanish',
  'chinois',
  'japonais',
  'japanese',
  'italien',
  'italian',
  'allemand',
  'german',
];

const instrumentKeywords = ['guitare', 'guitar', 'piano', 'violin', 'violon', 'drums', 'batterie'];

const sportKeywords = ['marathon', 'triathlon', 'ironman', 'ultra', 'trail'];

const extremeFitnessPatterns = [
  /\b\d+\s?kg\b/i,
  /\b\d+\s?(days?|jours?)\b/i,
  /\b\d+\s?(weeks?|semaines?)\b/i,
];

const goalConnectors = [' et ', ' and ', ' & '];
const goalVerbs = ['apprendre', 'learn', 'devenir', 'become', 'master', 'maitriser', 'maîtriser'];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const hasAny = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

const countConnectors = (value: string) =>
  goalConnectors.reduce((acc, connector) => acc + (value.includes(connector) ? 1 : 0), 0);

const hasGoalVerb = (value: string) => goalVerbs.some((verb) => value.includes(verb));

const inferBaseGoal = (raw: string) => {
  const trimmed = raw.split(/->|→/)[0]?.trim();
  return trimmed || raw;
};

const buildChoices = (baseGoal: string, locale: string): RealismChoice[] => {
  const isFrench = locale?.startsWith('fr');
  const recommendedDays = 90;
  const miniDays = 7;
  const ambitiousDays = 90;
  if (isFrench) {
    return [
      {
        label_key: 'realismChoiceRecommended',
        params: { days: recommendedDays, variant: 'recommended' },
        intention: `${baseGoal} → bases solides + usage concret (10 min/jour, ${recommendedDays} jours)`,
      },
      {
        label_key: 'realismChoiceMini',
        params: { days: miniDays, variant: 'mini' },
        intention: `${baseGoal} → démarrage concret et routine simple (${miniDays} jours)`,
      },
      {
        label_key: 'realismChoiceAmbitious',
        params: { days: ambitiousDays, variant: 'ambitious' },
        intention: `${baseGoal} → routine solide + objectifs mesurables (10 min/jour, ${ambitiousDays} jours)`,
      },
    ];
  }
  return [
    {
      label_key: 'realismChoiceRecommended',
      params: { days: recommendedDays, variant: 'recommended' },
      intention: `${baseGoal} → solid foundations + practical usage (10 min/day, ${recommendedDays} days)`,
    },
    {
      label_key: 'realismChoiceMini',
      params: { days: miniDays, variant: 'mini' },
      intention: `${baseGoal} → concrete start and a simple routine (${miniDays} days)`,
    },
    {
      label_key: 'realismChoiceAmbitious',
      params: { days: ambitiousDays, variant: 'ambitious' },
      intention: `${baseGoal} → strong routine + measurable goals (10 min/day, ${ambitiousDays} days)`,
    },
  ];
};

export function runRealismGate(
  intention: string,
  days: number | undefined,
  locale: string,
): RealismGateResult {
  const raw = normalizeWhitespace(intention);
  if (!raw) {
    return { status: 'ok', choices: [] };
  }
  if (raw.includes('→') || raw.includes('->')) {
    return { status: 'ok', cleanIntention: raw, choices: [] };
  }

  const lower = raw.toLowerCase();
  const baseGoal = inferBaseGoal(raw);
  const choices = buildChoices(baseGoal, locale);

  if (days && days <= 30 && hasAny(lower, levelClaimPatterns)) {
    return {
      status: 'needs_reformulation',
      reasonCode: 'unrealistic_level_claim',
      choices,
    };
  }

  if (hasAny(lower, extremeFitnessPatterns) && days && days <= 30) {
    return {
      status: 'needs_reformulation',
      reasonCode: 'unrealistic_scope',
      choices,
    };
  }

  const connectorCount = countConnectors(lower);
  if (connectorCount >= 2 && hasGoalVerb(lower)) {
    return {
      status: 'needs_reformulation',
      reasonCode: 'unrealistic_scope',
      choices,
    };
  }
  if (connectorCount >= 1 && hasGoalVerb(lower) && days && days <= 30) {
    return {
      status: 'needs_reformulation',
      reasonCode: 'unrealistic_scope',
      choices,
    };
  }

  if (days) {
    if (languageKeywords.some((word) => lower.includes(word)) && hasAny(lower, levelClaimPatterns)) {
      if (days < 60) {
        return {
          status: 'needs_reformulation',
          reasonCode: 'unrealistic_timeframe',
          choices,
        };
      }
    }
    if (instrumentKeywords.some((word) => lower.includes(word)) && hasAny(lower, levelClaimPatterns)) {
      if (days < 90) {
        return {
          status: 'needs_reformulation',
          reasonCode: 'unrealistic_level_claim',
          choices,
        };
      }
    }
    if (sportKeywords.some((word) => lower.includes(word)) && days < 90) {
      return {
        status: 'needs_reformulation',
        reasonCode: 'unrealistic_timeframe',
        choices,
      };
    }
  }

  return { status: 'ok', cleanIntention: raw, choices: [] };
}
