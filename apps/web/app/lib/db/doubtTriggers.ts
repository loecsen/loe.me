/**
 * Doubt triggers: when to consult DB first, then cheap AI if miss.
 * Server and Home must stay consistent. Bump POLICY_VERSION when changing.
 *
 * Triggers (any one => "doubt"):
 * - actionability === BORDERLINE
 * - controllability.level in { medium, low }
 * - life-goal hit (ambition confirmation)
 * - realism === unrealistic
 * - language uncertainty (intentLang confidence < threshold)
 * - lexicon pack missing for intentLang AND script=latin AND language looks non-core
 *
 * Flow: 1) lookup DB by unique key  2) if miss → call cheap AI  3) store record  4) next time → no AI
 */

export const DOUBT_TRIGGERS_DOC = [
  'actionability === BORDERLINE',
  'controllability.level in { medium, low }',
  'life-goal hit (ambition confirmation)',
  'realism === unrealistic',
  'language uncertainty (intentLang confidence < threshold)',
  'lexicon pack missing for intentLang AND script=latin AND language looks non-core',
] as const;
