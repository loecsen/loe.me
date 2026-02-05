/**
 * Lexicon pack data model for on-demand language coverage.
 * Packs are small, token-based; no user intent is used as seed for generation.
 */

export const LEXICON_PACK_VERSION = 'lexicon-pack-v1' as const;

export type LexiconPackGeneratedBy = {
  provider: string;
  model: string;
  prompt_version: string;
};

export type LexiconPackTokens = {
  greetings: string[];
  learning_verbs: string[];
  consume_verbs: string[];
  romantic_markers: string[];
  institution_markers: string[];
  selection_markers: string[];
  market_markers: string[];
  elite_role_markers: string[];
  superlative_markers: string[];
};

export type LexiconPackNormalize = {
  lower: boolean;
  strip_diacritics: boolean;
};

export type LexiconPackV1 = {
  lang: string;
  version: typeof LEXICON_PACK_VERSION;
  generated_at: string;
  generated_by: LexiconPackGeneratedBy;
  confidence: number;
  notes?: string;
  normalize: LexiconPackNormalize;
  tokens: LexiconPackTokens;
};

export type LexiconPackSource = 'published' | 'draft' | 'fallback';

export type LexiconForIntentResult = {
  pack: LexiconPackV1;
  packLang: string;
  source: LexiconPackSource;
};

export type LexSignalsResult = {
  tokens: LexiconPackTokens;
  source: LexiconPackSource;
  packLang: string;
};
