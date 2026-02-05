#!/usr/bin/env node
/**
 * Smoke: clarify chips contract + cache key invariants (no network).
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const KEY_RE = /^[a-z0-9_]{1,24}$/;
const TEMPLATE_KEY_RE = /^[a-z0-9_]{1,48}$/;
const NO_MARKUP_RE = /[<>`[\]]/;

const labelSchema = z
  .string()
  .min(1)
  .max(32)
  .refine((val) => !NO_MARKUP_RE.test(val));
const optionLabelSchema = z
  .string()
  .min(1)
  .max(26)
  .refine((val) => !NO_MARKUP_RE.test(val));

const optionSchema = z.object({
  key: z.string().regex(KEY_RE),
  label: optionLabelSchema,
});

const sectionSchema = z
  .object({
    id: z.enum(['context', 'comfort']),
    label: labelSchema,
    type: z.literal('single'),
    options: z.array(optionSchema).min(1).max(4),
    default: z.string().regex(KEY_RE),
  })
  .refine((section) => section.options.some((opt) => opt.key === section.default), {
    message: 'default must match option key',
  });

const traceSchema = z.object({
  cache: z.enum(['hit', 'miss', 'bypass']),
  hash: z.string().min(8),
  timing_ms: z.number().int().min(0),
  judge: z.string().min(1),
  prompt_id: z.string().min(1),
});

const contractSchema = z
  .object({
    template_key: z.string().regex(TEMPLATE_KEY_RE),
    prompt_version: z.literal('clarify_chips_v1'),
    lang: z.string().min(2).max(8),
    days: z.number().int().min(1).max(365),
    sections: z.array(sectionSchema).min(1).max(3),
    trace: traceSchema,
  })
  .strict();

function normalizeIntent(input) {
  return input
    .toLowerCase()
    .replace(/[.,;:!?()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function buildCacheKey({ prompt_version, domain, normalized_intent, lang, days }) {
  const payload = [prompt_version, domain, normalized_intent, lang, String(days)].join('|');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

const normalized = normalizeIntent('  Apprendre, 3 morceaux simples!  ');
assert(normalized === 'apprendre 3 morceaux simples', 'normalizeIntent should strip punctuation and spaces');

const keyA = buildCacheKey({
  prompt_version: 'clarify_chips_v1',
  domain: 'music',
  normalized_intent: normalized,
  lang: 'fr',
  days: 14,
});
const keyB = buildCacheKey({
  prompt_version: 'clarify_chips_v2',
  domain: 'music',
  normalized_intent: normalized,
  lang: 'fr',
  days: 14,
});
assert(keyA !== keyB, 'cache key must change with prompt version');

const sample = {
  template_key: 'music_basic',
  prompt_version: 'clarify_chips_v1',
  lang: 'fr',
  days: 14,
  sections: [
    {
      id: 'context',
      label: 'Contexte',
      type: 'single',
      options: [
        { key: 'home', label: 'Maison' },
        { key: 'scenes', label: 'Scenes' },
      ],
      default: 'home',
    },
    {
      id: 'comfort',
      label: 'Niveau vise',
      type: 'single',
      options: [
        { key: 'essential', label: 'Essentiel' },
        { key: 'comfortable', label: 'A l aise' },
      ],
      default: 'essential',
    },
  ],
  trace: {
    cache: 'miss',
    hash: keyA,
    timing_ms: 42,
    judge: 'clarifyChips',
    prompt_id: 'clarify_chips_v1',
  },
};

const parsed = contractSchema.safeParse(sample);
assert(parsed.success, 'sample contract must validate');

const invalid = { ...sample, sections: [{ ...sample.sections[0], default: 'missing' }] };
const invalidParsed = contractSchema.safeParse(invalid);
assert(!invalidParsed.success, 'default must be in options');

console.log('Smoke clarify-chips: all passed.');
