/**
 * Shared LLM client factory. Supports OpenAI and Qwen (OpenAI-compatible baseURL).
 * Used by dev playground and optionally by other routes; API key from env only.
 */

import OpenAI from 'openai';

export type LlmProvider = 'openai' | 'qwen';

export const QWEN_DEFAULT_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
export const QWEN_DEFAULT_MODEL = 'qwen-max-2025-01-25';

export type LlmConfig = {
  provider: LlmProvider;
  baseUrl: string | undefined;
  model: string | undefined;
};

export type NormalizedLlmOverrides = {
  provider: LlmProvider;
  model?: string;
  base_url?: string;
};

export type MergeLlmRunConfigBody = {
  provider?: 'openai' | 'qwen';
  model?: string;
  base_url?: string;
};

export type MergeLlmRunConfigDefaults = {
  provider?: 'openai' | 'qwen';
  model?: string;
  base_url?: string;
} | null;

/**
 * Merge request body with dev defaults. Per-run overrides are authoritative.
 * Empty string means "no override" (undefined). Never cross-apply base_url/model when provider differs.
 */
export function mergeLlmRunConfig(
  body: MergeLlmRunConfigBody,
  devDefaults: MergeLlmRunConfigDefaults,
): { provider: LlmProvider; model?: string; base_url?: string } {
  const provider: LlmProvider =
    (body.provider ?? devDefaults?.provider ?? 'openai') === 'qwen' ? 'qwen' : 'openai';

  const bodyProviderDefined = body.provider !== undefined;
  const providerDiffers = bodyProviderDefined && devDefaults?.provider != null && body.provider !== devDefaults.provider;

  let model: string | undefined;
  if (body.model !== undefined) {
    model = body.model.trim() === '' ? undefined : body.model.trim();
  } else if (providerDiffers) {
    model = undefined;
  } else {
    model = devDefaults?.model?.trim() === '' ? undefined : (devDefaults?.model?.trim() ?? undefined);
  }

  let base_url: string | undefined;
  if (body.base_url !== undefined) {
    base_url = body.base_url.trim() === '' ? undefined : body.base_url.trim();
  } else if (providerDiffers) {
    base_url = undefined;
  } else {
    base_url = devDefaults?.base_url?.trim() === '' ? undefined : (devDefaults?.base_url?.trim() ?? undefined);
  }

  return { provider, model, base_url };
}

/** Input may use base_url (snake_case) for API compatibility. */
export function normalizeLlmOverrides(input?: {
  provider?: LlmProvider;
  model?: string;
  base_url?: string;
  baseUrl?: string;
}): NormalizedLlmOverrides {
  const provider: LlmProvider =
    input?.provider === 'qwen' ? 'qwen' : (input?.provider === 'openai' ? 'openai' : 'openai');
  const rawBase = (input?.base_url ?? input?.baseUrl ?? '').trim();
  const rawModel = (input?.model ?? '').trim();

  if (provider === 'openai') {
    return {
      provider: 'openai',
      base_url: rawBase === '' ? undefined : rawBase,
      model: rawModel === '' ? undefined : rawModel,
    };
  }
  return {
    provider: 'qwen',
    base_url: rawBase === '' ? QWEN_DEFAULT_BASE_URL : rawBase,
    model: rawModel === '' ? QWEN_DEFAULT_MODEL : rawModel,
  };
}

/**
 * True if the resolved triplet is likely a mismatch (e.g. OpenAI provider with dashscope base_url, or Qwen with gpt-* model).
 * Used by UI and smoke to show warnings; no blocking.
 */
export function isSuspiciousLlmCombo(resolved: {
  provider: string;
  model?: string | null;
  base_url?: string | null;
}): boolean {
  const base = (resolved.base_url ?? '').toLowerCase();
  const model = (resolved.model ?? '').toLowerCase();
  if (resolved.provider === 'openai' && base.includes('dashscope')) return true;
  if (resolved.provider === 'qwen' && (model.startsWith('gpt-') || model.startsWith('o1') || /^o\d/.test(model)))
    return true;
  return false;
}

