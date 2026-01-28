export type HardBlockResult = { blocked: boolean; reason_code?: 'sexual_minors' };

// TODO: move to DB later
const minorTerms = [
  'enfant',
  'mineur',
  'underage',
  'minor',
  'kid',
  'child',
  'teen',
  'adolescent',
];

// TODO: move to DB later
const sexualTerms = [
  'sex',
  'sexual',
  'porn',
  'explicit',
  'intercourse',
  'rape',
  'violer',
  'viol',
];

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const includesAny = (value: string, terms: string[]) => terms.some((term) => value.includes(term));

export function hardBlock(intention: string): HardBlockResult {
  const raw = normalize(intention);
  if (!raw) return { blocked: false };
  const hasMinor = includesAny(raw, minorTerms);
  const hasSexual = includesAny(raw, sexualTerms);
  if (hasMinor && hasSexual) {
    return { blocked: true, reason_code: 'sexual_minors' };
  }
  return { blocked: false };
}
