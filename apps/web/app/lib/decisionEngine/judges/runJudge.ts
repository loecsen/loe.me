/**
 * Shared: load prompt, call LLM, record use. Used by all judges.
 */

import { getPrompt } from '../../prompts/store';
import { recordPromptUse } from '../../db/recordPromptUse';
import type { PromptEntry } from '../../prompts/store';
import { getSiteLlmClientForTier } from '../../llm/router';

const DEFAULT_TIMEOUT_MS = 6_000;

export function buildUserMessage(
  template: string,
  vars: Record<string, string | number>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }
  return out;
}

export type PromptTraceEntry = { prompt_name: string; response: string };

/**
 * Run LLM judge: record use, call OpenAI, return raw content or null.
 * When options.promptTrace is provided, pushes { prompt_name, response } when content is not null.
 */
export async function runJudgeLLM(
  promptName: string,
  promptEntry: PromptEntry | null,
  userContent: string,
  options?: { maxTokens?: number; timeoutMs?: number; whereUsed?: string[]; promptTrace?: PromptTraceEntry[] },
): Promise<string | null> {
  if (!promptEntry?.user_template) return null;

  await recordPromptUse({
    prompt_name: promptEntry.name,
    version: promptEntry.version,
    purpose_en: promptEntry.purpose_en,
    where_used: options?.whereUsed ?? [`lib/decisionEngine/judges`, `api/judge`],
    prompt_text: (promptEntry.system ?? '') + '\n' + promptEntry.user_template,
    input_schema: promptEntry.input_schema,
    output_schema: promptEntry.output_schema,
    token_budget_target: promptEntry.token_budget_target,
    safety_notes_en: promptEntry.safety_notes_en,
  });

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = options?.maxTokens ?? 500;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const siteClient = await getSiteLlmClientForTier('reasoning');
    const res = await siteClient.client.chat.completions.create({
      model: siteClient.model,
      messages: [
        ...(promptEntry.system ? [{ role: 'system' as const, content: promptEntry.system }] : []),
        { role: 'user' as const, content: userContent },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
    }, { signal: controller.signal });
    clearTimeout(timeoutId);
    const content = res.choices?.[0]?.message?.content?.trim() ?? null;
    if (content != null && options?.promptTrace) {
      options.promptTrace.push({ prompt_name: promptName, response: content });
    }
    return content;
  } catch {
    return null;
  }
}

export function parseJsonFromContent(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
