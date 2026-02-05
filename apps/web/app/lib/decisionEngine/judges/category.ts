/**
 * Category router: LEARN, CREATE, PERFORM, WELLBEING, SOCIAL, CHALLENGE.
 */

import { CATEGORY_IDS } from '../../taxonomy/categories';
import type { CategoryId } from '../../taxonomy/categories';
import { getPrompt } from '../../prompts/store';
import { buildUserMessage, runJudgeLLM, parseJsonFromContent, type PromptTraceEntry } from './runJudge';

const PROMPT_NAME = 'category_router_v1';

export type CategoryRouterResult = {
  category: CategoryId;
  subcategory?: string | null;
  confidence: number;
  rationale_en: string;
};

function parse(content: string): CategoryRouterResult | null {
  const obj = parseJsonFromContent(content);
  if (!obj) return null;
  const cat = typeof obj.category === 'string' ? (obj.category as string).toUpperCase() : '';
  if (!(CATEGORY_IDS as readonly string[]).includes(cat)) return null;
  const confidence = typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0.5;
  return {
    category: cat as CategoryId,
    subcategory: typeof obj.subcategory === 'string' ? obj.subcategory : null,
    confidence,
    rationale_en: typeof obj.rationale_en === 'string' ? obj.rationale_en : '',
  };
}

export async function runCategoryRouter(
  intent: string,
  promptTrace?: PromptTraceEntry[],
): Promise<CategoryRouterResult | null> {
  const promptEntry = getPrompt(PROMPT_NAME, { allowDraft: true });
  const userContent = buildUserMessage(promptEntry?.user_template ?? '', { intent });
  const content = await runJudgeLLM(PROMPT_NAME, promptEntry, userContent, {
    maxTokens: 500,
    whereUsed: ['lib/decisionEngine/judges/category.ts', 'api/judge/category/route.ts'],
    promptTrace,
  });
  if (!content) return null;
  return parse(content);
}
