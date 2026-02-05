/**
 * Tone classifier. Deterministic first; if not confident, call cheap LLM.
 * Output: { tone, confidence, reason_code, notes_short }. Recorded via recordPromptUse.
 */

import { NextResponse } from 'next/server';
import { detectToneDeterministic } from '../../../lib/actionability/tone';
import type { ToneGateResult, ToneResult } from '../../../lib/actionability/tone';
import { loadPublishedPrompt } from '../../../lib/prompts/store';
import { buildUserMessage } from '../../../lib/decisionEngine/judges/runJudge';
import { recordPromptUse } from '../../../lib/db/recordPromptUse';
import { getSiteLlmClientForTier } from '../../../lib/llm/router';

const TIMEOUT_MS = 6_000;
const MAX_TOKENS = 350;
const DETERMINISTIC_CONFIDENCE_THRESHOLD = 0.85;

const VALID_TONES: ToneResult[] = ['serious', 'playful', 'nonsense', 'unclear'];

function parseClassifyResponse(content: string): ToneGateResult | null {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const tone = parsed.tone;
    if (typeof tone !== 'string' || !VALID_TONES.includes(tone as ToneResult)) return null;
    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence) ? parsed.confidence : 0.5;
    const reason_code = typeof parsed.reason_code === 'string' ? parsed.reason_code : 'unknown';
    const notes_short = typeof parsed.notes_short === 'string' ? parsed.notes_short : undefined;
    return { tone: tone as ToneResult, confidence, reason_code, notes_short };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { intent?: string; intent_lang?: string; ui_locale?: string };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    const intent_lang = typeof body.intent_lang === 'string' ? body.intent_lang : 'en';
    const ui_locale = typeof body.ui_locale === 'string' ? body.ui_locale : 'en';

    if (!intent) {
      return NextResponse.json(
        { tone: 'unclear', confidence: 0, reason_code: 'empty', notes_short: 'Missing intent.' },
        { status: 400 },
      );
    }

    const deterministic = detectToneDeterministic(intent, intent_lang);
    if (deterministic && deterministic.confidence >= DETERMINISTIC_CONFIDENCE_THRESHOLD) {
      return NextResponse.json({
        tone: deterministic.tone,
        confidence: deterministic.confidence,
        reason_code: deterministic.reason_code,
        notes_short: deterministic.notes_short,
      });
    }

    const promptEntry = loadPublishedPrompt('tone_classifier_v1');
    if (!promptEntry?.user_template) {
      return NextResponse.json({
        tone: deterministic?.tone ?? 'serious',
        confidence: deterministic?.confidence ?? 0.5,
        reason_code: deterministic?.reason_code ?? 'unknown',
        notes_short: 'Prompt unavailable; default serious.',
      });
    }

    await recordPromptUse({
      prompt_name: 'tone_classifier_v1',
      version: '1.0.0',
      purpose_en: promptEntry.purpose_en,
      where_used: ['app/api/tone/classify/route.ts'],
      prompt_text: (promptEntry.system ?? '') + '\n' + promptEntry.user_template,
      input_schema: promptEntry.input_schema,
      output_schema: promptEntry.output_schema,
      token_budget_target: promptEntry.token_budget_target ?? 300,
      safety_notes_en: promptEntry.safety_notes_en,
    });

    const userContent = buildUserMessage(promptEntry.user_template, {
      intent: intent.replace(/"/g, '\\"'),
      intent_lang,
      ui_locale,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const siteClient = await getSiteLlmClientForTier('default');
      const res = await siteClient.client.chat.completions.create({
        model: siteClient.model,
        messages: [
          ...(promptEntry.system ? [{ role: 'system' as const, content: promptEntry.system }] : []),
          { role: 'user' as const, content: userContent },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.1,
      }, { signal: controller.signal });
      clearTimeout(timeoutId);
      const content = res.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return NextResponse.json({
          tone: deterministic?.tone ?? 'serious',
          confidence: deterministic?.confidence ?? 0.5,
          reason_code: deterministic?.reason_code ?? 'unknown',
          notes_short: 'Empty response; default serious.',
          ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'default' as const }),
        });
      }

      const parsed = parseClassifyResponse(content);
      if (parsed)
        return NextResponse.json({
          ...parsed,
          ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'default' as const }),
        });

      return NextResponse.json({
        tone: deterministic?.tone ?? 'serious',
        confidence: deterministic?.confidence ?? 0.5,
        reason_code: deterministic?.reason_code ?? 'unknown',
        notes_short: 'Parse failed; default serious.',
        ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'default' as const }),
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
        console.warn('[tone/classify]', err.message);
      }
      return NextResponse.json({
        tone: deterministic?.tone ?? 'serious',
        confidence: deterministic?.confidence ?? 0.5,
        reason_code: deterministic?.reason_code ?? 'unknown',
        notes_short: 'Request failed; default serious.',
        ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'default' as const }),
      });
    }
  } catch {
    return NextResponse.json(
      { tone: 'unclear', confidence: 0, reason_code: 'unknown', notes_short: 'Bad request.' },
      { status: 400 },
    );
  }
}
