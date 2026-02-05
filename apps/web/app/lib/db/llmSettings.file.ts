/**
 * Dev-only LLM settings (provider, model, base_url). No API key stored.
 * File: PourLaMaquette/db/llm_settings.json
 */

import path from 'node:path';
import { getDbRoot } from './paths';
import { ensureDir, readJson, writeJsonAtomic } from './fileStore';
import type { DevLlmSettingsV1, DevLlmRoutingTierConfig } from './types';

const FILENAME = 'llm_settings.json';

function getSettingsPath(): string {
  return path.join(getDbRoot(), FILENAME);
}

function normalizePricing(
  pricing: DevLlmSettingsV1['pricing'] | null | undefined,
): DevLlmSettingsV1['pricing'] | undefined {
  if (!pricing || typeof pricing !== 'object') return undefined;
  const entries = Object.entries(pricing);
  const cleaned: DevLlmSettingsV1['pricing'] = {};
  for (const [key, value] of entries) {
    if (!value || typeof value !== 'object') continue;
    const input = (value as { input_per_1k?: unknown }).input_per_1k;
    const output = (value as { output_per_1k?: unknown }).output_per_1k;
    if (typeof input === 'number' && Number.isFinite(input) && typeof output === 'number' && Number.isFinite(output)) {
      cleaned[key] = { input_per_1k: input, output_per_1k: output };
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function normalizeTierConfig(raw: unknown): DevLlmRoutingTierConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const provider = o.provider === 'qwen' ? 'qwen' : o.provider === 'openai' ? 'openai' : undefined;
  const model = typeof o.model === 'string' ? o.model.trim() || undefined : undefined;
  const base_url = typeof o.base_url === 'string' ? o.base_url.trim() || undefined : undefined;
  if (!provider && !model && !base_url) return undefined;
  return { provider, model, base_url };
}

function normalizeRouting(
  routing: DevLlmSettingsV1['routing'] | null | undefined,
): DevLlmSettingsV1['routing'] | undefined {
  if (!routing || typeof routing !== 'object') return undefined;
  const defaultTier = normalizeTierConfig((routing as Record<string, unknown>).default);
  const reasoningTier = normalizeTierConfig((routing as Record<string, unknown>).reasoning);
  const fastTier = normalizeTierConfig((routing as Record<string, unknown>).fast);
  if (!defaultTier && !reasoningTier && !fastTier) return undefined;
  return {
    ...(defaultTier && { default: defaultTier }),
    ...(reasoningTier && { reasoning: reasoningTier }),
    ...(fastTier && { fast: fastTier }),
  };
}

/**
 * Read dev LLM settings. Returns null if file missing or invalid.
 * Only use in dev; in prod callers should return 403 before calling this.
 */
export async function readDevLlmSettings(): Promise<DevLlmSettingsV1 | null> {
  if (process.env.NODE_ENV === 'production') return null;
  const filePath = getSettingsPath();
  try {
    const data = await readJson<DevLlmSettingsV1>(filePath);
    if (data?.version !== 'dev-llm-settings-v1' || (data.provider !== 'openai' && data.provider !== 'qwen')) {
      return null;
    }
    return {
      ...data,
      pricing: normalizePricing(data.pricing),
      routing: normalizeRouting(data.routing),
    };
  } catch {
    return null;
  }
}

/**
 * Merge partial settings and write. Sets updated_at. Never stores API key.
 */
export async function writeDevLlmSettings(
  partial: Partial<Omit<DevLlmSettingsV1, 'version' | 'updated_at'>>,
): Promise<DevLlmSettingsV1> {
  const existing = await readDevLlmSettings();
  const updated_at = new Date().toISOString();
  const normalizedPricing =
    partial.pricing !== undefined ? normalizePricing(partial.pricing) : existing?.pricing;
  const normalizedRouting =
    partial.routing !== undefined ? normalizeRouting(partial.routing) : existing?.routing;
  const next: DevLlmSettingsV1 = {
    version: 'dev-llm-settings-v1',
    updated_at,
    provider: partial.provider ?? existing?.provider ?? 'openai',
    model: partial.model ?? existing?.model,
    base_url: partial.base_url ?? existing?.base_url,
    pricing: normalizedPricing,
    routing: normalizedRouting,
  };
  await ensureDir(path.dirname(getSettingsPath()));
  await writeJsonAtomic(getSettingsPath(), next);
  return next;
}
