/**
 * Category analysis judge: per-category (LEARN, CREATE, etc.) — actionable, needs_clarification, angles.
 */

import type { CategoryId } from '../../taxonomy/categories';
import { getPrompt } from '../../prompts/store';
import { buildUserMessage, runJudgeLLM, parseJsonFromContent, type PromptTraceEntry } from './runJudge';
import type { DecisionAngle } from '../types';

const PROMPT_NAME_PREFIX = 'category_analysis_v1_';

export type CategoryAnalysisResult = {
  actionable: boolean;
  needs_clarification: boolean;
  clarify_question: string | null;
  angles: DecisionAngle[] | null;
  suggested_rewrites: DecisionAngle[] | null;
  notes_en: string;
};

function toAngle(a: unknown): DecisionAngle | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  if (typeof o.label !== 'string' || typeof o.next_intent !== 'string') return null;
  return { label: o.label, next_intent: o.next_intent, days: typeof o.days === 'number' ? o.days : undefined };
}

function parse(content: string): CategoryAnalysisResult | null {
  const obj = parseJsonFromContent(content);
  if (!obj) return null;
  const angles = Array.isArray(obj.angles)
    ? obj.angles.map(toAngle).filter((a): a is DecisionAngle => a != null)
    : null;
  const suggested_rewrites = Array.isArray(obj.suggested_rewrites)
    ? obj.suggested_rewrites.map(toAngle).filter((a): a is DecisionAngle => a != null)
    : null;
  return {
    actionable: typeof obj.actionable === 'boolean' ? obj.actionable : false,
    needs_clarification: typeof obj.needs_clarification === 'boolean' ? obj.needs_clarification : false,
    clarify_question: typeof obj.clarify_question === 'string' ? obj.clarify_question : null,
    angles: angles?.length ? angles.slice(0, 4) : null,
    suggested_rewrites: suggested_rewrites?.length ? suggested_rewrites : null,
    notes_en: typeof obj.notes_en === 'string' ? obj.notes_en : '',
  };
}

export function getCategoryAnalysisPromptName(category: CategoryId): string {
  return PROMPT_NAME_PREFIX + category;
}

export async function runCategoryAnalysisJudge(
  category: CategoryId,
  intent: string,
  ui_locale: string,
  intent_lang: string,
  days: number,
  promptTrace?: PromptTraceEntry[],
): Promise<CategoryAnalysisResult | null> {
  const promptName = getCategoryAnalysisPromptName(category);
  const promptEntry = getPrompt(promptName, { allowDraft: true });
  const userContent = buildUserMessage(promptEntry?.user_template ?? '', {
    intent,
    ui_locale,
    intent_lang,
    days: String(days),
  });
  const content = await runJudgeLLM(promptName, promptEntry, userContent, {
    maxTokens: 500,
    whereUsed: ['lib/decisionEngine/judges/categoryAnalysis.ts', 'api/judge/category-analysis/route.ts'],
    promptTrace,
  });
  if (!content) return null;
  return parse(content);
}
