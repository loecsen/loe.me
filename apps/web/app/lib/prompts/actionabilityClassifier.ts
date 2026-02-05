/**
 * Prompt versionné pour le classifieur LLM actionability.
 * Single source: lib/prompts/published/actionability_classifier_v1.json (no duplicate).
 * Fallback to constant when file missing.
 */

import { getPrompt } from './store';

export const CATEGORIES = ['LEARN', 'CREATE', 'PERFORM', 'WELLBEING', 'SOCIAL', 'CHALLENGE'] as const;
export type ClassifierCategory = (typeof CATEGORIES)[number];

const ACTIONABILITY_CLASSIFIER_SYSTEM_FALLBACK = `You are a strict classifier for whether a short user intent can be turned into a concrete, day-by-day micro-ritual plan.
Return ONLY valid JSON matching this schema:
{
  "verdict": "ACTIONABLE" | "NEEDS_REPHRASE_INLINE",
  "reason_code": "too_vague" | "social_chitchat" | "pure_noun_topic" | "no_action_or_outcome" | "ambiguous_goal" | "ok",
  "category": "LEARN" | "CREATE" | "PERFORM" | "WELLBEING" | "SOCIAL" | "CHALLENGE",
  "normalized_intent": string,
  "suggested_rephrase": string | null,
  "confidence": number
}
Rules:
- ACTIONABLE means a ritual can be generated without follow-up questions because there is at least an action OR a clear goal/outcome.
- NEEDS_REPHRASE_INLINE means purely social, not a ritual request, or too vague.
- category: LEARN (learn & understand), CREATE (create & express), PERFORM (progress & perform), WELLBEING (change & ground), SOCIAL (social & collective), CHALLENGE (challenges & transformations). Pick the best fit.
- normalized_intent: light cleanup, MUST be in the SAME language as the user intent (intentLang). Do not translate to English.
- suggested_rephrase: when verdict is NEEDS_REPHRASE_INLINE, provide a natural rephrase in the SAME language as the user intent (intentLang). One short sentence with an action (learn/do/improve). Do NOT add "in 14 days" or timeframe unless the user specified it. If no good rephrase, set null.
- Multilingual: short CJK/Korean can still be actionable (e.g., "피자 만들기", "学习中文A2"). Output language must match input language.
Heuristics:
- Pure greetings/chitchat → NEEDS_REPHRASE_INLINE, category SOCIAL.
- Single noun/topic without action/outcome → NEEDS_REPHRASE_INLINE.
- Doing/making/practicing/learning/improving + object → ACTIONABLE.
- Consume/enjoy only ("eat pizza") without learning/skill/outcome → prefer NEEDS_REPHRASE_INLINE with suggested_rephrase like "learn to make pizza" or "practice cooking pizza" in intent language.
- If timeframe_days present and intent is a skill/learning goal → prefer ACTIONABLE.`;

/** System prompt: from published JSON or fallback. */
export function getActionabilityClassifierSystem(): string {
  const entry = getPrompt('actionability_classifier_v1', { allowDraft: true });
  return entry?.system ?? ACTIONABILITY_CLASSIFIER_SYSTEM_FALLBACK;
}

function substituteTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return out;
}

export function buildActionabilityClassifierUser(
  intent: string,
  timeframe_days?: number,
  display_lang?: string,
): string {
  const entry = getPrompt('actionability_classifier_v1', { allowDraft: true });
  const intentLangLine = display_lang
    ? `intentLang / display_lang: ${display_lang} — output normalized_intent and suggested_rephrase in this language (same as user input). Do not translate to English.`
    : '';
  if (entry?.user_template) {
    return substituteTemplate(entry.user_template, {
      intent: intent.replace(/"/g, '\\"'),
      timeframe_days: String(timeframe_days ?? 'null'),
      intent_lang: intentLangLine,
    });
  }
  const parts = [
    `Intent: "${intent.replace(/"/g, '\\"')}"`,
    `timeframe_days: ${timeframe_days ?? 'null'}`,
  ];
  if (display_lang) {
    parts.push(`intentLang / display_lang: ${display_lang} — output normalized_intent and suggested_rephrase in this language (same as user input). Do not translate to English.`);
  }
  return parts.join('\n');
}

export type ClassifierVerdict = 'ACTIONABLE' | 'NEEDS_REPHRASE_INLINE';
/** LLM-only codes; API may also return safety_no_suggestion when suggestion is filtered. */
export type ClassifierReasonCode =
  | 'too_vague'
  | 'social_chitchat'
  | 'pure_noun_topic'
  | 'no_action_or_outcome'
  | 'ambiguous_goal'
  | 'ok'
  | 'safety_no_suggestion';

export type ActionabilityClassifierResponse = {
  verdict: ClassifierVerdict;
  reason_code: ClassifierReasonCode;
  category: ClassifierCategory;
  normalized_intent: string;
  suggested_rephrase: string | null;
  confidence: number;
};

const REASON_CODES: ClassifierReasonCode[] = [
  'too_vague',
  'social_chitchat',
  'pure_noun_topic',
  'no_action_or_outcome',
  'ambiguous_goal',
  'ok',
];

function isValidReasonCode(s: string): s is ClassifierReasonCode {
  return (REASON_CODES as string[]).includes(s);
}

function isValidCategory(s: string): s is ClassifierCategory {
  return (CATEGORIES as readonly string[]).includes(s);
}

/**
 * Parse la réponse JSON du LLM. Retourne null si invalide.
 */
export function parseClassifierResponse(raw: string): ActionabilityClassifierResponse | null {
  try {
    const stripped = raw.replace(/^[\s\S]*?\{/, '{').replace(/\}[\s\S]*$/, '}');
    const parsed = JSON.parse(stripped) as Record<string, unknown>;
    const verdict = parsed.verdict;
    const reason_code = parsed.reason_code;
    const category = parsed.category;
    if (verdict !== 'ACTIONABLE' && verdict !== 'NEEDS_REPHRASE_INLINE') return null;
    if (typeof reason_code !== 'string' || !isValidReasonCode(reason_code)) return null;
    const resolvedCategory =
      typeof category === 'string' && isValidCategory(category) ? category : 'LEARN';
    return {
      verdict,
      reason_code,
      category: resolvedCategory,
      normalized_intent: typeof parsed.normalized_intent === 'string' ? parsed.normalized_intent : '',
      suggested_rephrase:
        parsed.suggested_rephrase == null ? null : String(parsed.suggested_rephrase),
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    };
  } catch {
    return null;
  }
}
