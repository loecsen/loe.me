/**
 * Tone / aspiration judge: serious | aspirational | playful | joke, requires_confirmation.
 */

import { getPrompt } from '../../prompts/store';
import { buildUserMessage, runJudgeLLM, parseJsonFromContent } from './runJudge';

const PROMPT_NAME = 'tone_aspiration_v1';

export type ToneAspirationResult = {
  tone: 'serious' | 'aspirational' | 'playful' | 'joke';
  requires_confirmation: boolean;
  rationale_en: string;
};

function parse(content: string): ToneAspirationResult | null {
  const obj = parseJsonFromContent(content);
  if (!obj) return null;
  const tone = (typeof obj.tone === 'string' ? obj.tone : 'serious').toLowerCase();
  const valid = ['serious', 'aspirational', 'playful', 'joke'];
  const toneOk = valid.includes(tone) ? tone : 'serious';
  return {
    tone: toneOk as ToneAspirationResult['tone'],
    requires_confirmation: typeof obj.requires_confirmation === 'boolean' ? obj.requires_confirmation : false,
    rationale_en: typeof obj.rationale_en === 'string' ? obj.rationale_en : '',
  };
}

export async function runToneAspirationJudge(intent: string): Promise<ToneAspirationResult | null> {
  const promptEntry = getPrompt(PROMPT_NAME, { allowDraft: true });
  const userContent = buildUserMessage(promptEntry?.user_template ?? '', { intent });
  const content = await runJudgeLLM(PROMPT_NAME, promptEntry, userContent, {
    maxTokens: 500,
    whereUsed: ['lib/decisionEngine/judges/tone.ts', 'api/judge/tone/route.ts'],
  });
  if (!content) return null;
  return parse(content);
}
