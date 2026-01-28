import { createLexiconGuard, type Lexicon } from '@loe/core';
import { getDataPath, readJson } from '../storage/fsStore';

let cachedGuard:
  | {
      guard: ReturnType<typeof createLexiconGuard>;
      lexicon: Lexicon;
    }
  | null = null;

const LEXICON_PATH = getDataPath('safety', 'lexicon.v1.json');

export async function getLexiconGuard() {
  if (process.env.NODE_ENV !== 'production') {
    const lexicon = await readJson<Lexicon>(LEXICON_PATH);
    const guard = createLexiconGuard(lexicon);
    return { guard, lexicon };
  }
  if (cachedGuard) {
    return cachedGuard;
  }
  const lexicon = await readJson<Lexicon>(LEXICON_PATH);
  const guard = createLexiconGuard(lexicon);
  cachedGuard = { guard, lexicon };
  return cachedGuard;
}

export function clearLexiconGuardCache() {
  cachedGuard = null;
}
