/**
 * Clarify chips cache helpers (server-only).
 */

import { createHash } from 'node:crypto';

export const CLARIFY_CHIPS_PROMPT_VERSION = 'clarify_chips_v1';

export function normalizeClarifyIntent(input: string): string {
  const base = (input ?? '')
    .toLowerCase()
    .replace(/[.,;:!?()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return '';
  return base.slice(0, 160);
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function buildClarifyChipsCacheKey(params: {
  prompt_version?: string;
  domain: string;
  normalized_intent: string;
  lang: string;
  days: number;
}): string {
  const promptVersion = params.prompt_version ?? CLARIFY_CHIPS_PROMPT_VERSION;
  const payload = [
    promptVersion,
    params.domain,
    params.normalized_intent,
    params.lang,
    String(params.days),
  ].join('|');
  return sha256Hex(payload);
}
