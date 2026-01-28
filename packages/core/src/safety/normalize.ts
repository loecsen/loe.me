const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const removeDiacritics = (value: string) =>
  value.normalize('NFKD').replace(/\p{Diacritic}+/gu, '');

const punctToSpace = (value: string) =>
  normalizeWhitespace(value.replace(/[\p{P}\p{S}]+/gu, ' '));

export type SafetyHaystacks = {
  raw: string;
  nfkc: string;
  collapsed: string;
  noDiacritics: string;
  punctToSpace: string;
};

export function normalizeForSafety(text: string): SafetyHaystacks {
  const raw = text ?? '';
  const nfkc = raw.normalize('NFKC');
  const collapsed = normalizeWhitespace(nfkc);
  const noDiacritics = normalizeWhitespace(removeDiacritics(nfkc));
  const punctToSpaceValue = punctToSpace(nfkc);

  return {
    raw,
    nfkc,
    collapsed,
    noDiacritics,
    punctToSpace: punctToSpaceValue,
  };
}
