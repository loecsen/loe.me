/**
 * Judge API: tone / aspiration. Dev-only. tone + requires_confirmation.
 */

import { NextResponse } from 'next/server';
import { runToneAspirationJudge } from '../../../lib/decisionEngine/judges/tone';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { intent?: string };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    if (!intent) {
      return NextResponse.json({ error: 'intent required' }, { status: 400 });
    }
    const result = await runToneAspirationJudge(intent);
    if (result === null) {
      return NextResponse.json({ error: 'Judge unavailable or parse failed' }, { status: 200 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
