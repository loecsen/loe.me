/**
 * Rule doc for the 3-layer language policy (documentation only).
 * No runtime gate; explains Doc EN / Runtime multilingual / UI localized.
 */

import type { RuleDoc } from '../types';

export const ruleLanguagePolicy: RuleDoc = {
  id: 'language_policy',
  gate: 'language_policy',
  applies_when:
    'All ritual-creation flows: rules documentation (Admin), runtime intent understanding (gates), and UI messages.',
  outcome: 'Doc EN | Runtime multilingual | UI localized',
  reason_codes: [],
  examples_pass: [
    'RuleDoc applies_when, notes, examples: English only (Admin rules page).',
    'Intent in any language: script detection (CJK/Hangul/Kana/Cyrillic/Arabic/Latin) + multi-language lexicons.',
    'UI FR + intent FR: show gate messages and suggestions in French.',
    'display_lang follows uiLocale / intentLang; LLM outputs normalized_intent + suggested_rephrase in intentLang.',
  ],
  examples_fail: [],
  notes:
    '1) Rules documentation (Admin): RuleDoc text (applies_when, notes, examples) in English only. Purely documentation. ' +
    '2) Runtime intent understanding: Must work for any input language. English input is NOT required. Use script detection as primary fallback; small multi-language lexicons for greetings, learning verbs, consume-only, romantic outcomes, elite/superlatives. If language unknown, fall back to script heuristics + minimal Latin heuristics. ' +
    '3) Language signals: intentLang = inferred from intent (script + lightweight heuristics), used for rewrites/normalized intent. uiLocale = UI language, used ONLY for displayed messages (inline hints, button labels). display_lang must NOT force English; it should follow uiLocale (or intentLang when provided). ' +
    '4) LLM prompts: System prompt can remain in English. Model must output normalized_intent + suggested_rephrase in intentLang (same language as user input). Post-filter safety remains. ' +
    '5) Home UX: If UI is FR and intent is FR, never show English suggestions/messages. If intentLang != uiLocale, messages in uiLocale, rewrites/chips in intentLang (or fallback to uiLocale if intentLang uncertain).',
};
