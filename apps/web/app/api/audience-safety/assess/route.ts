/**
 * Audience safety assessment: DB lookup first, else classify + upsert. Returns { level }.
 * Used by Home and missions/generate to get audience_safety_level without duplicating logic.
 */

import { NextResponse } from 'next/server';
import { getDecisionStore } from '../../../lib/db/provider';
import { buildDecisionUniqueKey } from '../../../lib/db/key';
import { isRecordFresh } from '../../../lib/db/freshness';
import { assessAudienceSafety } from '../../../lib/actionability/audienceSafety';
import type { AudienceSafetyLevel } from '../../../lib/actionability/audienceSafety';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { intent?: string; days?: number; ui_locale?: string; intent_lang?: string };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    const days = typeof body.days === 'number' && Number.isFinite(body.days) ? body.days : 14;
    const ui_locale = typeof body.ui_locale === 'string' ? body.ui_locale : 'en';
    const intent_lang = typeof body.intent_lang === 'string' ? body.intent_lang : ui_locale;

    if (!intent) {
      return NextResponse.json({ level: 'all_ages' }, { status: 400 });
    }

    const store = getDecisionStore();
    const { unique_key, context_hash } = buildDecisionUniqueKey({
      intent,
      intent_lang,
      category: null,
      days,
      gate: 'audience_safety',
      context_flags: { requires_feasibility: false },
    });
    const record = await store.getByUniqueKey(unique_key, context_hash);
    if (record && isRecordFresh(record.updated_at, 'audience_safety', record.verdict)) {
      const level = (record.gates?.audience_safety as AudienceSafetyLevel) ?? 'all_ages';
      return NextResponse.json({ level });
    }

    const origin = typeof request.url === 'string' ? new URL(request.url).origin : '';
    const result = await assessAudienceSafety(intent, intent_lang, ui_locale, origin
      ? async (payload) => {
          const res = await fetch(`${origin}/api/audience-safety/classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          return res.json() as Promise<{ level: AudienceSafetyLevel; reason_code?: string; confidence?: number; notes_short?: string }>;
        }
      : undefined);

    if (origin && result) {
      try {
        await fetch(`${origin}/api/db/decision/upsert-from-audience-safety`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent,
            intent_lang,
            ui_locale,
            days,
            level: result.level,
            reason_code: result.reason_code,
            confidence: result.confidence,
            notes_short: result.notes_short,
          }),
        });
      } catch {
        /* best-effort */
      }
    }

    return NextResponse.json({ level: result.level });
  } catch {
    return NextResponse.json({ level: 'all_ages' }, { status: 500 });
  }
}
