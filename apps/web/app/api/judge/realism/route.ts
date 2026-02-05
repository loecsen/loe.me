/**
 * Judge API: realism. Dev-only. ok | stretch | unrealistic + adjustments.
 */

import { NextResponse } from 'next/server';
import { runRealismJudge } from '../../../lib/decisionEngine/judges/realism';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { intent?: string; days?: number; ui_locale?: string };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    const days = typeof body.days === 'number' && Number.isFinite(body.days) ? body.days : 14;
    const ui_locale = typeof body.ui_locale === 'string' ? body.ui_locale : 'en';
    if (!intent) {
      return NextResponse.json({ error: 'intent required' }, { status: 400 });
    }
    const result = await runRealismJudge(intent, days, ui_locale);
    if (result === null) {
      return NextResponse.json({ error: 'Judge unavailable or parse failed' }, { status: 200 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
