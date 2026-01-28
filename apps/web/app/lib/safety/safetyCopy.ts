export const SAFETY_REASON_COPY = {
  too_long: {
    titleKey: 'safetyGateTitleTooLong',
    bodyKey: 'safetyGateBodyTooLong',
  },
  vague: {
    titleKey: 'safetyGateTitleVague',
    bodyKey: 'safetyGateBodyVague',
  },
  not_a_goal: {
    titleKey: 'safetyGateTitleNotGoal',
    bodyKey: 'safetyGateBodyNotGoal',
  },
  insult_or_abuse: {
    titleKey: 'safetyGateTitleInsult',
    bodyKey: 'safetyGateBodyInsult',
  },
  default: {
    titleKey: 'safetyGateTitleDefault',
    bodyKey: 'safetyGateBodyDefault',
  },
  unrealistic: {
    titleKey: 'realismGateTitleUnrealistic',
    bodyKey: 'realismGateBodyUnrealistic',
  },
  blocked: {
    titleKey: 'safetyGateBlockedTitle',
    bodyKey: 'safetyGateBlockedBody',
  },
} as const;

export const SAFETY_CHOICE_LABELS = {
  organize: 'safetyChoiceOrganize',
  learn_skill: 'safetyChoiceGuitar',
  learn_language: 'safetyChoiceEnglish',
  focus_mind: 'safetyChoiceFocus',
} as const;
