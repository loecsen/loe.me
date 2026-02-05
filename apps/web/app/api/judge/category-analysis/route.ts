/**
 * Judge API: category analysis. Dev-only. Per-category actionable, angles, clarify_question.
 */

import { NextResponse } from 'next/server';
import { runCategoryAnalysisJudge } from '../../../lib/decisionEngine/judges/categoryAnalysis';
import type { CategoryId } from '../../../lib/taxonomy/categories';
import { CATEGORY_IDS } from '../../../lib/taxonomy/categories';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      intent?: string;
      category?: string;
      ui_locale?: string;
      intent_lang?: string;
      days?: number;
    };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    const category = typeof body.category === 'string' && (CATEGORY_IDS as readonly string[]).includes(body.category)
      ? (body.category as CategoryId)
      : 'WELLBEING';
    const ui_locale = typeof body.ui_locale === 'string' ? body.ui_locale : 'en';
    const intent_lang = typeof body.intent_lang === 'string' ? body.intent_lang : 'en';
    const days = typeof body.days === 'number' && Number.isFinite(body.days) ? body.days : 14;
    if (!intent) {
      return NextResponse.json({ error: 'intent required' }, { status: 400 });
    }
    const result = await runCategoryAnalysisJudge(category, intent, ui_locale, intent_lang, days);
    if (result === null) {
      return NextResponse.json({ error: 'Judge unavailable or parse failed' }, { status: 200 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
