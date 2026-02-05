/**
 * Clarify chips contract (strict) + Zod schemas.
 */

import { z } from 'zod';

const KEY_RE = /^[a-z0-9_]{1,24}$/;
const TEMPLATE_KEY_RE = /^[a-z0-9_]{1,48}$/;
const NO_MARKUP_RE = /[<>`[\]]/;

function noMarkup(val: string): boolean {
  return !NO_MARKUP_RE.test(val);
}

const labelSchema = z
  .string()
  .min(1)
  .max(32)
  .refine(noMarkup, { message: 'label must not contain markup' });

const optionLabelSchema = z
  .string()
  .min(1)
  .max(26)
  .refine(noMarkup, { message: 'option label must not contain markup' });

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
    path: ['default'],
  });

const traceSchema = z.object({
  cache: z.enum(['hit', 'miss', 'bypass']),
  hash: z.string().min(8),
  timing_ms: z.number().int().min(0),
  judge: z.string().min(1),
  prompt_id: z.string().min(1),
});

const baseSchema = z
  .object({
    template_key: z.string().regex(TEMPLATE_KEY_RE),
    prompt_version: z.literal('clarify_chips_v1'),
    lang: z.string().min(2).max(8),
    days: z.number().int().min(1).max(365),
    sections: z.array(sectionSchema).min(1).max(3),
  })
  .strict();

export const clarifyChipsJudgeSchema = baseSchema;

export const clarifyChipsContractSchema = baseSchema.extend({
  trace: traceSchema,
});

export type ClarifyChipsContract = z.infer<typeof clarifyChipsContractSchema>;
export type ClarifyChipsJudgeValue = z.infer<typeof clarifyChipsJudgeSchema>;
