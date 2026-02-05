import { NextResponse } from 'next/server';
import {
  getActionabilityClassifierSystem,
  buildActionabilityClassifierUser,
  parseClassifierResponse,
} from '../../../lib/prompts/actionabilityClassifier';
import type { DisplayLang } from '../../../lib/actionability';
import { inferCategoryFromIntent } from '../../../lib/actionability';
import { shouldSuggestRephraseSync, isSafeRephrase } from '../../../lib/actionability/suggestion';
import { getLexiconGuard } from '../../../lib/safety/getLexiconGuard';
import { runSoftRealism } from '../../../lib/actionability/realism';
import { categoryRequiresFeasibility } from '../../../lib/category';
import { getLexiconForIntent } from '../../../lib/lexicon/registry';
import { recordPromptUse } from '../../../lib/db/recordPromptUse';
import { getSiteLlmClientForTier } from '../../../lib/llm/router';
import { redactForLlm } from '../../../lib/privacy/redact';

const CLASSIFIER_TIMEOUT_MS = 8_000;

const DISPLAY_LANGS: DisplayLang[] = ['en', 'fr', 'es', 'de', 'it', 'zh', 'ja', 'ko', 'ru'];
function toDisplayLang(v: unknown, uiFallback: string): DisplayLang {
  const s = typeof v === 'string' ? v.toLowerCase().split('-')[0] : '';
  if (DISPLAY_LANGS.includes(s as DisplayLang)) return s as DisplayLang;
  const fromUi = (uiFallback ?? '').toLowerCase().split('-')[0];
  return DISPLAY_LANGS.includes(fromUi as DisplayLang) ? (fromUi as DisplayLang) : 'en';
}

