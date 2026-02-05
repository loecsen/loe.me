/**
 * Tone assess: DB-first. Lookup by gate=tone; if fresh return cached; else classify → upsert → return.
 */

import { NextResponse } from 'next/server';
import { getDecisionStore } from '../../../lib/db/provider';
import { buildDecisionUniqueKey } from '../../../lib/db/key';
import { POLICY_VERSION } from '../../../lib/db/constants';
import { isRecordFresh } from '../../../lib/db/freshness';
import type { DecisionGateKind } from '../../../lib/db/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      intent?: string;
      days?: number;
      ui_locale?: string;
      intent_lang?: string;
    };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    if (!intent) {
      return NextResponse.json(
        { tone: 'unclear', confidence: 0, reason_code: 'empty', notes_short: 'Missing intent.', from_cache: false },
        { status: 400 },
      );
    }
    const intent_lang = typeof body.intent_lang === 'string' ? body.intent_lang : 'en';
    const days = typeof body.days === 'number' && Number.isFinite(body.days) ? body.days : 14;
    const gate: DecisionGateKind = 'tone';

    const { unique_key, context_hash } = buildDecisionUniqueKey({
      intent,
      intent_lang,
      category: null,
      days,
      gate,
      policy_version: POLICY_VERSION,
    });
    const store = getDecisionStore();
    const record = await store.getByUniqueKey(unique_key, context_hash);
    if (record && record.gate === 'tone' && record.gates?.tone) {
      const fresh = isRecordFresh(record.updated_at, gate, record.verdict);
      if (fresh) {
        return NextResponse.json({
          tone: record.gates.tone,
          confidence: record.confidence ?? 0.9,
          reason_code: record.reason_code ?? 'cached',
          notes_short: record.notes_en ?? undefined,
          from_cache: true,
        });
      }
    }

    const origin =
      (typeof request.url === 'string' && request.url
        ? new URL(request.url).origin
        : null) ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
      'http://localhost:3000';
    const classifyRes = await fetch(`${origin}/api/tone/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent,
        intent_lang,
        ui_locale: body.ui_locale ?? 'en',
      }),
    });
    const classifyData = (await classifyRes.json()) as {
      tone?: string;
      confidence?: number;
      reason_code?: string;
      notes_short?: string;
    };
    const tone = classifyData.tone ?? 'serious';
    const confidence = typeof classifyData.confidence === 'number' ? classifyData.confidence : 0.5;
    const reason_code = classifyData.reason_code ?? 'unknown';
    const notes_short = classifyData.notes_short;

    try {
      await fetch(`${origin}/api/db/decision/upsert-from-tone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent,
          days,
          ui_locale: body.ui_locale ?? 'en',
          intent_lang,
          tone,
          reason_code,
          confidence,
          notes_short,
        }),
      });
    } catch {
      /* persist best-effort */
    }

    return NextResponse.json({
      tone,
      confidence,
      reason_code,
      notes_short,
      from_cache: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    return NextResponse.json(
      { tone: 'unclear', confidence: 0, reason_code: 'error', notes_short: message, from_cache: false },
      { status: 500 },
    );
  }
}
