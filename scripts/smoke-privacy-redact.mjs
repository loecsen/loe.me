#!/usr/bin/env node
/**
 * Smoke: privacy redactor. No network.
 * Mirrors apps/web/app/lib/privacy/redact.ts behavior (regex buckets, truncation, risk).
 */

const RISKY_KEYS = ['email', 'url', 'phone', 'iban', 'card', 'ip', 'uuid', 'handle'];

const BUCKETS = [
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

function sumRiskyHits(hits) {
  return RISKY_KEYS.reduce((acc, k) => acc + (hits[k] ?? 0), 0);
}

function toRisk(riskyCount) {
  if (riskyCount >= 3) return 'high';
  if (riskyCount >= 1) return 'medium';
  return 'low';
}

function redactForLlm(input, maxChars = 280) {
  const hits = {};
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
  return { redacted: text, hits, risk, truncated };
}

function assert(condition, message) {
  if (!condition) {
    process.stderr.write(`FAIL: ${message}\n`);
    process.exit(1);
  }
}

// --- tests ---

// emails/urls/phones replaced with tokens
const r1 = redactForLlm('Contact me at john@example.com or https://evil.com');
assert(r1.redacted.includes('[EMAIL]'), 'email replaced');
assert(r1.redacted.includes('[URL]'), 'url replaced');
assert(!r1.redacted.includes('john@example.com'), 'no raw email');
assert(!r1.redacted.includes('evil.com'), 'no raw url');

const r2 = redactForLlm('Call +33 1 23 45 67 89');
assert(r2.redacted.includes('[PHONE]'), 'phone replaced');
assert(r2.hits.phone >= 1, 'phone hit counted');

// truncation
const long = 'a'.repeat(300);
const r3 = redactForLlm(long, 100);
assert(r3.truncated === true, 'truncated flag');
assert(r3.redacted.length === 101, 'length maxChars+1 (…)');
assert(r3.redacted.endsWith('…'), 'ellipsis appended');

// risk high when >= 3 risky hits
const r4 = redactForLlm('a b c d e f g');
assert(r4.risk === 'low', 'no hits => low');

const r5 = redactForLlm('me@a.co and you@b.org');
assert(r5.risk === 'medium', '1–2 risky hits => medium');

const r6 = redactForLlm('me@a.co you@b.org other@c.io');
assert(r6.risk === 'high', '>=3 risky hits => high');

// UUID (last segment not all digits so phone pattern does not eat it) and handle
const r7 = redactForLlm('ref: a1b2c3d4-e5f6-7890-abcd-efabcd123456 and @alice');
assert(r7.redacted.includes('[ID]'), 'uuid replaced');
assert(r7.redacted.includes('[HANDLE]'), 'handle replaced');

process.stdout.write('smoke-privacy-redact: ok\n');
process.exit(0);
