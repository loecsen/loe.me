/**
 * Clarify chips — strict contract for refine modal, with cache.
 */

import { NextResponse } from 'next/server';
import { redactForLlm } from '../../../lib/privacy/redact';
import { getDisplayLanguage } from '../../../lib/actionability';
import { runClarifyChips } from '../../../lib/decisionEngine/judges/clarifyChips';
import {
  clarifyChipsContractSchema,
  type ClarifyChipsContract,
  type ClarifyChipsJudgeValue,
} from '../../../lib/decisionEngine/clarifyChipsSchema';
import { getByCacheKey, upsert } from '../../../lib/db/clarifyChipsCache.file';
import type { ClarifyChipsCacheEntry } from '../../../lib/db/types';
import {
  CLARIFY_CHIPS_PROMPT_VERSION,
  buildClarifyChipsCacheKey,
  normalizeClarifyIntent,
} from '../../../lib/decisionEngine/clarifyChipsCache';

export const dynamic = 'force-dynamic';

const PROMPT_VERSION = CLARIFY_CHIPS_PROMPT_VERSION;
const CACHE_TTL_DAYS = 30;

type FallbackText = {
  contextLabel: string;
  comfortLabel: string;
  optionsContext: Array<{ key: string; label: string }>;
  optionsComfort: Array<{ key: string; label: string }>;
};

const FALLBACK_TEXT: Record<string, FallbackText> = {
  fr: {
    contextLabel: 'Contexte',
    comfortLabel: 'Niveau vise',
    optionsContext: [
      { key: 'travel', label: 'Voyage' },
      { key: 'study', label: 'Etudes' },
      { key: 'conversation', label: 'Conversation' },
      { key: 'work', label: 'Travail' },
    ],
    optionsComfort: [
      { key: 'essential', label: 'Essentiel' },
      { key: 'comfortable', label: 'A l aise' },
      { key: 'fluent', label: 'Fluide' },
    ],
  },
  en: {
    contextLabel: 'Context',
    comfortLabel: 'Target level',
    optionsContext: [
      { key: 'travel', label: 'Travel' },
      { key: 'study', label: 'Study' },
      { key: 'conversation', label: 'Conversation' },
      { key: 'work', label: 'Work' },
    ],
    optionsComfort: [
      { key: 'essential', label: 'Essential' },
      { key: 'comfortable', label: 'Comfortable' },
      { key: 'fluent', label: 'Fluent' },
    ],
  },
  es: {
    contextLabel: 'Contexto',
    comfortLabel: 'Nivel objetivo',
    optionsContext: [
      { key: 'travel', label: 'Viaje' },
      { key: 'study', label: 'Estudios' },
      { key: 'conversation', label: 'Conversacion' },
      { key: 'work', label: 'Trabajo' },
    ],
    optionsComfort: [
      { key: 'essential', label: 'Esencial' },
      { key: 'comfortable', label: 'Comodo' },
      { key: 'fluent', label: 'Fluido' },
    ],
  },
  de: {
    contextLabel: 'Kontext',
    comfortLabel: 'Zielniveau',
    optionsContext: [
      { key: 'travel', label: 'Reise' },
      { key: 'study', label: 'Studium' },
      { key: 'conversation', label: 'Gesprach' },
      { key: 'work', label: 'Arbeit' },
    ],
    optionsComfort: [
      { key: 'essential', label: 'Grundlegend' },
      { key: 'comfortable', label: 'Sicher' },
      { key: 'fluent', label: 'Fliessend' },
    ],
  },
  it: {
    contextLabel: 'Contesto',
    comfortLabel: 'Livello target',
    optionsContext: [
      { key: 'travel', label: 'Viaggio' },
      { key: 'study', label: 'Studio' },
      { key: 'conversation', label: 'Conversazione' },
      { key: 'work', label: 'Lavoro' },
    ],
    optionsComfort: [
      { key: 'essential', label: 'Essenziale' },
      { key: 'comfortable', label: 'A suo agio' },
      { key: 'fluent', label: 'Fluido' },
    ],
  },
};

function buildCacheKey(params: {
  prompt_version: string;
  domain: string;
  normalized_intent: string;
  lang: string;
  days: number;
}): string {
  return buildClarifyChipsCacheKey(params);
}

function selectBaseLang(lang: string): string {
  const base = (lang ?? 'en').split('-')[0]?.toLowerCase() ?? 'en';
  return base;
}

