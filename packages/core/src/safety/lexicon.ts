import { normalizeForSafety } from './normalize';
import { pushTrace, type TraceEvent } from './trace';
import type { ReasonCode, SafetyVerdict } from './types';

export type LexRule = {
  id: string;
  reason_code: ReasonCode;
  pattern: string;
  flags?: string;
  severity?: 'block';
  example?: boolean;
};

export type Lexicon = {
  version: string;
  global: LexRule[];
  locales?: Record<string, LexRule[]>;
};

type CompiledRule = LexRule & { regex: RegExp };

type CompiledLexicon = {
  global: CompiledRule[];
  locales: Record<string, CompiledRule[]>;
};

export type LexiconMatch = {
  ruleId: string;
  reason_code: ReasonCode;
  haystack: keyof ReturnType<typeof normalizeForSafety>;
  value: string;
};

const normalizeLocale = (locale?: string) => (locale ?? '').split('-')[0]?.toLowerCase() ?? '';

const compileRules = (rules: LexRule[], errors: string[]): CompiledRule[] => {
  return rules.map((rule) => {
    try {
      const regex = new RegExp(rule.pattern, rule.flags ?? 'i');
      return { ...rule, regex };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Rule "${rule.id}" invalid regex: ${message}`);
      return { ...rule, regex: /$^/ };
    }
  });
};

export function validateLexicon(lexicon: Lexicon): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!lexicon.version) {
    errors.push('Missing lexicon version');
  }
  if (!Array.isArray(lexicon.global)) {
    errors.push('Missing global rules');
  }
  compileRules(lexicon.global ?? [], errors);
  const locales = lexicon.locales ?? {};
  Object.entries(locales).forEach(([locale, rules]) => {
    if (!Array.isArray(rules)) {
      errors.push(`Locale "${locale}" rules must be an array`);
      return;
    }
    compileRules(rules, errors);
  });
  return { ok: errors.length === 0, errors };
}

export function createLexiconGuard(lexicon: Lexicon) {
  const errors: string[] = [];
  const compiled: CompiledLexicon = {
    global: compileRules(lexicon.global ?? [], errors),
    locales: Object.fromEntries(
      Object.entries(lexicon.locales ?? {}).map(([locale, rules]) => [
        locale.toLowerCase(),
        compileRules(rules ?? [], errors),
      ]),
    ),
  };

  if (errors.length > 0) {
    throw new Error(`Invalid lexicon: ${errors.join(' | ')}`);
  }

  return (text: string, locale?: string, trace?: TraceEvent[]): SafetyVerdict => {
    const normalizedLocale = normalizeLocale(locale);
    const rules = [
      ...compiled.global,
      ...(normalizedLocale ? compiled.locales[normalizedLocale] ?? [] : []),
    ];
    const haystacks = normalizeForSafety(text);
    const entries = Object.entries(haystacks) as Array<[keyof typeof haystacks, string]>;

    for (const rule of rules) {
      for (const [haystackName, value] of entries) {
        if (!value) continue;
        if (rule.regex.test(value)) {
          pushTrace(trace, {
            gate: 'safety.lexicon',
            outcome: 'blocked',
            reason_code: rule.reason_code,
            meta: {
              ruleId: rule.id,
              haystack: haystackName,
            },
          });
          return { status: 'blocked', reason_code: rule.reason_code };
        }
      }
    }

    pushTrace(trace, {
      gate: 'safety.lexicon',
      outcome: 'ok',
    });
    return { status: 'ok' };
  };
}

export function findLexiconMatch(
  lexicon: Lexicon,
  text: string,
  locale?: string,
): LexiconMatch | null {
  const errors: string[] = [];
  const compiled: CompiledLexicon = {
    global: compileRules(lexicon.global ?? [], errors),
    locales: Object.fromEntries(
      Object.entries(lexicon.locales ?? {}).map(([localeKey, rules]) => [
        localeKey.toLowerCase(),
        compileRules(rules ?? [], errors),
      ]),
    ),
  };
  if (errors.length > 0) {
    throw new Error(`Invalid lexicon: ${errors.join(' | ')}`);
  }

  const normalizedLocale = normalizeLocale(locale);
  const rules = [
    ...compiled.global,
    ...(normalizedLocale ? compiled.locales[normalizedLocale] ?? [] : []),
  ];
  const haystacks = normalizeForSafety(text);
  const entries = Object.entries(haystacks) as Array<[keyof typeof haystacks, string]>;

  for (const rule of rules) {
    for (const [haystackName, value] of entries) {
      if (!value) continue;
      if (rule.regex.test(value)) {
        return {
          ruleId: rule.id,
          reason_code: rule.reason_code,
          haystack: haystackName,
          value,
        };
      }
    }
  }

  return null;
}
