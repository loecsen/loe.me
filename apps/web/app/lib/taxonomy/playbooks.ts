/**
 * Playbook registry: finite set of UX behaviors for inline responses.
 * Single source of truth for Admin rules + Home decision rendering.
 */

export const PLAYBOOK_UI_MODES = [
  'INLINE_HINT_REPHRASE',
  'INLINE_CONFIRM_BIG_ASPIRATION',
  'INLINE_TWO_PATHS_CONTROL',
  'INLINE_SOFT_REALISM_KEEP_ADJUST',
  'PROCEED_GENERATE',
  'BLOCKED_SAFETY',
] as const;

export type PlaybookUiMode = (typeof PLAYBOOK_UI_MODES)[number];

export type PlaybookDoc = {
  id: string;
  ui_mode: PlaybookUiMode;
  triggers: {
    category_ids?: string[];
    reason_codes?: string[];
    controllability?: string[];
    gate_name?: string;
  };
  copy_keys: {
    primary: string;
    secondary?: string;
    option_a?: string;
    option_b?: string;
  };
  examples: Array<{ intent: string; days?: number; expected_behavior: string }>;
};

export const PLAYBOOK_DOCS: PlaybookDoc[] = [
  {
    id: 'INLINE_HINT_REPHRASE',
    ui_mode: 'INLINE_HINT_REPHRASE',
    triggers: { reason_codes: ['too_vague', 'pure_noun_topic', 'no_action_or_outcome', 'ambiguous_goal'], gate_name: 'classify' },
    copy_keys: { primary: 'inlineNotActionablePrimary', secondary: 'inlineNotActionableSecondary' },
    examples: [
      { intent: 'pizza', days: 14, expected_behavior: 'Show rephrase hint + suggestion if safe' },
      { intent: 'manger pizza', days: 14, expected_behavior: 'Show rephrase hint + suggested_rephrase' },
    ],
  },
  {
    id: 'INLINE_CONFIRM_BIG_ASPIRATION',
    ui_mode: 'INLINE_CONFIRM_BIG_ASPIRATION',
    triggers: { controllability: ['PARTIALLY_EXTERNAL', 'EXTERNAL'], gate_name: 'ambition' },
    copy_keys: { primary: 'ambitionConfirmTitle', secondary: 'ambitionConfirmBody', option_a: 'ambitionConfirmYes', option_b: 'ambitionConfirmRefine' },
    examples: [
      { intent: 'devenir président de la république', days: 30, expected_behavior: 'Show confirm block; Yes => proceed, Refine => hint' },
      { intent: 'become a billionaire', days: 90, expected_behavior: 'Show confirm block' },
    ],
  },
  {
    id: 'INLINE_TWO_PATHS_CONTROL',
    ui_mode: 'INLINE_TWO_PATHS_CONTROL',
    triggers: { category_ids: ['WELLBEING'], reason_codes: ['ambiguous_goal'], controllability: ['PARTIALLY_EXTERNAL'] },
    copy_keys: { primary: 'wellbeingTwoPathsPrimary', option_a: 'wellbeingTwoPathsOptionA', option_b: 'wellbeingTwoPathsOptionB' },
    examples: [
      { intent: 'je veux récupérer mon ex copine car je suis triste', days: 14, expected_behavior: 'Two paths: feel better / communication' },
    ],
  },
  {
    id: 'INLINE_SOFT_REALISM_KEEP_ADJUST',
    ui_mode: 'INLINE_SOFT_REALISM_KEEP_ADJUST',
    triggers: { category_ids: ['LEARN', 'CREATE', 'WELLBEING'], gate_name: 'realism_soft' },
    copy_keys: { primary: 'realismInlineMessage', option_a: 'realismKeepAnyway', option_b: 'realismConfirmAdjust' },
    examples: [
      { intent: 'maîtriser le chinois en 90 jours', days: 90, expected_behavior: 'Keep / Adjust with reduce_scope or increase_duration' },
    ],
  },
  {
    id: 'PROCEED_GENERATE',
    ui_mode: 'PROCEED_GENERATE',
    triggers: {},
    copy_keys: { primary: 'homeCreate' },
    examples: [
      { intent: 'apprendre le chinois A2 en 90 jours', days: 90, expected_behavior: 'Call missions/generate' },
      { intent: 'courir un marathon', days: 90, expected_behavior: 'Call missions/generate' },
    ],
  },
  {
    id: 'BLOCKED_SAFETY',
    ui_mode: 'BLOCKED_SAFETY',
    triggers: { reason_codes: ['blocked', 'safety_no_suggestion'] },
    copy_keys: { primary: 'safetyInlineMessage', secondary: 'safetyInlineSecondary' },
    examples: [
      { intent: '(blocked content)', expected_behavior: 'Show safety message; no suggestion' },
    ],
  },
];

export function getPlaybookById(playbookId: string): PlaybookDoc | undefined {
  return PLAYBOOK_DOCS.find((p) => p.id === playbookId);
}

export function getPlaybooksByUiMode(uiMode: PlaybookUiMode): PlaybookDoc[] {
  return PLAYBOOK_DOCS.filter((p) => p.ui_mode === uiMode);
}
