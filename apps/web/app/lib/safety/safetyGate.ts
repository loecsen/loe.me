import { SAFETY_CHOICE_LABELS } from './safetyCopy';

type SafetyStatus = 'ok' | 'needs_clarification' | 'blocked';
type SafetyReasonCode =
  | 'self_harm'
  | 'violence'
  | 'illegal_wrongdoing'
  | 'hate_or_harassment'
  | 'sexual_non_goal'
  | 'insult_or_abuse'
  | 'not_a_goal'
  | 'vague'
  | 'too_long'
  | 'safe_goal'
  | 'other_blocked';

export type SafetyQuickChoice = { id: string; label_key: string; intention: string };

export type SafetyGateResult = {
  status: SafetyStatus;
  reasonCode: SafetyReasonCode;
  cleanIntention?: string;
  quickChoices: SafetyQuickChoice[];
};

const MAX_CHARS = 350;

const insultTokens = [
  'idiot',
  'stupid',
  'moron',
  'jerk',
  'asshole',
  'bitch',
  'merde',
  'con',
  'connard',
  'connasse',
  'puta',
  'idiota',
  'imbécile',
];

const greetingsOrChatter = [
  'hi',
  'hello',
  'hey',
  'salut',
  'bonjour',
  'hola',
  'ciao',
  'hallo',
  'lol',
  'mdr',
  'yo',
];

const vaguePatterns = [
  'réussir ma vie',
  'reussir ma vie',
  'être heureux',
  'etre heureux',
  'être heureuse',
  'etre heureuse',
  'be happy',
  'be happier',
  'be better',
  'get rich',
  'be rich',
  'be successful',
];

const goalStems = [
  'learn',
  'improv',
  'practic',
  'train',
  'build',
  'organ',
  'focus',
  'plan',
  'prepare',
  'study',
  'write',
  'speak',
  'read',
  'code',
  'cook',
  'draw',
  'apprendre',
  'amelior',
  'maitr',
  'pratiq',
  'entrain',
  'organis',
  'creer',
  'etud',
  'prepar',
  'aprender',
  'mejor',
  'practic',
  'lernen',
  'üb',
  'impar',
];

const selfHarmPatterns = [/suicid/i, /self[-\s]?harm/i, /kill myself/i];

const violencePatterns = [
  /\btuer\b/iu,
  /\bassassiner\b/iu,
  /\bmassacrer\b/iu,
  /\bbuter\b/iu,
  /\bégorger\b/iu,
  /\bpoignarder\b/iu,
  /\babattre\b/iu,
  /\bexterminer\b/iu,
  /\bfaire exploser\b/iu,
  /\battentat\b/iu,
  /\bkill\b/iu,
  /\bmurder\b/iu,
  /\bshoot\b/iu,
  /\bstab\b/iu,
  /\bmassacre\b/iu,
  /\bexplosion\b/iu,
  /\bassassinate\b/iu,
];

const violenceTargetPatterns = [
  /\btout le monde\b/iu,
  /\btous\b/iu,
  /\bdes gens\b/iu,
  /\bune personne\b/iu,
  /\beveryone\b/iu,
  /\ball people\b/iu,
  /\bsomeone\b/iu,
  /\ba person\b/iu,
];

const illegalPatterns = [
  /how to hack/i,
  /hack/i,
  /phish/i,
  /scam/i,
  /steal/i,
  /fraud/i,
];

const weaponPatterns = [/weapon/i, /make.*weapon/i, /gun/i, /bomb/i, /explos/i];

const sexualExplicitPatterns = [/porn/i, /xxx/i, /nudes?/i];
const minorPatterns = [/minor/i, /child/i, /kid/i, /teen/i];

const otherBlockedPatterns = [/doxx/i, /blackmail/i, /extort/i, /terror/i];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const stripInsults = (value: string) => {
  let next = value;
  insultTokens.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'giu');
    next = next.replace(regex, '');
  });
  return normalizeWhitespace(next);
};

const includesAny = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

const buildQuickChoices = (): SafetyQuickChoice[] => [
  {
    id: 'organize',
    label_key: SAFETY_CHOICE_LABELS.organize,
    intention: '',
  },
  {
    id: 'learn_skill',
    label_key: SAFETY_CHOICE_LABELS.learn_skill,
    intention: '',
  },
  {
    id: 'learn_language',
    label_key: SAFETY_CHOICE_LABELS.learn_language,
    intention: '',
  },
  {
    id: 'focus_mind',
    label_key: SAFETY_CHOICE_LABELS.focus_mind,
    intention: '',
  },
];

const isOnlyEmoji = (value: string) =>
  value.length > 0 &&
  value.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, '').length === 0;

const isOnlyPunctuation = (value: string) =>
  value.replace(/[\p{P}\p{S}\s]/gu, '').length === 0;

