/**
 * Dev-only LLM router: site default from dev settings or env, with optional per-call overrides.
 * Single entry point for all server LLM usage. No secrets on disk.
 * All chat completions should go through callChat() so user input is redacted.
 */

import { readDevLlmSettings } from '../db/llmSettings.file';
import { translations, defaultLocale } from '../i18n';
import { redactForLlm, type RedactRisk } from '../privacy/redact';
import {
  getLlmConfig,
  getLlmClient,
  normalizeLlmOverrides,
  type LlmProvider,
  QWEN_DEFAULT_BASE_URL,
  QWEN_DEFAULT_MODEL,
} from './client';

export type { LlmProvider };

const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

export type LlmResolvedConfig = {
  provider: LlmProvider;
  model: string;
  baseUrl: string | null;
  source: 'dev_settings' | 'env' | 'override';
};

function toResolved(
  config: { provider: LlmProvider; baseUrl: string | undefined; model: string | undefined },
  source: LlmResolvedConfig['source'],
): LlmResolvedConfig {
  const model =
    config.model?.trim() ||
    (config.provider === 'qwen' ? QWEN_DEFAULT_MODEL : (process.env.OPENAI_CHAT_MODEL ?? '').trim() || OPENAI_DEFAULT_MODEL);
  return {
    provider: config.provider,
    model,
    baseUrl: config.baseUrl ?? null,
    source,
  };
}

/**
 * Resolve the current SITE default LLM config.
 * In dev: routing.default (tier) wins if set, else top-level provider/model/base_url, then env.
 * So "site LLM" matches what getSiteLlmClientForTier('default') uses.
 */
export async function getSiteLlmConfig(): Promise<LlmResolvedConfig> {
  if (process.env.NODE_ENV !== 'production') {
    const dev = await readDevLlmSettings();
    const tierDefault = dev?.routing?.default;
    const hasTierDefault =
      tierDefault &&
      (tierDefault.provider != null ||
        (tierDefault.model != null && tierDefault.model.trim() !== '') ||
        (tierDefault.base_url != null && tierDefault.base_url.trim() !== ''));
    if (hasTierDefault) {
      const normalized = normalizeLlmOverrides({
        provider: tierDefault!.provider,
        model: tierDefault!.model?.trim() ?? '',
        base_url: tierDefault!.base_url?.trim() ?? '',
      });
      const config = getLlmConfig({
        provider: normalized.provider,
        model: normalized.model,
        base_url: normalized.base_url,
      });
      return toResolved(config, 'dev_settings');
    }
    if (dev?.provider) {
      const normalized = normalizeLlmOverrides({
        provider: dev.provider,
        model: dev.model ?? '',
        base_url: dev.base_url ?? '',
      });
      const config = getLlmConfig({
        provider: normalized.provider,
        model: normalized.model,
        base_url: normalized.base_url,
      });
      return toResolved(config, 'dev_settings');
    }
  }

  const config = getLlmConfig(undefined);
  return toResolved(config, 'env');
}

/**
 * Apply per-call overrides (e.g. run-prompt A/B) on top of base config.
 * When input provides provider/model/base_url, returns config with source "override".
 * If the chosen provider differs from base (e.g. override openai but site default is qwen),
 * do NOT use base.model or base.baseUrl — use undefined so getLlmConfig applies the
 * selected provider's env/defaults (avoids sending qwen model to OpenAI).
 */
export function resolveOverrideConfig(
  input: {
    provider?: LlmProvider;
    model?: string;
    base_url?: string;
    baseUrl?: string;
  },
  base: LlmResolvedConfig,
): LlmResolvedConfig {
  const hasOverride =
    input.provider !== undefined ||
    input.model !== undefined ||
    input.base_url !== undefined ||
    input.baseUrl !== undefined;
  if (!hasOverride) return base;

  const effectiveProvider: LlmProvider = (input.provider ?? base.provider) === 'qwen' ? 'qwen' : 'openai';
  const providerDiffers = effectiveProvider !== base.provider;

  const model =
    input.model !== undefined && input.model.trim() !== ''
      ? input.model.trim()
      : providerDiffers
        ? undefined
        : (input.model ?? base.model);
  const baseUrlInput = (input.base_url ?? input.baseUrl ?? '').trim();
  const base_url =
    baseUrlInput !== ''
      ? baseUrlInput
      : providerDiffers
        ? undefined
        : (input.base_url !== undefined || input.baseUrl !== undefined ? undefined : base.baseUrl ?? undefined);

  const normalized = normalizeLlmOverrides({
    provider: effectiveProvider,
    model: model ?? '',
    base_url: base_url ?? '',
  });
  const config = getLlmConfig({
    provider: normalized.provider,
    model: normalized.model,
    base_url: normalized.base_url,
  });
  return toResolved(config, 'override');
}

/**
 * Get OpenAI client and resolved config for the site (or with overrides for A/B runs).
 * Use this in all API routes that call the LLM.
 */
