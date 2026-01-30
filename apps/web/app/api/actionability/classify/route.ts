import { NextResponse } from 'next/server';
import {
  ACTIONABILITY_CLASSIFIER_SYSTEM,
  buildActionabilityClassifierUser,
  parseClassifierResponse,
} from '../../../lib/prompts/actionabilityClassifier';
import type { DisplayLang } from '../../../lib/actionability';
import { shouldSuggestRephraseSync, buildSuggestionFromTemplate } from '../../../lib/actionability/suggestion';
import { getLexiconGuard } from '../../../lib/safety/getLexiconGuard';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const CLASSIFIER_TIMEOUT_MS = 8_000;

const DISPLAY_LANGS: DisplayLang[] = ['en', 'fr', 'es', 'de', 'it', 'zh', 'ja', 'ko', 'ru'];
function toDisplayLang(v: unknown, uiFallback: string): DisplayLang {
  const s = typeof v === 'string' ? v.toLowerCase().split('-')[0] : '';
  if (DISPLAY_LANGS.includes(s as DisplayLang)) return s as DisplayLang;
  const fromUi = (uiFallback ?? '').toLowerCase().split('-')[0];
  return DISPLAY_LANGS.includes(fromUi as DisplayLang) ? (fromUi as DisplayLang) : 'en';
}

export async function POST(request: Request) {
  let body: { intent?: string; timeframe_days?: number; display_lang?: string };
  try {
    body = (await request.json()) as { intent?: string; timeframe_days?: number; display_lang?: string };
  } catch {
    return NextResponse.json(
      { verdict: 'NEEDS_REPHRASE_INLINE', reason_code: 'classifier_error', normalized_intent: '', suggested_rephrase: null, confidence: 0 },
      { status: 400 },
    );
  }

  const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
  const timeframe_days = typeof body.timeframe_days === 'number' && Number.isFinite(body.timeframe_days)
    ? body.timeframe_days
    : undefined;
  const displayLang = toDisplayLang(body.display_lang ?? '', 'en');

  if (!intent) {
    return NextResponse.json(
      { verdict: 'NEEDS_REPHRASE_INLINE', reason_code: 'too_vague', normalized_intent: '', suggested_rephrase: null, confidence: 0 },
      { status: 400 },
    );
  }

  if (!shouldSuggestRephraseSync(intent)) {
    return NextResponse.json({
      verdict: 'NEEDS_REPHRASE_INLINE',
      reason_code: 'safety_no_suggestion',
      normalized_intent: '',
      suggested_rephrase: null,
      confidence: 0,
    });
  }

  const { guard } = await getLexiconGuard();
  const safetyVerdict = guard(intent);
  if (safetyVerdict.status === 'blocked') {
    return NextResponse.json({
      verdict: 'NEEDS_REPHRASE_INLINE',
      reason_code: 'safety_no_suggestion',
      normalized_intent: '',
      suggested_rephrase: null,
      confidence: 0,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  if (!apiKey) {
    return NextResponse.json({
      verdict: 'NEEDS_REPHRASE_INLINE',
      reason_code: 'classifier_error',
      normalized_intent: intent,
      suggested_rephrase: null,
      confidence: 0,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: ACTIONABILITY_CLASSIFIER_SYSTEM },
          { role: 'user', content: buildActionabilityClassifierUser(intent, timeframe_days, displayLang) },
        ],
        max_tokens: 256,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[actionability/classify] OpenAI error', res.status, errText.slice(0, 200));
      }
      return NextResponse.json({
        verdict: 'NEEDS_REPHRASE_INLINE',
        reason_code: 'classifier_error',
        normalized_intent: intent,
        suggested_rephrase: null,
        confidence: 0,
      });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({
        verdict: 'NEEDS_REPHRASE_INLINE',
        reason_code: 'classifier_error',
        normalized_intent: intent,
        suggested_rephrase: null,
        confidence: 0,
      });
    }

    const parsed = parseClassifierResponse(content);
    if (!parsed) {
      return NextResponse.json({
        verdict: 'NEEDS_REPHRASE_INLINE',
        reason_code: 'classifier_error',
        normalized_intent: intent,
        suggested_rephrase: null,
        confidence: 0,
      });
    }

    const suggested_rephrase = buildSuggestionFromTemplate(displayLang, parsed.normalized_intent);
    return NextResponse.json({
      ...parsed,
      suggested_rephrase: suggested_rephrase ?? parsed.suggested_rephrase,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
      console.warn('[actionability/classify]', err.message);
    }
    return NextResponse.json({
      verdict: 'NEEDS_REPHRASE_INLINE',
      reason_code: 'classifier_error',
      normalized_intent: intent,
      suggested_rephrase: null,
      confidence: 0,
    });
  }
}
