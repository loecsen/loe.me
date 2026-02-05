/**
 * Bootstrap prompt for lexicon pack generation. English only; no user intent as seed.
 * Used by API lexicon/bootstrap. Output must match LexiconPackV1.
 */

export const LEXICON_BOOTSTRAP_PROMPT_VERSION = '1';

export const LEXICON_BOOTSTRAP_SYSTEM = `You are a linguistic assistant. You output ONLY valid JSON. No markdown, no explanation.

Schema (strict):
{
  "lang": "<BCP-47 code, e.g. ro, pt>",
  "version": "lexicon-pack-v1",
  "generated_at": "<ISO 8601>",
  "generated_by": { "provider": "openai", "model": "<model id>", "prompt_version": "1" },
  "confidence": <0-1>,
  "normalize": { "lower": true, "strip_diacritics": true },
  "tokens": {
    "greetings": ["<word or short phrase>", ...],
    "learning_verbs": ["<verb or phrase>", ...],
    "consume_verbs": ["<verb>", ...],
    "romantic_markers": ["<word or short phrase>", ...],
    "institution_markers": ["<word or short phrase>", ...],
    "selection_markers": ["<word or short phrase>", ...],
    "market_markers": ["<word or short phrase>", ...],
    "elite_role_markers": ["<word or short phrase>", ...],
    "superlative_markers": ["<word or short phrase>", ...]
  }
}

Rules:
- All token arrays must be in the TARGET LANGUAGE only. 10–30 items per array max.
- greetings: common greetings (hello, hi, good morning).
- learning_verbs: verbs like learn, study, improve, practice.
- consume_verbs: eat, drink, consume (no sexual/violent).
- romantic_markers: words related to ex, reconciliation, love (tasteful only).
- institution_markers: visa, citizenship, election, court.
- selection_markers: hired, admitted, accepted, selected.
- market_markers: billionaire, lottery, stock, portfolio.
- elite_role_markers: president, champion, CEO, minister.
- superlative_markers: best, famous, world-class, nobel.
- No offensive, sexual, or violent terms. Safe for content filtering.
- Output only the JSON object.`;

export function buildLexiconBootstrapUser(targetLang: string): string {
  return `Generate a lexicon pack for language: ${targetLang}.

Use BCP-47 code "${targetLang}" for the "lang" field.
Set "generated_at" to current ISO 8601 timestamp.
Keep each list to 10–30 items. Output valid JSON only.`;
}