function buildFallbackValue(params: {
  lang: string;
  days: number;
  cache: 'hit' | 'miss' | 'bypass';
  hash: string;
  timing_ms: number;
}): ClarifyChipsContract {
  const baseLang = selectBaseLang(params.lang);
  const fallback = FALLBACK_TEXT[baseLang] ?? FALLBACK_TEXT.en;
  const value: ClarifyChipsContract = {
    template_key: `fallback_${baseLang}`,
    prompt_version: PROMPT_VERSION,
    lang: baseLang,
    days: params.days,
    sections: [
      {
        id: 'context',
        label: fallback.contextLabel,
        type: 'single',
        options: fallback.optionsContext,
        default: fallback.optionsContext[0]?.key ?? 'travel',
      },
      {
        id: 'comfort',
        label: fallback.comfortLabel,
        type: 'single',
        options: fallback.optionsComfort,
        default: fallback.optionsComfort[0]?.key ?? 'essential',
      },
    ],
    trace: {
      cache: params.cache,
      hash: params.hash,
      timing_ms: params.timing_ms,
      judge: 'clarifyChips',
      prompt_id: PROMPT_VERSION,
    },
  };
  return value;
}

function toContract(
  value: ClarifyChipsJudgeValue,
  trace: ClarifyChipsContract['trace'],
): ClarifyChipsContract | null {
  const candidate: ClarifyChipsContract = { ...value, trace };
  const parsed = clarifyChipsContractSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return parsed.data;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const body = await request.json();
    const intent = typeof body?.intent === 'string' ? body.intent.trim() : '';
    const domain = typeof body?.domain === 'string' ? body.domain.trim() : '';
    const days = typeof body?.days === 'number' && Number.isFinite(body.days) ? body.days : 14;
    const lang = typeof body?.lang === 'string' ? body.lang : '';
    const ui_locale = typeof body?.ui_locale === 'string' ? body.ui_locale : 'en';
    const bypassCache =
      process.env.NODE_ENV !== 'production' && (body?.bypass_cache === true || body?.bypass_cache === 1);

    if (!intent) {
      return NextResponse.json({ error: 'intent required' }, { status: 400 });
    }
    if (!domain) {
      return NextResponse.json({ error: 'domain required' }, { status: 400 });
    }

    const intentLang = lang || getDisplayLanguage(intent, ui_locale);
    const redacted = redactForLlm(intent, { maxChars: 280 });
    const normalized = normalizeClarifyIntent(redacted.redacted);
    const cacheKey = buildCacheKey({
      prompt_version: PROMPT_VERSION,
      domain,
      normalized_intent: normalized,
      lang: intentLang,
      days,
    });

    if (!bypassCache) {
      const cached = await getByCacheKey(cacheKey);
      if (cached?.value_json) {
        const timingMs = Math.max(0, Date.now() - startedAt);
        const trace: ClarifyChipsContract['trace'] = {
          cache: 'hit',
          hash: cacheKey,
          timing_ms: timingMs,
          judge: 'clarifyChips',
          prompt_id: PROMPT_VERSION,
        };
        const candidate = toContract(cached.value_json as ClarifyChipsJudgeValue, trace);
        if (candidate) return NextResponse.json(candidate);
      }
    }

    if (process.env.LLM_PRIVACY_STRICT !== '0') {
      if (redacted.risk === 'high' || redacted.risk === 'medium') {
        const timingMs = Math.max(0, Date.now() - startedAt);
      const fallback = buildFallbackValue({
          lang: intentLang,
          days,
          cache: 'bypass',
          hash: cacheKey,
          timing_ms: timingMs,
        });
        return NextResponse.json(fallback);
      }
    }

    const judgeResult = await runClarifyChips(redacted.redacted, intentLang, ui_locale, days, domain);
    const timingMs = Math.max(0, Date.now() - startedAt);
    if (judgeResult.ok) {
      const trace: ClarifyChipsContract['trace'] = {
        cache: 'miss',
        hash: cacheKey,
        timing_ms: timingMs,
        judge: 'clarifyChips',
        prompt_id: PROMPT_VERSION,
      };
      const contract = toContract(judgeResult.value, trace);
      if (contract) {
        const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const record: ClarifyChipsCacheEntry = {
          id: `clarify:${cacheKey.slice(0, 32)}`,
          cache_key: cacheKey,
          prompt_version: PROMPT_VERSION,
          template_key: contract.template_key,
          lang: contract.lang,
          days: contract.days,
          value_json: judgeResult.value as Record<string, unknown>,
          created_at: new Date().toISOString(),
          expires_at: expiresAt,
        };
        await upsert(record);
        return NextResponse.json(contract);
      }
    }

    const fallback = buildFallbackValue({
      lang: intentLang,
      days,
      cache: 'bypass',
      hash: cacheKey,
      timing_ms: timingMs,
    });
    return NextResponse.json(fallback);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    const fallback = buildFallbackValue({
      lang: 'en',
      days: 14,
      cache: 'bypass',
      hash: 'fallback',
      timing_ms: Math.max(0, Date.now() - startedAt),
    });
    return NextResponse.json({ ...fallback, error: message });
  }
}
