/**
 * Build a decision record from controllability/check response and upsert. Dev-only.
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
      level?: string;
      reason_code?: string;
      confidence?: number;
      rewritten_intent?: string | null;
      angles?: Array<{ label: string; intent: string; days?: number }>;
    };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    if (!intent) {
      return NextResponse.json({ error: 'intent required' }, { status: 400 });
    }
    const days = typeof body.days === 'number' ? body.days : 14;
    const category = body.category ?? null;
    const requires_feasibility = category != null ? categoryRequiresFeasibility(category as import('../../../../../lib/category').Category) : false;
    const { unique_key, context_hash } = buildDecisionUniqueKey({
      intent,
      intent_lang: body.intent_lang ?? 'en',
      category,
      days,
      gate: 'controllability',
      policy_version: POLICY_VERSION,
      context_flags: { requires_feasibility },
    });
    const now = new Date().toISOString();
    const verdict = body.level === 'low' ? 'NEEDS_CLARIFY' : 'ACTIONABLE';
    const record: DecisionRecordV1 = {
      id: decisionIdFromUniqueKey(unique_key),
      schema_version: DECISION_RECORD_SCHEMA_VERSION,
      created_at: now,
      updated_at: now,
      intent_raw: intent,
      intent_lang: body.intent_lang ?? 'en',
      ui_locale: body.ui_locale ?? 'en',
      days,
      category,
      gates: { controllability: body.level ?? 'medium' },
      verdict,
      reason_code: body.reason_code ?? null,
      suggestions: {
        rewritten_intent: body.rewritten_intent ?? undefined,
        angles: body.angles ?? [],
      },
      unique_key,
      context_hash,
      confidence: body.confidence,
      policy_version: POLICY_VERSION,
      gate: 'controllability',
    };
    const store = getDecisionStore();
    await store.upsert(record);
    return NextResponse.json({ ok: true, id: record.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
