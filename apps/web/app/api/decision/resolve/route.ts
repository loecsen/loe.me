/**
 * Decision Engine V2 — resolve intent to outcome.
 * Always available; Home uses V2 by default (legacy only as fallback when V2 fails or returns no renderable outcome).
 */

import { NextResponse } from 'next/server';
import { redactForLlm } from '../../../lib/privacy/redact';
import { runDecisionEngine } from '../../../lib/decisionEngine/engine';
import { GateCopy } from '../../../lib/gates/copy';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const intent = typeof body?.intent === 'string' ? body.intent.trim() : '';
    const days = typeof body?.days === 'number' && Number.isFinite(body.days) ? body.days : 14;
    const ui_locale = typeof body?.ui_locale === 'string' ? body.ui_locale : 'en';
    const force_proceed = body?.force_proceed === true;

    if (!intent) {
      return NextResponse.json({ error: 'intent required' }, { status: 400 });
    }

    // Blocage confidentialité par défaut (désactiver avec LLM_PRIVACY_STRICT=0)
    if (process.env.LLM_PRIVACY_STRICT !== '0') {
      const redacted = redactForLlm(intent, { maxChars: 280 });
      if (redacted.risk === 'high' || redacted.risk === 'medium') {
        return NextResponse.json({
          outcome: 'BLOCKED_SAFETY',
          payload: { privacy_blocked: true, error_key: 'privacyUserMessage' },
          debug: { branch: 'privacy_blocked' },
        });
      }
    }

    const gateCopy: Parameters<typeof runDecisionEngine>[1] = {
      controllabilitySupportTitle: GateCopy.controllabilitySupportTitle,
      controllabilitySupportBody: GateCopy.controllabilitySupportBody,
      safetyBlockedMessage: GateCopy.safetyBlockedMessage,
    };
    const result = await runDecisionEngine(
      { intent, days, ui_locale, force_proceed },
      gateCopy,
      { collectPromptTrace: true },
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
