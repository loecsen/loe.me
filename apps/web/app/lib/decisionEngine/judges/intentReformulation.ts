/**
 * Intent reformulation: one short method-style title in intent_lang, with days included in the phrase (v2).
 * Used between safety and category so it appears in the pipeline trace.
 */

import { getPrompt } from '../../prompts/store';
import { buildUserMessage, runJudgeLLM, parseJsonFromContent, type PromptTraceEntry } from './runJudge';

const PROMPT_NAME = 'intent_reformulation_v2';

export type IntentReformulationResult = {
  reformulated_intent: string;
};

function parse(content: string): IntentReformulationResult | null {
  const obj = parseJsonFromContent(content);
  if (!obj) return null;
  const reformulated_intent = obj.reformulated_intent;
  if (typeof reformulated_intent !== 'string' || !reformulated_intent.trim()) return null;
  return { reformulated_intent: reformulated_intent.trim() };
}

export async function runIntentReformulation(
  intent: string,
  intent_lang: string,
  days: number,
  promptTrace?: PromptTraceEntry[],
): Promise<IntentReformulationResult | null> {
  const promptEntry = getPrompt(PROMPT_NAME, { allowDraft: true });
  const userContent = buildUserMessage(promptEntry?.user_template ?? '', {
    intent,
    intent_lang,
    days,
  });
  const content = await runJudgeLLM(PROMPT_NAME, promptEntry, userContent, {
    maxTokens: 500,
    whereUsed: ['lib/decisionEngine/judges/intentReformulation.ts'],
    promptTrace,
  });
  if (!content) return null;
  return parse(content);
}
