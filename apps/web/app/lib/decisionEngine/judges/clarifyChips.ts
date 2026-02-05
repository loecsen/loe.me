/**
 * Clarify chips: dynamic contract for refine modal.
 */

import { getPrompt } from '../../prompts/store';
import { buildUserMessage, runJudgeLLM, parseJsonFromContent, type PromptTraceEntry } from './runJudge';
import { clarifyChipsJudgeSchema, type ClarifyChipsJudgeValue } from '../clarifyChipsSchema';

const PROMPT_NAME = 'clarify_chips_v1';

export type ClarifyChipsJudgeResult =
  | { ok: true; value: ClarifyChipsJudgeValue }
  | { ok: false; error: string };

function parse(content: string): ClarifyChipsJudgeResult {
  const obj = parseJsonFromContent(content);
  if (!obj) return { ok: false, error: 'no_json' };
  const parsed = clarifyChipsJudgeSchema.safeParse(obj);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_schema' };
  }
  return { ok: true, value: parsed.data };
}

export async function runClarifyChips(
  intent: string,
  intent_lang: string,
  ui_locale: string,
  days: number,
  domain: string,
  promptTrace?: PromptTraceEntry[],
): Promise<ClarifyChipsJudgeResult> {
  const promptEntry = getPrompt(PROMPT_NAME, { allowDraft: true });
  const userContent = buildUserMessage(promptEntry?.user_template ?? '', {
    intent,
    intent_lang,
    ui_locale,
    days,
    domain,
  });
  const content = await runJudgeLLM(PROMPT_NAME, promptEntry, userContent, {
    maxTokens: 520,
    whereUsed: ['lib/decisionEngine/judges/clarifyChips.ts'],
    promptTrace,
  });
  if (!content) return { ok: false, error: 'no_content' };
  return parse(content);
}
