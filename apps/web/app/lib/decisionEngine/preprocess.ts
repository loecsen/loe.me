/**
 * Decision Engine V2 — preprocess intent and context.
 * Deterministic: normalize, intent_lang, days_bucket, policy_version.
 */

import { normalizeIntentForKey } from '../db/key';
import { getDisplayLanguage } from '../actionability';
import { POLICY_VERSION } from '../db/constants';
import { DECISION_RECORD_SCHEMA_VERSION } from '../db/types';
import type { DecisionEngineInput, PreprocessedInput } from './types';

/** Days bucket for cache key: <=14, <=30, <=90, >90. Must match lib/db/key.ts. */
export function daysBucket(days: number): string {
  if (days <= 14) return '<=14';
  if (days <= 30) return '<=30';
  if (days <= 90) return '<=90';
  return '>90';
}

/**
 * Preprocess input for Decision Engine.
 * Always run first; used for exact cache key and judge inputs.
 */
export function preprocess(input: DecisionEngineInput): PreprocessedInput {
  const trimmed = (input.intent ?? '').trim();
  const normalized_intent = normalizeIntentForKey(trimmed);
  const intent_lang = getDisplayLanguage(trimmed || 'x', input.ui_locale ?? 'en');
  const days = typeof input.days === 'number' && Number.isFinite(input.days) ? Math.max(1, Math.min(365, input.days)) : 14;

  return {
    normalized_intent,
    intent_lang,
    ui_locale: input.ui_locale ?? 'en',
    days,
    days_bucket: daysBucket(days),
    policy_version: POLICY_VERSION,
    schema_version: DECISION_RECORD_SCHEMA_VERSION,
  };
}
