/**
 * Dev-only generic LLM runner. Compare OpenAI vs Qwen. 403 in prod.
 * Uses callChat() so user input is redacted; returns resolved triplet + privacy info.
 */

import { NextResponse } from 'next/server';
import { redactForLlm, PRIVACY_MESSAGE_KEY } from '../../../../lib/privacy/redact';
import { translations, defaultLocale } from '../../../../lib/i18n';
import { readDevLlmSettings } from '../../../../lib/db/llmSettings.file';
import { callChat, getSiteLlmConfig } from '../../../../lib/llm/router';
import { mergeLlmRunConfig, normalizeLlmOverrides, isSuspiciousLlmCombo } from '../../../../lib/llm/client';
import { computeCostUsd, resolvePricing } from '../../../../lib/llm/pricing';

type RunPromptBody = {
  provider?: 'openai' | 'qwen';
  model?: string;
  base_url?: string;
  prompt_text: string;
  input: string;
  response_format?: 'text' | 'json';
};

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: RunPromptBody;
  try {
    body = (await request.json()) as RunPromptBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.prompt_text !== 'string' || typeof body.input !== 'string') {
    return NextResponse.json(
      { error: 'prompt_text and input are required strings' },
      { status: 400 },
    );
  }

  // Blocage confidentialité par défaut (désactiver avec LLM_PRIVACY_STRICT=0)
  if (process.env.LLM_PRIVACY_STRICT !== '0') {
    const redacted = redactForLlm(body.input, { maxChars: 280 });
    if (redacted.risk === 'high' || redacted.risk === 'medium') {
      const defaultMessage = (translations[defaultLocale] as { privacyUserMessage?: string }).privacyUserMessage;
      return NextResponse.json(
        {
          ok: false,
          error: defaultMessage,
          error_key: PRIVACY_MESSAGE_KEY,
          privacy_blocked: true,
          privacy: { risk: redacted.risk, hits: redacted.hits, truncated: redacted.truncated },
        },
        { status: 400 },
      );
    }
  }

  const devSettings = await readDevLlmSettings();
  const merged = mergeLlmRunConfig(
    {
      provider: body.provider,
      model: body.model,
      base_url: body.base_url,
    },
    devSettings,
  );
  const normalized = normalizeLlmOverrides(merged);

  let result: Awaited<ReturnType<typeof callChat>>;
  try {
    result = await callChat({
      provider: normalized.provider,
      model: normalized.model,
      base_url: normalized.base_url,
      system: body.prompt_text,
      userInput: body.input,
      responseFormat: body.response_format ?? 'text',
      maxTokens: 500,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isPrivacyBlock = message.includes('Privacy') || message.includes('confidential');
    let llmTriplet: { provider: string; model: string; base_url: string | null; source: string } | null = null;
    try {
      const base = await getSiteLlmConfig();
      llmTriplet = { provider: base.provider, model: base.model, base_url: base.baseUrl, source: base.source };
    } catch {
      // ignore
    }
    const defaultMsg = (translations[defaultLocale] as { privacyUserMessage?: string }).privacyUserMessage;
    return NextResponse.json(
      {
        ok: false,
        error: isPrivacyBlock ? defaultMsg : message,
        error_key: isPrivacyBlock ? PRIVACY_MESSAGE_KEY : undefined,
        llm: llmTriplet,
        privacy_blocked: isPrivacyBlock,
      },
      { status: isPrivacyBlock ? 400 : 503 },
    );
  }

  const llmTriplet = {
    provider: result.llm.provider,
    model: result.llm.model,
    base_url: result.llm.base_url,
    source: result.llm.source ?? 'override',
  };
  const suspicious = isSuspiciousLlmCombo(llmTriplet);
  const pricing = resolvePricing(
    result.llm.provider,
    result.llm.model,
    devSettings?.pricing ?? null,
  );
  const cost = computeCostUsd(result.usage, pricing);

  return NextResponse.json({
    ok: true,
    llm: llmTriplet,
    suspicious,
    latency_ms: result.latency_ms,
    output_text: result.output_text ?? '',
    output_json: result.output_json,
    usage: result.usage,
    cost,
    privacy: result.privacy,
    ...(result._debug && { _debug: result._debug }),
  });
}
