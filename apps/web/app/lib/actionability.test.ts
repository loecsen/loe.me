/**
 * Unit tests for Actionability Gate v2.
 * Run with: npx ts-node --esm apps/web/app/lib/actionability.test.ts (if ts-node available)
 * Or run via vitest if added to the project.
 */
import { runActionabilityV2, getDisplayLanguage } from './actionability';
import { shouldSuggestRephraseSync, buildSuggestionFromTemplate } from './actionability/suggestion';

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

// --- displayLang + inline suggestion (localized safe suggestions) ---
function assertDisplayLang(intent: string, uiLocale: string, expected: string, label?: string) {
  const got = getDisplayLanguage(intent, uiLocale);
  if (got !== expected) {
    throw new Error(`[${label ?? intent}] getDisplayLanguage("${intent}", "${uiLocale}") expected "${expected}", got "${got}"`);
  }
}

function assertShouldSuggest(intent: string, expected: boolean, label?: string) {
  const got = shouldSuggestRephraseSync(intent);
  if (got !== expected) {
    throw new Error(`[${label ?? intent}] shouldSuggestRephraseSync("${intent}") expected ${expected}, got ${got}`);
  }
}

// "petite bite" -> no suggestion (rejection message only)
assertShouldSuggest('petite bite', false, 'petite bite');

// "pizza" -> may suggest (FR if UI=fr) -> we only test shouldSuggest true; displayLang tested separately
assertShouldSuggest('pizza', true, 'pizza');

// "make pizza" -> suggestion EN if UI=en
assertDisplayLang('make pizza', 'en', 'en', 'make pizza EN');
assertDisplayLang('make pizza', 'fr', 'fr', 'make pizza FR fallback');

// "学习中文A2 90天" -> zh if CJK script, else UI
assertDisplayLang('学习中文A2 90天', 'fr', 'zh', 'CJK zh');
assertDisplayLang('学习中文A2 90天', 'en', 'zh', 'CJK zh en');

// "피자" -> ko if Hangul
assertDisplayLang('피자', 'en', 'ko', 'Hangul ko');
assertDisplayLang('피자', 'fr', 'ko', 'Hangul ko fr');

// greetings / short -> no suggestion
assertShouldSuggest('hello', false, 'hello');
assertShouldSuggest('bonjour', false, 'bonjour');
assertShouldSuggest('hi', false, 'hi');
assertShouldSuggest('ça va', false, 'ça va');

// Suggestion template: FR "Exemple : 'X en 14 jours'"
const frSuggestion = buildSuggestionFromTemplate('fr', 'apprendre le piano');
if (!frSuggestion || !frSuggestion.includes('apprendre le piano') || !frSuggestion.includes('14 jours')) {
  throw new Error(`buildSuggestionFromTemplate(fr, "apprendre le piano") expected FR template, got "${frSuggestion}"`);
}
const enSuggestion = buildSuggestionFromTemplate('en', 'learn piano');
if (!enSuggestion || !enSuggestion.includes('learn piano') || !enSuggestion.includes('14 days')) {
  throw new Error(`buildSuggestionFromTemplate(en, "learn piano") expected EN template, got "${enSuggestion}"`);
}

console.log('All actionability tests passed.');