export async function POST(request: Request) {
  let body: { intent?: string; timeframe_days?: number; display_lang?: string; ui_locale?: string };
  try {
    body = (await request.json()) as { intent?: string; timeframe_days?: number; display_lang?: string; ui_locale?: string };
  } catch {
    return NextResponse.json(
      { verdict: 'NEEDS_REPHRASE_INLINE', reason_code: 'classifier_error', normalized_intent: '', suggested_rephrase: null, confidence: 0, category: null },
      { status: 400 },
    );
  }

  const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
  const timeframe_days = typeof body.timeframe_days === 'number' && Number.isFinite(body.timeframe_days)
    ? body.timeframe_days
    : undefined;
  // display_lang = intentLang (inferred from intent + uiLocale). Do NOT force English; follow uiLocale when intent empty.
  const ui_locale = typeof body.ui_locale === 'string' ? body.ui_locale.trim() || 'en' : 'en';
  const displayLang = toDisplayLang(body.display_lang ?? '', ui_locale);

  if (!intent) {
    return NextResponse.json(
      { verdict: 'NEEDS_REPHRASE_INLINE', reason_code: 'too_vague', normalized_intent: '', suggested_rephrase: null, confidence: 0, category: null },
      { status: 400 },
    );
  }

  // Blocage confidentialité par défaut (désactiver avec LLM_PRIVACY_STRICT=0)
  if (process.env.LLM_PRIVACY_STRICT !== '0') {
    const redacted = redactForLlm(intent, { maxChars: 280 });
    if (redacted.risk === 'high' || redacted.risk === 'medium') {
      return NextResponse.json({
        verdict: 'BLOCKED',
        reason_code: 'privacy_blocked',
        privacy_blocked: true,
        error_key: 'privacyUserMessage',
        normalized_intent: '',
        suggested_rephrase: null,
        confidence: 0,
        category: null,
      });
    }
  }

  if (!shouldSuggestRephraseSync(intent)) {
    return NextResponse.json({
      verdict: 'BLOCKED',
      reason_code: 'safety_no_suggestion',
      normalized_intent: '',
      suggested_rephrase: null,
      confidence: 0,
      category: null,
    });
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const { pack, source: lexicon_source, packLang: lexicon_lang } = await getLexiconForIntent(intent, ui_locale, { allowDraft: isDev });
  const lexiconTokens = pack?.tokens ?? null;

  const { guard } = await getLexiconGuard();
  const safetyVerdict = guard(intent);
  if (safetyVerdict.status === 'blocked') {
    return NextResponse.json({
      verdict: 'BLOCKED',
      reason_code: 'blocked',
      normalized_intent: '',
      suggested_rephrase: null,
      confidence: 0,
      category: null,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS);

  const systemPrompt = getActionabilityClassifierSystem();
  const LLM_TIER = 'default' as const;
  let llmMeta: { llm_provider: string; llm_model: string; llm_base_url: string; llm_source: string; llm_tier: string; latency_ms: number } | undefined;
  try {
    await recordPromptUse({
      prompt_name: 'actionability_classifier_v1',
      version: '1',
      purpose_en: 'Strict classifier for whether user intent can become a day-by-day micro-ritual plan.',
      where_used: ['app/api/actionability/classify/route.ts'],
      prompt_text: systemPrompt,
      input_schema: { intent: 'string', timeframe_days: 'number', display_lang: 'string' },
      output_schema: { verdict: 'string', reason_code: 'string', normalized_intent: 'string', category: 'string', suggested_rephrase: 'string' },
      token_budget_target: 256,
      safety_notes_en: 'No user intent in prompt seed; lexicon guard runs before LLM.',
    });
    const siteClient = await getSiteLlmClientForTier('default');
    const start = Date.now();
    const completion = await siteClient.client.chat.completions.create({
      model: siteClient.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildActionabilityClassifierUser(intent, timeframe_days, displayLang) },
      ],
      max_tokens: 256,
      temperature: 0.1,
    }, { signal: controller.signal });
    clearTimeout(timeoutId);
    const latency_ms = Date.now() - start;
    if (process.env.DEBUG === '1' || process.env.NODE_ENV !== 'production') {
      llmMeta = {
        llm_provider: siteClient.provider,
        llm_model: siteClient.model,
        llm_base_url: siteClient.baseUrl ?? 'default',
        llm_source: siteClient.source,
        llm_tier: LLM_TIER,
        latency_ms,
      };
    }

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({
        verdict: 'NEEDS_REPHRASE_INLINE',
        reason_code: 'classifier_error',
        normalized_intent: intent,
        suggested_rephrase: null,
        confidence: 0,
        category: null,
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
        category: null,
      });
    }

    const normalizedGuard = guard(parsed.normalized_intent);
    if (normalizedGuard.status === 'blocked') {
      return NextResponse.json({
        verdict: 'BLOCKED',
        reason_code: 'blocked',
        normalized_intent: '',
        suggested_rephrase: null,
        confidence: 0,
        category: parsed.category,
      });
    }

    const rephraseGuard =
      parsed.suggested_rephrase != null && parsed.suggested_rephrase.trim() !== ''
        ? guard(parsed.suggested_rephrase)
        : { status: 'ok' as const };
    if (rephraseGuard.status === 'blocked') {
      return NextResponse.json({
        ...parsed,
        suggested_rephrase: null,
        reason_code: 'safety_no_suggestion',
      });
    }

    const suggested_rephrase =
      parsed.suggested_rephrase != null && parsed.suggested_rephrase.trim() !== '' && isSafeRephrase(parsed.suggested_rephrase)
        ? parsed.suggested_rephrase.trim()
        : null;

    const intentForRealism = (parsed.normalized_intent ?? intent).trim();
    const timeframe = typeof timeframe_days === 'number' && Number.isFinite(timeframe_days) ? timeframe_days : 14;
    const realism =
      parsed.verdict === 'ACTIONABLE' && categoryRequiresFeasibility(parsed.category as import('../../../lib/category').Category)
        ? runSoftRealism(intentForRealism, timeframe, parsed.category, displayLang)
        : { level: 'ok' as const, adjustments: [] };

    const reasonCode =
      suggested_rephrase === null &&
      parsed.suggested_rephrase != null &&
      parsed.suggested_rephrase.trim() !== ''
        ? ('safety_no_suggestion' as const)
        : parsed.reason_code;

    const category = parsed.category ?? inferCategoryFromIntent(intent, lexiconTokens) ?? null;
    const includeLexiconMeta = process.env.DEBUG === '1' || process.env.NODE_ENV !== 'production';

    return NextResponse.json({
      ...parsed,
      reason_code: reasonCode,
      suggested_rephrase,
      category,
      realism: realism.level,
      realism_why_short: realism.why_short,
      realism_adjustments: realism.adjustments,
      ...(includeLexiconMeta ? { lexicon_source, lexicon_lang } : {}),
      ...(llmMeta ? { llm_provider: llmMeta.llm_provider, llm_model: llmMeta.llm_model, llm_base_url: llmMeta.llm_base_url, llm_source: llmMeta.llm_source, llm_tier: llmMeta.llm_tier, latency_ms: llmMeta.latency_ms } : {}),
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
      category: null,
    });
  }
}