export async function getSiteLlmClient(overrides?: {
  provider?: LlmProvider;
  model?: string;
  base_url?: string;
  baseUrl?: string;
}): Promise<{
  client: Awaited<ReturnType<typeof getLlmClient>>['client'];
  provider: LlmProvider;
  model: string;
  baseUrl: string | null;
  source: string;
}> {
  const base = await getSiteLlmConfig();
  const resolved = overrides ? resolveOverrideConfig(overrides, base) : base;
  const { client, provider, baseUrl, model } = getLlmClient({
    provider: resolved.provider,
    model: resolved.model,
    base_url: resolved.baseUrl ?? undefined,
  });
  const finalModel = model?.trim() || (provider === 'qwen' ? QWEN_DEFAULT_MODEL : OPENAI_DEFAULT_MODEL);
  return {
    client,
    provider,
    model: finalModel,
    baseUrl: baseUrl ?? null,
    source: resolved.source,
  };
}

export type LlmTier = 'default' | 'reasoning' | 'fast';

/**
 * Get client for a usage tier (default = light tasks, reasoning = heavy).
 * In dev: uses routing.default / routing.reasoning from llm_settings.json if set; else site default.
 * In prod: uses site default until env-based tier config exists.
 */
export async function getSiteLlmClientForTier(tier: LlmTier): Promise<{
  client: Awaited<ReturnType<typeof getLlmClient>>['client'];
  provider: LlmProvider;
  model: string;
  baseUrl: string | null;
  source: string;
}> {
  const dev = await readDevLlmSettings();
  const tierConfig = dev?.routing?.[tier];
  const hasTierOverride =
    tierConfig &&
    (tierConfig.provider != null || (tierConfig.model != null && tierConfig.model.trim() !== '') || (tierConfig.base_url != null && tierConfig.base_url.trim() !== ''));
  const overrides = hasTierOverride
    ? {
        provider: tierConfig!.provider,
        model: tierConfig!.model?.trim() || undefined,
        base_url: tierConfig!.base_url?.trim() || undefined,
      }
    : undefined;
  return getSiteLlmClient(overrides);
}

export type CallChatOptions = {
  tier?: LlmTier;
  provider?: LlmProvider;
  model?: string;
  base_url?: string;
  system?: string;
  prompt?: string;
  userInput: string;
  responseFormat?: 'text' | 'json';
  maxTokens?: number;
};

export type CallChatResult = {
  ok: boolean;
  output_text?: string;
  output_json?: unknown;
  llm: { provider: string; model: string; base_url: string | null; source?: string };
  privacy: { risk: RedactRisk; hits: Record<string, number>; truncated: boolean };
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  latency_ms?: number;
  _debug?: { gate: string; outcome: RedactRisk; meta: Record<string, number> };
};

/**
 * Run a chat completion with privacy redaction applied to user input.
 * Blocks when risk is medium/high by default (set LLM_PRIVACY_STRICT=0 to disable).
 */
export async function callChat(opts: CallChatOptions): Promise<CallChatResult> {
  const { userInput, responseFormat = 'text', maxTokens = 500 } = opts;
  const system = (opts.system ?? opts.prompt ?? '').trim();

  const redacted = redactForLlm(userInput, { maxChars: 280 });
  if (process.env.LLM_PRIVACY_STRICT !== '0' && (redacted.risk === 'high' || redacted.risk === 'medium')) {
    const msg = (translations[defaultLocale] as { privacyUserMessage?: string }).privacyUserMessage;
    throw new Error(msg ?? 'Please do not share confidential information.');
  }

  if (process.env.DEBUG === '1' || process.env.NODE_ENV !== 'production') {
    console.warn('[privacy_redaction]', {
      gate: 'privacy_redaction',
      outcome: redacted.risk,
      meta: redacted.hits,
    });
  }

  const hasOverrides =
    opts.provider !== undefined ||
    (opts.model !== undefined && opts.model.trim() !== '') ||
    (opts.base_url !== undefined && opts.base_url.trim() !== '');
  const siteClient = hasOverrides
    ? await getSiteLlmClient({
        provider: opts.provider,
        model: opts.model?.trim(),
        base_url: opts.base_url?.trim(),
      })
    : await getSiteLlmClientForTier(opts.tier ?? 'default');

  const userContent =
    responseFormat === 'json' ? `${redacted.redacted}\n\nReturn valid JSON only.` : redacted.redacted;

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: userContent });

  const start = Date.now();
  const model = siteClient.model;
  const completion = await siteClient.client.chat.completions.create({
    model,
    messages,
    max_completion_tokens: maxTokens,
    ...(model.toLowerCase().startsWith('gpt-5') ? {} : { temperature: 0.2 }),
  });
  const latency_ms = Date.now() - start;

  const content = completion.choices?.[0]?.message?.content?.trim() ?? '';
  const usage = completion.usage
    ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens,
      }
    : undefined;

  let output_json: unknown = undefined;
  if (responseFormat === 'json' && content) {
    try {
      const stripped = content.replace(/^[\s\S]*?\{/, '{').replace(/\}[\s\S]*$/, '}');
      output_json = JSON.parse(stripped);
    } catch {
      // leave output_json undefined
    }
  }

  const debug =
    process.env.DEBUG === '1' || process.env.NODE_ENV !== 'production'
      ? { gate: 'privacy_redaction' as const, outcome: redacted.risk as RedactRisk, meta: redacted.hits }
      : undefined;

  return {
    ok: true,
    output_text: content,
    output_json,
    llm: {
      provider: siteClient.provider,
      model: siteClient.model,
      base_url: siteClient.baseUrl,
      source: siteClient.source,
    },
    privacy: {
      risk: redacted.risk,
      hits: redacted.hits,
      truncated: redacted.truncated,
    },
    usage,
    latency_ms,
    ...(debug && { _debug: debug }),
  };
}