/** True if model string looks like an OpenAI model (gpt-*, o1, o*). */
function looksLikeOpenAiModel(model: string | undefined): boolean {
  if (!model || model.trim() === '') return false;
  const m = model.toLowerCase();
  return m.startsWith('gpt-') || m.startsWith('o1') || /^o\d/.test(m);
}

/** True if model string looks like a Qwen model (qwen-*). */
function looksLikeQwenModel(model: string | undefined): boolean {
  if (!model || model.trim() === '') return false;
  return model.toLowerCase().startsWith('qwen-');
}

/**
 * Resolve provider, baseUrl, model from overrides and provider-scoped env.
 * OpenAI never gets LLM_BASE_URL (only OPENAI_BASE_URL). Qwen uses QWEN_* then LLM_*.
 * If openai would get a dashscope baseUrl (e.g. from override), it is cleared unless OPENAI_BASE_URL explicitly contains dashscope.
 * If qwen would get a gpt-* model, it is overridden to QWEN_DEFAULT_MODEL.
 */
export function getLlmConfig(overrides?: {
  provider?: LlmProvider;
  baseUrl?: string;
  base_url?: string;
  model?: string;
}): LlmConfig {
  const effectiveProvider: LlmProvider =
    (overrides?.provider ?? (process.env.LLM_PROVIDER as LlmProvider) ?? 'openai') === 'qwen'
      ? 'qwen'
      : 'openai';

  const rawBase = (overrides?.base_url ?? overrides?.baseUrl ?? '').trim();
  const rawModel = (overrides?.model ?? '').trim();

  let baseUrl: string | undefined;
  let model: string | undefined;

  if (effectiveProvider === 'openai') {
    baseUrl =
      rawBase !== ''
        ? rawBase
        : (process.env.OPENAI_BASE_URL ?? '').trim() || undefined;
    // OpenAI: only OPENAI_* env; never LLM_CHAT_MODEL (avoids using Qwen model when OPENAI_CHAT_MODEL is unset)
    model =
      rawModel !== ''
        ? rawModel
        : (process.env.OPENAI_CHAT_MODEL ?? '').trim() || undefined;
    if (baseUrl?.toLowerCase().includes('dashscope')) {
      const openaiBase = (process.env.OPENAI_BASE_URL ?? '').toLowerCase();
      if (!openaiBase.includes('dashscope')) baseUrl = undefined;
    }
    if (looksLikeQwenModel(model)) model = undefined;
  } else {
    baseUrl =
      rawBase !== ''
        ? rawBase
        : (process.env.QWEN_BASE_URL ?? '').trim() ||
          (process.env.LLM_BASE_URL ?? '').trim() ||
          QWEN_DEFAULT_BASE_URL;
    model =
      rawModel !== ''
        ? rawModel
        : (process.env.QWEN_CHAT_MODEL ?? '').trim() ||
          (process.env.LLM_CHAT_MODEL ?? '').trim() ||
          QWEN_DEFAULT_MODEL;
    if (looksLikeOpenAiModel(model)) model = QWEN_DEFAULT_MODEL;
  }

  return { provider: effectiveProvider, baseUrl, model };
}

/**
 * Return OpenAI client and resolved config. API key is provider-scoped:
 * openai => OPENAI_API_KEY; qwen => QWEN_API_KEY ?? LLM_API_KEY.
 * Prefer normalizeLlmOverrides() before calling when using request/UI input.
 * @throws Error if API key is missing for the chosen provider
 */
export function getLlmClient(overrides?: {
  provider?: LlmProvider;
  baseUrl?: string;
  base_url?: string;
  model?: string;
}): {
  client: OpenAI;
  provider: LlmProvider;
  baseUrl: string | undefined;
  model: string | undefined;
} {
  const { provider, baseUrl, model } = getLlmConfig(overrides);

  const apiKey =
    provider === 'qwen'
      ? (process.env.QWEN_API_KEY ?? process.env.LLM_API_KEY ?? '').trim()
      : (process.env.OPENAI_API_KEY ?? '').trim();

  if (!apiKey) {
    throw new Error(
      provider === 'qwen'
        ? 'Qwen API key not configured. Set QWEN_API_KEY or LLM_API_KEY.'
        : 'OpenAI API key not configured. Set OPENAI_API_KEY in the environment.',
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
  });

  return { client, provider, baseUrl, model };
}
