/**
 * Prompt versionné pour le classifieur LLM actionability.
 * Utilisé UNIQUEMENT en fallback quand le rule-based retourne BORDERLINE.
 */

export const ACTIONABILITY_CLASSIFIER_SYSTEM = `You are a strict classifier for whether a short user intent can be turned into a concrete, day-by-day micro-ritual plan.
Return ONLY valid JSON matching this schema:
{
  "verdict": "ACTIONABLE" | "NEEDS_REPHRASE_INLINE",
  "reason_code": "too_vague" | "social_chitchat" | "pure_noun_topic" | "no_action_or_outcome" | "ambiguous_goal" | "ok",
  "normalized_intent": string,
  "suggested_rephrase": string | null,
  "confidence": number
}
Rules:
- ACTIONABLE means a ritual can be generated without follow-up questions because there is at least an action OR a clear goal/outcome.
- NEEDS_REPHRASE_INLINE means purely social, not a ritual request, or too vague.
- Multilingual: short CJK/Korean can still be actionable (e.g., "피자 만들기", "学习中文A2").
- suggested_rephrase must be same language as intent, <= 12 words, include action + outcome when possible.
- normalized_intent: light cleanup, no translation.
Heuristics:
- Pure greetings/chitchat → NEEDS_REPHRASE_INLINE.
- Single noun/topic without action/outcome → NEEDS_REPHRASE_INLINE.
- Doing/making/practicing/learning/improving + object → ACTIONABLE.
- Consume/enjoy only ("eat pizza") without learning/skill/outcome → prefer NEEDS_REPHRASE_INLINE.
- If timeframe_days present and intent is a skill/learning goal → prefer ACTIONABLE.`;

export function buildActionabilityClassifierUser(intent: string, timeframe_days?: number): string {
  return `Intent: "${intent.replace(/"/g, '\\"')}"
timeframe_days: ${timeframe_days ?? 'null'}`;
}

export type ClassifierVerdict = 'ACTIONABLE' | 'NEEDS_REPHRASE_INLINE';
export type ClassifierReasonCode =
  | 'too_vague'
  | 'social_chitchat'
  | 'pure_noun_topic'
  | 'no_action_or_outcome'
  | 'ambiguous_goal'
  | 'ok';

export type ActionabilityClassifierResponse = {
  verdict: ClassifierVerdict;
  reason_code: ClassifierReasonCode;
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

/**
 * Parse la réponse JSON du LLM. Retourne null si invalide.
 */
export function parseClassifierResponse(raw: string): ActionabilityClassifierResponse | null {
  try {
    const stripped = raw.replace(/^[\s\S]*?\{/, '{').replace(/\}[\s\S]*$/, '}');
    const parsed = JSON.parse(stripped) as Record<string, unknown>;
    const verdict = parsed.verdict;
    const reason_code = parsed.reason_code;
    if (verdict !== 'ACTIONABLE' && verdict !== 'NEEDS_REPHRASE_INLINE') return null;
    if (typeof reason_code !== 'string' || !isValidReasonCode(reason_code)) return null;
    return {
      verdict,
      reason_code,
      normalized_intent: typeof parsed.normalized_intent === 'string' ? parsed.normalized_intent : '',
      suggested_rephrase:
        parsed.suggested_rephrase == null ? null : String(parsed.suggested_rephrase),
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    };
  } catch {
    return null;
  }
}
