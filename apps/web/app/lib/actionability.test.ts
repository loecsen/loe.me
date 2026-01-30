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
  timeframe?: number,
) {
  const result = runActionabilityV2(text, timeframe);
  if (result.action !== expectedAction) {
    throw new Error(
      `[${label ?? text}] Expected action "${expectedAction}", got "${result.action}" (reason_code: ${result.reason_code})`,
    );
  }
}

// "pizza" => not_actionable_inline (single term)
assertAction('pizza', 'not_actionable_inline', 'pizza');

// "faire pizza" => ACTIONABLE (faire + noun)
assertAction('faire pizza', 'actionable', 'faire pizza');

// "manger pizza" => BORDERLINE (consume only)
assertAction('manger pizza', 'borderline', 'manger pizza');

// "apprendre le chinois A2 90 jours" => ACTIONABLE (has_cefr or has_digit)
assertAction('apprendre le chinois A2 90 jours', 'actionable', 'chinois A2 90 jours');

// "apprendre le chinois A2" + 90 days => ACTIONABLE
assertAction('apprendre le chinois A2', 'actionable', 'apprendre chinois A2 + 90d', 90);

// "你好" => not_actionable_inline (social/greeting)
assertAction('你好', 'not_actionable_inline', '你好');

// "学习中文A2 90天" => actionable (has digit / CEFR)
assertAction('学习中文A2 90天', 'actionable', '学习中文A2 90天');

// "피자" => not_actionable_inline
assertAction('피자', 'not_actionable_inline', '피자');

// "피자 만들기" => actionable (hangul >= 6 effective chars)
assertAction('피자 만들기', 'actionable', '피자 만들기');

// "comment ça va ?" => not_actionable_inline (social)
assertAction('comment ça va ?', 'not_actionable_inline', 'comment ça va');

console.log('All actionability tests passed.');
