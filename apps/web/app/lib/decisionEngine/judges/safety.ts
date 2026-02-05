/**
 * Safety judge: verdict allow | block | uncertain. Used when deterministic hard-block is not enough.
 */

import { getPrompt } from '../../prompts/store';
import { buildUserMessage, runJudgeLLM, parseJsonFromContent, type PromptTraceEntry } from './runJudge';

const PROMPT_NAME = 'safety_judge_v1';

export type SafetyJudgeResult = {
  verdict: 'allow' | 'block' | 'uncertain';
  reason_code: string;
  rationale_en: string;
};

function parse(content: string): SafetyJudgeResult | null {
  const obj = parseJsonFromContent(content);
  if (!obj) return null;
  const verdict = obj.verdict as string;
  if (verdict !== 'allow' && verdict !== 'block' && verdict !== 'uncertain') return null;
  return {
    verdict,
    reason_code: typeof obj.reason_code === 'string' ? obj.reason_code : 'unknown',
    rationale_en: typeof obj.rationale_en === 'string' ? obj.rationale_en : '',
  };
}

export async function runSafetyJudge(
  intent: string,
  promptTrace?: PromptTraceEntry[],
): Promise<SafetyJudgeResult | null> {
  const promptEntry = getPrompt(PROMPT_NAME, { allowDraft: true });
  const userContent = buildUserMessage(promptEntry?.user_template ?? '', { intent });
  const content = await runJudgeLLM(PROMPT_NAME, promptEntry, userContent, {
    maxTokens: 500,
    whereUsed: ['lib/decisionEngine/judges/safety.ts', 'api/judge/safety/route.ts'],
    promptTrace,
  });
  if (!content) return null;
  return parse(content);
}
