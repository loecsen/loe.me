/**
 * Decision Engine V2 — deterministic similarity for cache reuse.
 * Trigram Jaccard; used only when intent length > 20. Score in [0.70, 0.90] triggers equivalence judge.
 */

/** Extract character trigrams (3-char windows) for Latin; for CJK use single chars. */
export function trigrams(s: string): Set<string> {
  const normalized = s.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return new Set();

  const hasCjk = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(normalized);
  if (hasCjk) {
    const chars = [...normalized].filter((c) => c.trim());
    return new Set(chars);
  }

  const set = new Set<string>();
  for (let i = 0; i <= normalized.length - 3; i++) {
    set.add(normalized.slice(i, i + 3));
  }
  return set;
}

/** Jaccard similarity between two strings (0..1). */
export function trigramJaccard(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;

  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Minimum intent length to consider similarity lookup (spec: > 20). */
export const SIMILARITY_MIN_INTENT_LENGTH = 20;

/** Score band that triggers equivalence judge: [0.70, 0.90]. */
export const SIMILARITY_LOW = 0.7;
export const SIMILARITY_HIGH = 0.9;

export function isInEquivalenceBand(score: number): boolean {
  return score >= SIMILARITY_LOW && score <= SIMILARITY_HIGH;
}