const isGreetingOrChatterOnly = (value: string) => {
  const tokens = value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => greetingsOrChatter.includes(token));
};

const hasGoalStem = (value: string) =>
  goalStems.some((stem) => value.toLowerCase().includes(stem));

export function runSafetyGate(intention: string, locale: string): SafetyGateResult {
  const raw = normalizeWhitespace(intention);
  const lower = raw.toLowerCase();

  if (!raw || isOnlyEmoji(raw) || isOnlyPunctuation(raw) || isGreetingOrChatterOnly(raw)) {
    return {
      status: 'needs_clarification',
      reasonCode: 'not_a_goal',
      quickChoices: buildQuickChoices(),
    };
  }

  if (raw.length > MAX_CHARS) {
    return {
      status: 'needs_clarification',
      reasonCode: 'too_long',
      quickChoices: [],
    };
  }

  if (includesAny(lower, selfHarmPatterns)) {
    return {
      status: 'blocked',
      reasonCode: 'self_harm',
      quickChoices: [],
    };
  }

  if (
    includesAny(lower, violencePatterns) ||
    (includesAny(lower, violenceTargetPatterns) &&
      (includesAny(lower, violencePatterns) || includesAny(lower, weaponPatterns)))
  ) {
    return {
      status: 'blocked',
      reasonCode: 'violence',
      quickChoices: [],
    };
  }

  if (includesAny(lower, illegalPatterns)) {
    return {
      status: 'blocked',
      reasonCode: 'illegal_wrongdoing',
      quickChoices: [],
    };
  }

  const isSexualExplicit = includesAny(lower, sexualExplicitPatterns);
  const mentionsMinor = includesAny(lower, minorPatterns);
  if (isSexualExplicit && mentionsMinor) {
    return {
      status: 'blocked',
      reasonCode: 'sexual_non_goal',
      quickChoices: [],
    };
  }
  if (isSexualExplicit) {
    return {
      status: 'blocked',
      reasonCode: 'sexual_non_goal',
      quickChoices: [],
    };
  }

  if (includesAny(lower, weaponPatterns)) {
    return {
      status: 'blocked',
      reasonCode: 'violence',
      quickChoices: [],
    };
  }

  if (includesAny(lower, otherBlockedPatterns)) {
    return {
      status: 'blocked',
      reasonCode: 'other_blocked',
      quickChoices: [],
    };
  }

  const hasVaguePattern = vaguePatterns.some((pattern) => lower.includes(pattern));
  const wordCount = raw.split(/\s+/).filter(Boolean).length;

  if (insultTokens.some((word) => lower.includes(word)) && !hasGoalStem(lower)) {
    return {
      status: 'needs_clarification',
      reasonCode: 'insult_or_abuse',
      quickChoices: buildQuickChoices(),
    };
  }

  if (hasVaguePattern) {
    return {
      status: 'needs_clarification',
      reasonCode: 'vague',
      quickChoices: buildQuickChoices(),
    };
  }

  if (wordCount < 4 || !hasGoalStem(lower)) {
    return {
      status: 'needs_clarification',
      reasonCode: 'not_a_goal',
      quickChoices: buildQuickChoices(),
    };
  }

  const cleaned = stripInsults(raw);

  return {
    status: 'ok',
    reasonCode: 'safe_goal',
    cleanIntention: cleaned || raw,
    quickChoices: [],
  };
}

export function runSafetyGateSelfTest() {
  const cases = [
    {
      name: 'empty => not_a_goal',
      result: runSafetyGate('', 'fr'),
      expect: { status: 'needs_clarification', reasonCode: 'not_a_goal' },
    },
    {
      name: 'too long => too_long',
      result: runSafetyGate('x'.repeat(351), 'en'),
      expect: { status: 'needs_clarification', reasonCode: 'too_long' },
    },
    {
      name: 'suicide => self_harm',
      result: runSafetyGate('suicide', 'en'),
      expect: { status: 'blocked', reasonCode: 'self_harm' },
    },
    {
      name: 'réussir ma vie => vague',
      result: runSafetyGate('réussir ma vie', 'fr'),
      expect: { status: 'needs_clarification', reasonCode: 'vague', hasChoices: true },
    },
  ];

  const failures = cases.filter(
    (entry) =>
      entry.result.status !== entry.expect.status ||
      entry.result.reasonCode !== entry.expect.reasonCode ||
      (entry.expect.hasChoices && entry.result.quickChoices.length === 0),
  );

  return {
    ok: failures.length === 0,
    failures: failures.map((entry) => ({
      name: entry.name,
      expected: entry.expect,
      received: { status: entry.result.status, reasonCode: entry.result.reasonCode },
    })),
  };
}
