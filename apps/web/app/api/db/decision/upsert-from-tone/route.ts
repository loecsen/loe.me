/**
 * Build a decision record from tone classify/assess and upsert. Dev-only.
 * Gate = tone; verdict ACTIONABLE when serious, NEEDS_CLARIFY when playful/nonsense/unclear.
 */

import { NextResponse } from 'next/server';
import { getDecisionStore } from '../../../../lib/db/provider';
import { buildDecisionUniqueKey, decisionIdFromUniqueKey } from '../../../../lib/db/key';
import { POLICY_VERSION } from '../../../../lib/db/constants';
import type { DecisionRecordV1 } from '../../../../lib/db/types';
import { DECISION_RECORD_SCHEMA_VERSION } from '../../../../lib/db/types';

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
      tone: string;
      reason_code?: string;
      confidence?: number;
      notes_short?: string;
    };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    if (!intent) {
      return NextResponse.json({ error: 'intent required' }, { status: 400 });
    }
    const tone = typeof body.tone === 'string' ? body.tone : 'serious';
    const days = typeof body.days === 'number' ? body.days : 14;
    const { unique_key, context_hash } = buildDecisionUniqueKey({
      intent,
      intent_lang: body.intent_lang ?? 'en',
      category: null,
      days,
      gate: 'tone',
      policy_version: POLICY_VERSION,
    });
    const now = new Date().toISOString();
    const verdict = tone === 'serious' ? 'ACTIONABLE' : 'NEEDS_CLARIFY';
    const record: DecisionRecordV1 = {
      id: decisionIdFromUniqueKey(unique_key),
      schema_version: DECISION_RECORD_SCHEMA_VERSION,
      created_at: now,
      updated_at: now,
      intent_raw: intent,
      intent_lang: body.intent_lang ?? 'en',
      ui_locale: body.ui_locale ?? 'en',
      days,
      category: null,
      gates: { tone },
      verdict,
      reason_code: body.reason_code ?? null,
      suggestions: {},
      unique_key,
      context_hash,
      confidence: body.confidence,
      policy_version: POLICY_VERSION,
      gate: 'tone',
    };
    const store = getDecisionStore();
    await store.upsert(record);
    return NextResponse.json({ ok: true, id: record.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
