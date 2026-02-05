/**
 * Realism judge: ok | stretch | unrealistic. Used when category requires feasibility (LEARN/CREATE/WELLBEING).
 */

import type { CategoryId } from '../../taxonomy/categories';
import { getPrompt } from '../../prompts/store';
import { buildUserMessage, runJudgeLLM, parseJsonFromContent, type PromptTraceEntry } from './runJudge';

const PROMPT_NAME = 'realism_judge_v1';

export type RealismAdjustment = {
  label: string;
  next_intent: string;
  next_days?: number;
};

export type RealismJudgeResult = {
  realism: 'ok' | 'stretch' | 'unrealistic';
  why_short: string;
  adjustments: RealismAdjustment[] | null;
};

function parse(content: string): RealismJudgeResult | null {
  const obj = parseJsonFromContent(content);
  if (!obj) return null;
  const realism = (typeof obj.realism === 'string' ? obj.realism : 'ok').toLowerCase();
  const valid = ['ok', 'stretch', 'unrealistic'];
  const realismOk = valid.includes(realism) ? realism : 'ok';
  let adjustments: RealismAdjustment[] | null = null;
  if (Array.isArray(obj.adjustments)) {
    adjustments = obj.adjustments
      .filter((a: unknown) => a && typeof a === 'object' && 'label' in a && 'next_intent' in a)
      .map((a: Record<string, unknown>) => ({
        label: String(a.label),
        next_intent: String(a.next_intent),
        next_days: typeof a.next_days === 'number' ? a.next_days : undefined,
      }));
  }
  return {
    realism: realismOk as RealismJudgeResult['realism'],
    why_short: typeof obj.why_short === 'string' ? obj.why_short : '',
    adjustments: adjustments?.length ? adjustments : null,
  };
}

export async function runRealismJudge(
  intent: string,
  days: number,
  ui_locale: string,
  _category?: CategoryId,
  promptTrace?: PromptTraceEntry[],
): Promise<RealismJudgeResult | null> {
  const promptEntry = getPrompt(PROMPT_NAME, { allowDraft: true });
  const userContent = buildUserMessage(promptEntry?.user_template ?? '', {
    intent,
    days: String(days),
    ui_locale,
  });
  const content = await runJudgeLLM(PROMPT_NAME, promptEntry, userContent, {
    maxTokens: 500,
    whereUsed: ['lib/decisionEngine/judges/realism.ts', 'api/judge/realism/route.ts'],
    promptTrace,
  });
  if (!content) return null;
  return parse(content);
}
