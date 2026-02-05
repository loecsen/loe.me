/**
 * Deterministic unique key and context hash for decision records.
 * Stable for same intent + lang + category + days bucket + gate + policy_version + schema_version.
 */

import { createHash } from 'node:crypto';
import type { BuildDecisionKeyInput, BuildDecisionKeyResult, DecisionUniqueKeyParts } from './types';
import { DECISION_RECORD_SCHEMA_VERSION } from './types';
import { POLICY_VERSION } from './constants';

const DECISION_ID_PREFIX = 'decision:v1:';

/** Days bucket for gate context: <=14, <=30, <=90, >90 */
function daysBucket(days: number): string {
  if (days <= 14) return '<=14';
  if (days <= 30) return '<=30';
  if (days <= 90) return '<=90';
  return '>90';
}

/** Normalize intent: trim, collapse whitespace; lowercase for Latin, keep original for CJK. */
export function normalizeIntentForKey(intent: string): string {
  const trimmed = intent.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const hasCjk = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(trimmed);
  if (hasCjk) return trimmed;
  return trimmed.toLowerCase();
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Build stable unique_key and context_hash for a decision.
 * Includes: intent_normalized, intent_lang, category, days_bucket, gate, policy_version, schema_version.
 * Bump POLICY_VERSION when rules/prompts change so cache hits are only for comparable behavior.
 */
export function buildDecisionUniqueKey(input: BuildDecisionKeyInput): BuildDecisionKeyResult {
  const intent_lang = input.intent_lang ?? 'en';
  const category = input.category ?? null;
  const days = typeof input.days === 'number' && Number.isFinite(input.days) ? Math.max(1, input.days) : 14;
  const requires_feasibility = input.context_flags?.requires_feasibility ?? false;
  const gate = input.gate ?? 'classify';
  const policy_version = input.policy_version ?? POLICY_VERSION;
  const schema_version = input.schema_version ?? DECISION_RECORD_SCHEMA_VERSION;

  const intent_normalized = normalizeIntentForKey(input.intent);
  const days_bucket = daysBucket(days);
  const contextPayload = {
    days_bucket,
    requires_feasibility,
    policy_version,
    gate,
    schema_version,
  };
  const gate_context_hash = sha256Hex(JSON.stringify(contextPayload));
  const key_parts: DecisionUniqueKeyParts = {
    intent_normalized,
    intent_lang,
    category,
    days_bucket,
    requires_feasibility,
    gate,
    policy_version,
    schema_version,
    gate_context_hash,
  };
  const uniquePayload = [
    intent_normalized,
    intent_lang,
    category ?? '',
    days_bucket,
    gate,
    policy_version,
    schema_version,
    gate_context_hash,
  ].join('\n');
  const unique_key = sha256Hex(uniquePayload);
  const context_hash = gate_context_hash;
  return {
    unique_key,
    context_hash,
    key_parts,
  };
}

/** Generate a deterministic decision id from unique_key (for upsert idempotency). */
export function decisionIdFromUniqueKey(unique_key: string): string {
  return DECISION_ID_PREFIX + sha256Hex(unique_key).slice(0, 32);
}
