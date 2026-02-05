/**
 * Judge API: equivalence. Dev-only.
 * Decides if two intents are the same request (for cache reuse). Used when similarity in [0.70, 0.90].
 */

import { NextResponse } from 'next/server';
import { runEquivalenceJudge } from '../../../lib/decisionEngine/judges/equivalence';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { intent_a?: string; intent_b?: string };
    const intent_a = typeof body.intent_a === 'string' ? body.intent_a.trim() : '';
    const intent_b = typeof body.intent_b === 'string' ? body.intent_b.trim() : '';

    if (!intent_a || !intent_b) {
      return NextResponse.json({ error: 'intent_a and intent_b required' }, { status: 400 });
    }

    const result = await runEquivalenceJudge(intent_a, intent_b);
    if (result === null) {
      return NextResponse.json(
        { error: 'Judge unavailable or parse failed', same_request: false, confidence: 0, reason_en: '' },
        { status: 200 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
