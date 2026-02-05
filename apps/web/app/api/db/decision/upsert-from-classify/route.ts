/**
 * Build a decision record from actionability/classify response and upsert. Dev-only.
 */

import { NextResponse } from 'next/server';
import { getDecisionStore } from '../../../../lib/db/provider';
import { buildDecisionUniqueKey, decisionIdFromUniqueKey } from '../../../../lib/db/key';
import { POLICY_VERSION } from '../../../../lib/db/constants';
import type { DecisionRecordV1 } from '../../../../lib/db/types';
import { DECISION_RECORD_SCHEMA_VERSION } from '../../../../lib/db/types';
import { categoryRequiresFeasibility } from '../../../../lib/category';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const body = (await request.json()) as {
      intent: string;
      days?: number;
      ui_locale?: string;
      intent_lang?: string;
      category?: string | null;
      verdict?: string;
      reason_code?: string;
      normalized_intent?: string;
      suggested_rephrase?: string | null;
      category_from_classify?: string | null;
      realism?: string;
      realism_why_short?: string;
      realism_adjustments?: Array<{ label: string; intent: string; days?: number }>;
    };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    if (!intent) {
      return NextResponse.json({ error: 'intent required' }, { status: 400 });
    }
    const days = typeof body.days === 'number' ? body.days : 14;
    const category = body.category ?? body.category_from_classify ?? null;
    const requires_feasibility = category != null ? categoryRequiresFeasibility(category as import('../../../../../lib/category').Category) : false;
    const { unique_key, context_hash } = buildDecisionUniqueKey({
      intent,
      intent_lang: body.intent_lang ?? 'en',
      category,
      days,
      gate: 'classify',
      policy_version: POLICY_VERSION,
      context_flags: { requires_feasibility },
    });
    const now = new Date().toISOString();
    const verdict = (body.verdict === 'ACTIONABLE' || body.verdict === 'BLOCKED' ? body.verdict : 'NEEDS_CLARIFY') as DecisionRecordV1['verdict'];
    const record: DecisionRecordV1 = {
      id: decisionIdFromUniqueKey(unique_key),
      schema_version: DECISION_RECORD_SCHEMA_VERSION,
      created_at: now,
      updated_at: now,
      intent_raw: intent,
      intent_lang: body.intent_lang ?? 'en',
      ui_locale: body.ui_locale ?? 'en',
      days,
      category: category ?? body.category_from_classify ?? null,
      gates: { actionability: body.verdict ?? undefined },
      verdict,
      reason_code: body.reason_code ?? null,
      suggestions: {
        rewritten_intent: body.normalized_intent ?? body.suggested_rephrase ?? undefined,
      },
      unique_key,
      context_hash,
      policy_version: POLICY_VERSION,
      gate: 'classify',
      normalized_intent: body.normalized_intent ?? undefined,
      realism_why_short: body.realism_why_short,
      realism_adjustments: body.realism_adjustments,
    };
    const store = getDecisionStore();
    await store.upsert(record);
    return NextResponse.json({ ok: true, id: record.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
