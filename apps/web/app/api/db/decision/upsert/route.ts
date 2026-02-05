/**
 * Upsert a decision record. Dev-only.
 */

import { NextResponse } from 'next/server';
import { getDecisionStore } from '../../../../lib/db/provider';
import type { DecisionRecordV1 } from '../../../../lib/db/types';
import { DECISION_RECORD_SCHEMA_VERSION } from '../../../../lib/db/types';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Partial<DecisionRecordV1> & {
      intent_raw: string;
      intent_lang: string;
      ui_locale: string;
      days: number;
      unique_key: string;
      context_hash: string;
      verdict: DecisionRecordV1['verdict'];
    };
    const now = new Date().toISOString();
    const record: DecisionRecordV1 = {
      id: body.id ?? `decision:v1:${now}`,
      schema_version: DECISION_RECORD_SCHEMA_VERSION,
      created_at: body.created_at ?? now,
      updated_at: body.updated_at ?? now,
      intent_raw: body.intent_raw ?? '',
      intent_lang: body.intent_lang ?? 'en',
      ui_locale: body.ui_locale ?? 'en',
      days: body.days ?? 14,
      category: body.category ?? null,
      gates: body.gates ?? {},
      verdict: body.verdict ?? 'NEEDS_CLARIFY',
      reason_code: body.reason_code ?? null,
      suggestions: body.suggestions ?? {},
      notes_en: body.notes_en,
      model: body.model,
      unique_key: body.unique_key ?? '',
      context_hash: body.context_hash ?? '',
      confidence: body.confidence,
    };
    const store = getDecisionStore();
    await store.upsert(record);
    return NextResponse.json({ ok: true, id: record.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
