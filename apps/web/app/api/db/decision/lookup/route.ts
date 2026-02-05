/**
 * Lookup decision by unique key. Dev-only. Used by Home "consult DB first".
 * Freshness depends on gate: controllability 90d, classify 7–14d.
 */

import { NextResponse } from 'next/server';
import { getDecisionStore } from '../../../../lib/db/provider';
import { buildDecisionUniqueKey } from '../../../../lib/db/key';
import { isRecordFresh } from '../../../../lib/db/freshness';
import type { DecisionGateKind } from '../../../../lib/db/types';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  try {
    const body = (await request.json()) as {
      intent?: string;
      days?: number;
      ui_locale?: string;
      intent_lang?: string;
      category?: string | null;
      requires_feasibility?: boolean;
      gate?: DecisionGateKind;
    };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    if (!intent) {
      return NextResponse.json({ found: false });
    }
    const gate: DecisionGateKind = body.gate ?? 'classify';
    const { unique_key, context_hash } = buildDecisionUniqueKey({
      intent,
      intent_lang: body.intent_lang ?? 'en',
      category: body.category ?? null,
      days: typeof body.days === 'number' ? body.days : 14,
      gate,
      context_flags: { requires_feasibility: body.requires_feasibility ?? false },
    });
    const store = getDecisionStore();
    const record = await store.getByUniqueKey(unique_key, context_hash);
    if (!record) {
      return NextResponse.json({ found: false });
    }
    const recordGate = (record.gate ?? 'classify') as DecisionGateKind;
    const fresh = isRecordFresh(record.updated_at, recordGate, record.verdict);
    return NextResponse.json({ found: true, record, fresh });
  } catch {
    return NextResponse.json({ found: false });
  }
}
