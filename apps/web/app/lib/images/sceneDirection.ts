export type SceneDirection = 'human_action' | 'object_scene' | 'abstract_symbolic';

const HUMAN_ACTION_KEYWORDS = [
  'tennis',
  'sport',
  'soccer',
  'football',
  'basketball',
  'run',
  'running',
  'yoga',
  'dance',
  'boxing',
  'swim',
  'swimming',
  'pitch',
  'interview',
  'presentation',
  'présentation',
  'entretien',
  'danse',
  'nager',
  'courir',
  'parler',
  'jouer',
];

const ABSTRACT_SYMBOLIC_KEYWORDS = [
  'language',
  'learn',
  'learning',
  'grammar',
  'vocabulary',
  'memory',
  'focus',
  'meditation',
  'habit',
  'habits',
  'mindset',
  'study',
  'studying',
  'langue',
  'langage',
  'vocabulaire',
  'grammaire',
  'mémoire',
  'concentration',
  'méditation',
  'habitude',
  'apprendre',
  'apprentissage',
];

const HUMAN_ACTION_REGEX = /(play|jouer|nager|courir|danser|parler|pitch|interview|présenter)\b/i;
const ABSTRACT_SYMBOLIC_REGEX =
  /(language|langue|grammar|grammaire|focus|méditation|habit|habitude)\b/i;

export function pickSceneDirection(title?: string, summary?: string): SceneDirection {
  const text = `${title ?? ''} ${summary ?? ''}`.toLowerCase();
  if (HUMAN_ACTION_REGEX.test(text)) {
    return 'human_action';
  }
  if (ABSTRACT_SYMBOLIC_REGEX.test(text)) {
    return 'abstract_symbolic';
  }
  if (HUMAN_ACTION_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return 'human_action';
  }
  if (ABSTRACT_SYMBOLIC_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return 'abstract_symbolic';
  }
  return 'object_scene';
}
