/**
 * Cheap, deterministic privacy redactor for user text sent to LLMs.
 * Regex + truncation only; no allowlist, no name detection.
 */

/** Clé i18n du message affiché quand le blocage strict s'applique (voir lib/i18n.ts, toutes langues). */
export const PRIVACY_MESSAGE_KEY = 'privacyUserMessage';

export type RedactRisk = 'low' | 'medium' | 'high';

export type RedactResult = {
  redacted: string;
  hits: Record<string, number>;
  risk: RedactRisk;
  truncated: boolean;
};

const RISKY_KEYS = ['email', 'url', 'phone', 'iban', 'card', 'ip', 'uuid', 'handle'] as const;

function sumRiskyHits(hits: Record<string, number>): number {
  return RISKY_KEYS.reduce((acc, k) => acc + (hits[k] ?? 0), 0);
}

function toRisk(riskyCount: number): RedactRisk {
  if (riskyCount >= 3) return 'high';
  if (riskyCount >= 1) return 'medium';
  return 'low';
}

type Bucket = {
  key: string;
  pattern: RegExp;
  replacement: string;
};

const BUCKETS: Bucket[] = [
  { key: 'url', pattern: /https?:\/\/[^\s]+|www\.[^\s]+/gi, replacement: '[URL]' },
  { key: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  { key: 'ip', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },
  {
    key: 'phone',
    pattern: /\+?[\d\s\-().]{10,20}\b|\b\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}\b/g,
    replacement: '[PHONE]',
  },
  { key: 'iban', pattern: /\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{0,4}\b/gi, replacement: '[IBAN]' },
  {
    key: 'uuid',
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replacement: '[ID]',
  },
  { key: 'handle', pattern: /@[a-zA-Z0-9_]+/g, replacement: '[HANDLE]' },
  {
    key: 'card',
    pattern: /\b\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b|\b\d{13,19}\b/g,
    replacement: '[CARD]',
  },
];

/**
 * Redact PII-like patterns and optionally truncate.
 * Default maxChars = 280; appends … when truncated.
 */
export function redactForLlm(
  input: string,
  opts?: { maxChars?: number },
): RedactResult {
  const maxChars = opts?.maxChars ?? 280;
  const hits: Record<string, number> = {};

  let text = input;
  for (const { key, pattern, replacement } of BUCKETS) {
    const matches = text.match(pattern);
    const count = matches?.length ?? 0;
    if (count > 0) {
      hits[key] = count;
      text = text.replace(pattern, replacement);
    }
  }

  const riskyCount = sumRiskyHits(hits);
  const risk = toRisk(riskyCount);

  let truncated = false;
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + '…';
    truncated = true;
  }

  return {
    redacted: text,
    hits,
    risk,
    truncated,
  };
}
