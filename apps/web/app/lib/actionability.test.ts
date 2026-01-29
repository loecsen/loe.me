/**
 * Unit tests for Actionability Gate v2.
 * Run with: npx ts-node --esm apps/web/app/lib/actionability.test.ts (if ts-node available)
 * Or run via vitest if added to the project.
 */
import { runActionabilityV2 } from './actionability';

function assertAction(
  text: string,
  expectedAction: 'actionable' | 'not_actionable_inline' | 'borderline',
  label?: string,
) {
  const result = runActionabilityV2(text);
  if (result.action !== expectedAction) {
    throw new Error(
      `[${label ?? text}] Expected action "${expectedAction}", got "${result.action}" (reason_code: ${result.reason_code})`,
    );
  }
}

// "pizza" => not_actionable_inline (single term)
assertAction('pizza', 'not_actionable_inline', 'pizza');

// "faire pizza" => borderline (2 words)
assertAction('faire pizza', 'borderline', 'faire pizza');

// "apprendre le chinois A2 90 jours" => ACTIONABLE (has_cefr or has_digit)
assertAction('apprendre le chinois A2 90 jours', 'actionable', 'chinois A2 90 jours');

// "你好" (2 chars CJK) => not_actionable_inline (too_short_cjk)
assertAction('你好', 'not_actionable_inline', '你好');

// "学习中文A2 90天" => actionable (has digit / CEFR)
assertAction('学习中文A2 90天', 'actionable', '学习中文A2 90天');

// "피자" (2 chars hangul) => not_actionable_inline
assertAction('피자', 'not_actionable_inline', '피자');

// "피자 만들기" => actionable or borderline (hangul >= 6 effective chars => actionable)
assertAction('피자 만들기', 'actionable', '피자 만들기');

console.log('All actionability tests passed.');
