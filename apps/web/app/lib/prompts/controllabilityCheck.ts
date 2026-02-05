/**
 * Micro LLM prompt for controllability check. Single source: lib/prompts/published/controllability_check_v1.json (no duplicate).
 * Fallback to constant when file missing.
 */

import { getPrompt } from './store';

const CONTROLLABILITY_CHECK_SYSTEM_FALLBACK = `You are a strict classifier for whether a short user intent depends on outcomes the user cannot fully control (other people, institutions, luck). Return ONLY valid JSON:
{
  "level": "high" | "medium" | "low",
  "reason_code": "depends_on_other_people" | "depends_on_institution" | "depends_on_random_outcome" | "romantic_outcome" | "approval_or_selection" | "life_goal_elite_role" | "unknown",
  "confidence": number,
  "rewritten_intent": string | null,
  "angles": [{"label": string, "intent": string, "days": number | null}],
  "tone": "supportive" | "neutral"
}
Rules:
- high = outcome is mostly under user control (actions, practice, learning). low = outcome depends on others/luck/institutions. medium = unclear.
- rewritten_intent: one short sentence in the SAME language as the user intent, framing the goal as "improve my chances through actions I can control". If no good rewrite, null.
- angles: 2-4 items. label in UI locale (short, for a chip). intent in the SAME language as user intent (actionable goal). days optional.
- MUST be safe: no explicit sexual content, no instructions for wrongdoing. Do not promise outcomes that depend on others.
- Keep prompt short; low token usage.`;

/** System prompt: from published JSON or fallback. */
export function getControllabilityCheckSystem(): string {
  const entry = getPrompt('controllability_check_v1', { allowDraft: true });
  return entry?.system ?? CONTROLLABILITY_CHECK_SYSTEM_FALLBACK;
}

function substituteTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return out;
}

export function buildControllabilityCheckUser(
  intent: string,
  timeframe_days?: number,
  locale?: string,
  category_hint?: string,
): string {
  const entry = getPrompt('controllability_check_v1', { allowDraft: true });
  if (entry?.user_template) {
    return substituteTemplate(entry.user_template, {
      intent: intent.replace(/"/g, '\\"'),
      timeframe_days: String(timeframe_days ?? ''),
      locale: locale ?? '',
      category_hint: category_hint ?? '',
    });
  }
  const parts = [`Intent: "${intent.replace(/"/g, '\\"')}"`];
  if (timeframe_days != null) parts.push(`timeframe_days: ${timeframe_days}`);
  if (locale) parts.push(`locale: ${locale}`);
  if (category_hint) parts.push(`category_hint: ${category_hint}`);
  return parts.join('\n');
}

export type ControllabilityCheckResponse = {
  level: 'high' | 'medium' | 'low';
  reason_code: string;
  confidence: number;
  rewritten_intent: string | null;
  angles: Array<{ label: string; intent: string; days?: number | null }>;
  tone: 'supportive' | 'neutral';
};

export function parseControllabilityCheckResponse(raw: string): ControllabilityCheckResponse | null {
  try {
    const stripped = raw.replace(/^[\s\S]*?\{/, '{').replace(/\}[\s\S]*$/, '}');
    const parsed = JSON.parse(stripped) as Record<string, unknown>;
    const level = parsed.level;
    if (level !== 'high' && level !== 'medium' && level !== 'low') return null;
    const angles = Array.isArray(parsed.angles)
      ? (parsed.angles as Array<{ label?: string; intent?: string; days?: number | null }>)
          .filter((a) => a && typeof a.label === 'string' && typeof a.intent === 'string')
          .map((a) => ({
            label: String(a.label),
            intent: String(a.intent),
            days: a.days != null && Number.isFinite(a.days) ? (a.days as number) : undefined,
          }))
      : [];
    return {
      level,
      reason_code: typeof parsed.reason_code === 'string' ? parsed.reason_code : 'unknown',
      confidence: typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence) ? parsed.confidence : 0.5,
      rewritten_intent:
        parsed.rewritten_intent != null && typeof parsed.rewritten_intent === 'string'
          ? (parsed.rewritten_intent as string).trim() || null
          : null,
      angles: angles.slice(0, 4),
      tone: parsed.tone === 'supportive' || parsed.tone === 'neutral' ? parsed.tone : 'neutral',
    };
  } catch {
    return null;
  }
}
