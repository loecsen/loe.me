/**
 * Micro LLM endpoint for controllability check. Called only when heuristics return medium or low confidence.
 * Safety: run lexicon guard first; do not call LLM if intent is blocked.
 */

import { NextResponse } from 'next/server';
import {
  getControllabilityCheckSystem,
  buildControllabilityCheckUser,
  parseControllabilityCheckResponse,
} from '../../../lib/prompts/controllabilityCheck';
import { shouldSuggestRephraseSync } from '../../../lib/actionability/suggestion';
import { getLexiconGuard } from '../../../lib/safety/getLexiconGuard';
import { recordPromptUse } from '../../../lib/db/recordPromptUse';
import { getSiteLlmClientForTier } from '../../../lib/llm/router';

const CONTROLLABILITY_TIMEOUT_MS = 6_000;

export async function POST(request: Request) {
  let body: { intent?: string; timeframe_days?: number; locale?: string; category_hint?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      {
        level: 'medium',
        reason_code: 'unknown',
        confidence: 0,
        rewritten_intent: null,
        angles: [],
        tone: 'neutral',
      },
      { status: 400 },
    );
  }

  const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
  const timeframe_days =
    typeof body.timeframe_days === 'number' && Number.isFinite(body.timeframe_days) ? body.timeframe_days : undefined;
  const locale = typeof body.locale === 'string' ? body.locale : 'en';
  const category_hint = typeof body.category_hint === 'string' ? body.category_hint : undefined;

  if (!intent) {
    return NextResponse.json(
      {
        level: 'high',
        reason_code: 'unknown',
        confidence: 1,
        rewritten_intent: null,
        angles: [],
        tone: 'neutral',
      },
      { status: 400 },
    );
  }

  if (!shouldSuggestRephraseSync(intent)) {
    return NextResponse.json({
      level: 'high',
      reason_code: 'unknown',
      confidence: 1,
      rewritten_intent: null,
      angles: [],
      tone: 'neutral',
    });
  }

  const { guard } = await getLexiconGuard();
  const safetyVerdict = guard(intent);
  if (safetyVerdict.status === 'blocked') {
    return NextResponse.json({
      level: 'high',
      reason_code: 'unknown',
      confidence: 1,
      rewritten_intent: null,
      angles: [],
      tone: 'neutral',
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONTROLLABILITY_TIMEOUT_MS);

  const systemPrompt = getControllabilityCheckSystem();
  try {
    await recordPromptUse({
      prompt_name: 'controllability_check_v1',
      version: '1',
      purpose_en: 'Classify whether user intent depends on outcomes the user cannot fully control.',
      where_used: ['app/api/controllability/check/route.ts'],
      prompt_text: systemPrompt,
      input_schema: { intent: 'string', timeframe_days: 'number', locale: 'string', category_hint: 'string' },
      output_schema: { level: 'string', reason_code: 'string', confidence: 'number', rewritten_intent: 'string', angles: 'array' },
      token_budget_target: 320,
      safety_notes_en: 'Lexicon guard runs before LLM; no user intent in prompt seed.',
    });
    const siteClient = await getSiteLlmClientForTier('fast');
    const completion = await siteClient.client.chat.completions.create({
      model: siteClient.model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: buildControllabilityCheckUser(intent, timeframe_days, locale, category_hint),
        },
      ],
      max_tokens: 320,
      temperature: 0.1,
    }, { signal: controller.signal });
    clearTimeout(timeoutId);

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({
        level: 'medium',
        reason_code: 'unknown',
        confidence: 0.5,
        rewritten_intent: null,
        angles: [],
        tone: 'neutral',
        ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'fast' as const }),
      });
    }

    const parsed = parseControllabilityCheckResponse(content);
    if (!parsed) {
      return NextResponse.json({
        level: 'medium',
        reason_code: 'unknown',
        confidence: 0.5,
        rewritten_intent: null,
        angles: [],
        tone: 'neutral',
        ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'fast' as const }),
      });
    }

    return NextResponse.json({
      ...parsed,
      ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'fast' as const }),
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
      console.warn('[controllability/check]', err.message);
    }
    return NextResponse.json({
      level: 'medium',
      reason_code: 'unknown',
      confidence: 0.5,
      rewritten_intent: null,
      angles: [],
      tone: 'neutral',
    });
  }
}
