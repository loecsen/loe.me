import type { TraceEvent } from './trace';
import type { Lexicon } from './lexicon';
import type { SafetyVerdict } from './types';
import { moderationGuard } from './moderation';

export type SafetyV2Input = {
  text: string;
  locale?: string;
  lexiconGuard: (text: string, locale?: string, trace?: TraceEvent[]) => SafetyVerdict;
  trace?: TraceEvent[];
};

export async function runSafetyV2(input: SafetyV2Input): Promise<SafetyVerdict> {
  const lexiconVerdict = input.lexiconGuard(input.text, input.locale, input.trace);
  if (lexiconVerdict.status === 'blocked') {
    return lexiconVerdict;
  }

  const moderationVerdict = await moderationGuard(input.text, input.trace);
  if (moderationVerdict.status === 'blocked') {
    return moderationVerdict;
  }

  return { status: 'ok' };
}

export type { Lexicon, LexRule, LexiconMatch } from './lexicon';
export type { ReasonCode, SafetyVerdict } from './types';
export type { TraceEvent } from './trace';
export { createLexiconGuard, validateLexicon, findLexiconMatch } from './lexicon';
export { normalizeForSafety } from './normalize';
export { pushTrace } from './trace';
