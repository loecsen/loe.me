/**
 * Objectives preview: 1-3 short objectives in intent language for the confirmation screen.
 */

import { getPrompt } from '../../prompts/store';
import { buildUserMessage, runJudgeLLM, parseJsonFromContent, type PromptTraceEntry } from './runJudge';

const PROMPT_NAME = 'objectives_preview_v1';

export type ObjectivesPreviewResult = {
  objectives: string[];
};

function parse(content: string): ObjectivesPreviewResult | null {
  const obj = parseJsonFromContent(content);
  if (!obj) return null;
  const raw = obj.objectives;
  if (!Array.isArray(raw)) return null;
  const objectives = raw
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, 3);
  return objectives.length ? { objectives } : null;
}

export async function runObjectivesPreview(
  intent: string,
  intent_lang: string,
  days: number,
  promptTrace?: PromptTraceEntry[],
): Promise<ObjectivesPreviewResult | null> {
  const promptEntry = getPrompt(PROMPT_NAME, { allowDraft: true });
  const userContent = buildUserMessage(promptEntry?.user_template ?? '', {
    intent,
    intent_lang,
    days,
  });
  const content = await runJudgeLLM(PROMPT_NAME, promptEntry, userContent, {
    maxTokens: 300,
    whereUsed: ['lib/decisionEngine/judges/objectivesPreview.ts'],
    promptTrace,
  });
  if (!content) return null;
  return parse(content);
}
