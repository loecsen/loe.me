/**
 * Equivalence judge: decide if two intents are the same request (for cache reuse).
 * Used when similarity score is in [0.70, 0.90]. Loads prompt from store, calls LLM, records use.
 */

import { getPrompt } from '../../prompts/store';
import { recordPromptUse } from '../../db/recordPromptUse';
import { getSiteLlmClientForTier } from '../../llm/router';
const PROMPT_NAME = 'equivalence_judge_v1';
const JUDGE_TIMEOUT_MS = 5_000;

export type EquivalenceJudgeResult = {
  same_request: boolean;
  confidence: number;
  reason_en: string;
};

function buildUserMessage(template: string, intent_a: string, intent_b: string): string {
  return template
    .replace(/\{\{intent_a\}\}/g, intent_a)
    .replace(/\{\{intent_b\}\}/g, intent_b);
}

function parseJudgeOutput(content: string): EquivalenceJudgeResult | null {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const obj = JSON.parse(jsonMatch[0]) as { same_request?: boolean; confidence?: number; reason_en?: string };
    const same_request = typeof obj.same_request === 'boolean' ? obj.same_request : false;
    const confidence = typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0;
    const reason_en = typeof obj.reason_en === 'string' ? obj.reason_en : '';
    return { same_request, confidence, reason_en };
  } catch {
    return null;
  }
}

/**
 * Run equivalence judge: load prompt, call LLM, record use, return result.
 * Returns null on missing prompt, API error, or parse failure.
 */
export async function runEquivalenceJudge(
  intent_a: string,
  intent_b: string,
  promptTrace?: PromptTraceEntry[],
): Promise<EquivalenceJudgeResult | null> {
  const promptEntry = getPrompt(PROMPT_NAME, { allowDraft: true });
  if (!promptEntry?.user_template) return null;

  const userContent = buildUserMessage(promptEntry.user_template, intent_a, intent_b);

  await recordPromptUse({
    prompt_name: promptEntry.name,
    version: promptEntry.version,
    purpose_en: promptEntry.purpose_en,
    where_used: ['lib/decisionEngine/judges/equivalence.ts', 'api/judge/equivalence/route.ts'],
    prompt_text: (promptEntry.system ?? '') + '\n' + promptEntry.user_template,
    input_schema: promptEntry.input_schema ?? { intent_a: 'string', intent_b: 'string' },
    output_schema: promptEntry.output_schema ?? { same_request: 'boolean', confidence: 'number', reason_en: 'string' },
    token_budget_target: promptEntry.token_budget_target,
    safety_notes_en: promptEntry.safety_notes_en,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);

  try {
    const siteClient = await getSiteLlmClientForTier('reasoning');
    const res = await siteClient.client.chat.completions.create({
      model: siteClient.model,
      messages: [
        ...(promptEntry.system ? [{ role: 'system' as const, content: promptEntry.system }] : []),
        { role: 'user' as const, content: userContent },
      ],
      max_tokens: 120,
      temperature: 0.1,
    }, { signal: controller.signal });
    clearTimeout(timeoutId);

    const content = res.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    if (promptTrace) promptTrace.push({ prompt_name: PROMPT_NAME, response: content });
    return parseJudgeOutput(content);
  } catch {
    return null;
  }
}
