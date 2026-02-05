export type LlmUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type LlmPricing = {
  input_per_1k: number;
  output_per_1k: number;
  currency: 'usd';
  source: 'env' | 'code' | 'dev_settings';
};

export type LlmCostBreakdown = {
  currency: 'usd';
  input_tokens: number;
  output_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
  total_cost_usd: number;
  input_rate_per_1k: number;
  output_rate_per_1k: number;
  source: 'env' | 'code' | 'dev_settings';
};

type PricingEntry = {
  input_per_1k: number;
  output_per_1k: number;
};

const DEFAULT_PRICING: Record<string, PricingEntry> = {
  // Official grid (USD per 1k tokens) as of 2026-02-03.
  // OpenAI:
  'openai:gpt-4o': { input_per_1k: 0.0025, output_per_1k: 0.01 },
  'openai:gpt-4o-mini': { input_per_1k: 0.00015, output_per_1k: 0.0006 },
  'openai:gpt-5.2': { input_per_1k: 0.004, output_per_1k: 0.012 },
  // Qwen:
  'qwen:qwen-max-2025-01-25': { input_per_1k: 0.0028, output_per_1k: 0.0084 },
  'qwen:qwen-plus': { input_per_1k: 0.00012, output_per_1k: 0.00036 },
  'qwen:qwen-turbo': { input_per_1k: 0.00004, output_per_1k: 0.00012 },
};

function normalizeKey(provider: string, model: string): string {
  return `${provider}:${model}`.toLowerCase();
}

function parsePricingFromEnv(): Record<string, PricingEntry> | null {
  const raw = (process.env.LLM_PRICING_JSON ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, PricingEntry>;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // ignore invalid JSON, fall back to defaults
  }
  return null;
}

export function resolvePricing(
  provider: string,
  model: string,
  overrides?: Record<string, PricingEntry> | null,
): LlmPricing | null {
  const key = normalizeKey(provider, model);
  const entryFromOverrides = overrides?.[key];
  if (entryFromOverrides && Number.isFinite(entryFromOverrides.input_per_1k) && Number.isFinite(entryFromOverrides.output_per_1k)) {
    return {
      input_per_1k: entryFromOverrides.input_per_1k,
      output_per_1k: entryFromOverrides.output_per_1k,
      currency: 'usd',
      source: 'dev_settings',
    };
  }
  const envPricing = parsePricingFromEnv();
  const entryFromEnv = envPricing?.[key];
  if (entryFromEnv && Number.isFinite(entryFromEnv.input_per_1k) && Number.isFinite(entryFromEnv.output_per_1k)) {
    return {
      input_per_1k: entryFromEnv.input_per_1k,
      output_per_1k: entryFromEnv.output_per_1k,
      currency: 'usd',
      source: 'env',
    };
  }
  const entryFromCode = DEFAULT_PRICING[key];
  if (entryFromCode && Number.isFinite(entryFromCode.input_per_1k) && Number.isFinite(entryFromCode.output_per_1k)) {
    return {
      input_per_1k: entryFromCode.input_per_1k,
      output_per_1k: entryFromCode.output_per_1k,
      currency: 'usd',
      source: 'code',
    };
  }
  return null;
}

export function computeCostUsd(usage: LlmUsage | undefined, pricing: LlmPricing | null): LlmCostBreakdown | null {
  if (!usage || !pricing) return null;
  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  const inputCost = (inputTokens / 1000) * pricing.input_per_1k;
  const outputCost = (outputTokens / 1000) * pricing.output_per_1k;
  return {
    currency: 'usd',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    input_cost_usd: Number(inputCost.toFixed(6)),
    output_cost_usd: Number(outputCost.toFixed(6)),
    total_cost_usd: Number((inputCost + outputCost).toFixed(6)),
    input_rate_per_1k: pricing.input_per_1k,
    output_rate_per_1k: pricing.output_per_1k,
    source: pricing.source,
  };
}
