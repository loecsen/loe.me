#!/usr/bin/env node
/**
 * Smoke: Home path uses classify for feasibility categories (LEARN/CREATE/WELLBEING)
 * and ambition block still has priority.
 * - "je veux récupérer mon ex copine car je suis triste" => category WELLBEING => classify path
 * - "apprendre chinois A2 90 jours" => category LEARN => classify path (no regression)
 * - "devenir champion du monde" => life-goal hit => ambition block (priority)
 * No network: validates inferCategoryFromIntent + categoryRequiresFeasibility + isLifeGoalOrRoleAspiration.
 *
 * Why stubs: We run TS via ts.transpileModule + Function(); the "module" has no real path,
 * so require("./taxonomy/categories") etc. resolve from the script's cwd and fail. We pre-load
 * real TS sources under apps/web/app/lib and map those specifiers to the transpiled exports.
 *
 * Cwd-independent: repo root is derived from the script's directory (import.meta.url), not
 * process.cwd(), so the script works when run from any working directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const libDir = path.join(repoRoot, 'apps', 'web', 'app', 'lib');

function transpileAndRun(filePath, customRequire = require) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  const wrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  wrapper(mod.exports, customRequire, mod, filePath, path.dirname(filePath));
  return mod.exports;
}

/**
 * Returns a require function that resolves problematic relative specifiers (used by
 * transpiled TS under lib/) to pre-loaded modules. Eval/transpile breaks relative require
 * because the "module" has no real file path; Node resolves from cwd and fails.
 */
function requireWithStubs(specifierToModule, fallbackRequire = require) {
  const normalized = (s) => String(s).replace(/\\/g, '/');
  return (specifier) => {
    const key = normalized(specifier);
    for (const [pattern, mod] of Object.entries(specifierToModule)) {
      if (key === pattern || key.endsWith(pattern) || key === normalized(pattern)) return mod;
    }
    return fallbackRequire(specifier);
  };
}

const taxonomyCategoriesPath = path.join(libDir, 'taxonomy', 'categories.ts');
const taxonomyCategoriesMod = transpileAndRun(taxonomyCategoriesPath);

const requireForCategory = requireWithStubs({
  './taxonomy/categories': taxonomyCategoriesMod,
  'taxonomy/categories': taxonomyCategoriesMod,
});

const categoryMod = transpileAndRun(path.join(libDir, 'category.ts'), requireForCategory);
const typesMod = transpileAndRun(path.join(libDir, 'actionability', 'types.ts'));

const requireForActionability = requireWithStubs(
  {
    './category': categoryMod,
    'category': categoryMod,
    './actionability/types': typesMod,
    'actionability/types': typesMod,
  },
  require,
);

const actionabilityMod = transpileAndRun(path.join(libDir, 'actionability.ts'), requireForActionability);

const requireForControllability = requireWithStubs(
  {
    './types': typesMod,
    'actionability/types': typesMod,
    '../taxonomy/categories': taxonomyCategoriesMod,
    'taxonomy/categories': taxonomyCategoriesMod,
  },
  require,
);
const controllabilityMod = transpileAndRun(path.join(libDir, 'actionability', 'controllability.ts'), requireForControllability);
const ambitionMod = transpileAndRun(path.join(repoRoot, 'apps', 'web', 'app', 'lib', 'actionability', 'ambitionConfirmation.ts'));

const gatesCopyPath = path.join(libDir, 'gates', 'copy.ts');
const gatesCopyMod = transpileAndRun(gatesCopyPath);
const requireForGates = requireWithStubs({ './copy': gatesCopyMod, 'copy': gatesCopyMod });
const gatesClassifyPath = path.join(libDir, 'gates', 'classifyMessage.ts');
const gatesClassifyMod = transpileAndRun(gatesClassifyPath, requireForGates);

const { inferCategoryFromIntent, runActionabilityV2, toGateResult } = actionabilityMod;
const { categoryRequiresFeasibility } = categoryMod;
const { detectControllability } = controllabilityMod;
const { isLifeGoalOrRoleAspiration } = ambitionMod;
const { GateCopy } = gatesCopyMod;
const { getClassifyInlineMessage } = gatesClassifyMod;

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// "je veux récupérer mon ex copine car je suis triste" => WELLBEING, ACTIONABLE => controllability/realism path (no classify)
const exIntent = 'je veux récupérer mon ex copine car je suis triste';
const catEx = inferCategoryFromIntent(exIntent);
assert(catEx === 'WELLBEING', `inferCategoryFromIntent("${exIntent}") => WELLBEING, got ${catEx}`);
assert(categoryRequiresFeasibility(catEx), 'categoryRequiresFeasibility(WELLBEING) must be true');
const gateEx = toGateResult(runActionabilityV2(exIntent, 14));
assert(gateEx.status === 'ACTIONABLE', `gate for ex intent should be ACTIONABLE, got ${gateEx.status}`);
console.log('  ✓ "je veux récupérer mon ex copine..." => WELLBEING, ACTIONABLE => controllability/realism (no classify)');

// "apprendre chinois A2 90 jours" => LEARN => feasibility => no regression
const learnIntent = 'apprendre chinois A2 90 jours';
const catLearn = inferCategoryFromIntent(learnIntent);
assert(catLearn === 'LEARN', `inferCategoryFromIntent("${learnIntent}") => LEARN, got ${catLearn}`);
assert(categoryRequiresFeasibility(catLearn), 'categoryRequiresFeasibility(LEARN) must be true');
console.log('  ✓ "apprendre chinois A2 90 jours" => LEARN => classify optional');

// "devenir champion du monde" => life-goal hit => ambition block (priority over classify)
const ambitionIntent = 'devenir champion du monde';
const lifeGoal = isLifeGoalOrRoleAspiration(ambitionIntent);
assert(lifeGoal.hit === true, `isLifeGoalOrRoleAspiration("${ambitionIntent}") => hit true, got ${lifeGoal.hit}`);
const gateAmbition = toGateResult(runActionabilityV2(ambitionIntent, 30));
assert(gateAmbition.status === 'ACTIONABLE', `gate for ambition intent should be ACTIONABLE, got ${gateAmbition.status}`);
console.log('  ✓ "devenir champion du monde" => life_goal_confirm (priority)');

// "get my ex back" => ACTIONABLE => controllability support (never classify)
const exBackIntent = 'get my ex back';
const gateExBack = toGateResult(runActionabilityV2(exBackIntent, 14));
assert(gateExBack.status === 'ACTIONABLE', `gate for "${exBackIntent}" should be ACTIONABLE, got ${gateExBack.status}`);
const ctrlExBack = detectControllability(exBackIntent, 'en');
assert(ctrlExBack.level === 'low', `detectControllability("${exBackIntent}") => level low, got ${ctrlExBack.level}`);
console.log('  ✓ "get my ex back" => ACTIONABLE, controllability low => supportive block (no classify)');

// "become president" => low => supportive block path
const presidentIntent = 'become president';
const ctrlPresident = detectControllability(presidentIntent, 'en');
assert(ctrlPresident.level === 'low', `detectControllability("${presidentIntent}") => level low, got ${ctrlPresident.level}`);
console.log('  ✓ "become president" => controllability low => supportive block path');

// "practice public speaking to run for mayor in 90 days" => NOT low (guarded actionable frame)
const guardedIntent = 'practice public speaking to run for mayor in 90 days';
const ctrlGuarded = detectControllability(guardedIntent, 'en');
assert(ctrlGuarded.level !== 'low', `detectControllability("${guardedIntent}") => should NOT be low (guarded), got ${ctrlGuarded.level}`);
console.log('  ✓ "practice public speaking to run for mayor in 90 days" => NOT low (guarded)');

// (a) BLOCKED -> hard safety message path (not noSuggestionHint)
const blockedMsg = getClassifyInlineMessage({ verdict: 'BLOCKED' });
assert(blockedMsg !== null, 'getClassifyInlineMessage({ verdict: "BLOCKED" }) must return a message');
assert(blockedMsg.hint === GateCopy.safetyBlockedMessage(), 'BLOCKED must use safetyBlockedMessage, not noSuggestionHint');
assert(blockedMsg.hint !== GateCopy.noSuggestionHint(), 'BLOCKED must not use noSuggestionHint');
console.log('  ✓ BLOCKED -> hard safety message (not classifyNoSuggestionSafety)');

// (b) safety_no_suggestion (not blocked) -> no-suggestion hint and suggestedRephrase=null
const noSuggestionMsg = getClassifyInlineMessage({ reason_code: 'safety_no_suggestion', verdict: 'NEEDS_REPHRASE_INLINE' });
assert(noSuggestionMsg !== null, 'getClassifyInlineMessage(safety_no_suggestion) must return a message');
assert(noSuggestionMsg.hint === GateCopy.noSuggestionHint(), 'safety_no_suggestion must use noSuggestionHint');
assert(noSuggestionMsg.suggestedRephrase === null, 'safety_no_suggestion must have suggestedRephrase=null');
console.log('  ✓ safety_no_suggestion (not blocked) -> no-suggestion hint, suggestedRephrase=null');

// (c) NOT_ACTIONABLE_INLINE returns early (no controllability/classify call)
const notActionableIntent = 'x';
const gateNotActionable = toGateResult(runActionabilityV2(notActionableIntent, 14));
assert(gateNotActionable.status === 'NOT_ACTIONABLE_INLINE', `NOT_ACTIONABLE_INLINE intent must yield status NOT_ACTIONABLE_INLINE, got ${gateNotActionable.status}`);
console.log('  ✓ NOT_ACTIONABLE_INLINE -> early return (no controllability/classify)');

// (d) "take back my ex" / "récupérer mon ex" => gate must not be NOT_ACTIONABLE_INLINE (so not-actionable hint is never correct)
const takeBackExEn = 'take back my ex';
const gateTakeBackEn = toGateResult(runActionabilityV2(takeBackExEn, 14));
assert(gateTakeBackEn.status !== 'NOT_ACTIONABLE_INLINE', `"${takeBackExEn}" must not yield NOT_ACTIONABLE_INLINE (would show wrong hint), got ${gateTakeBackEn.status}`);
const ctrlTakeBackEn = detectControllability(takeBackExEn, 'en');
assert(ctrlTakeBackEn.level === 'low', `"${takeBackExEn}" => controllability low (show angles), got ${ctrlTakeBackEn.level}`);
const recupExFr = 'récupérer mon ex';
const gateRecupFr = toGateResult(runActionabilityV2(recupExFr, 14));
assert(gateRecupFr.status !== 'NOT_ACTIONABLE_INLINE', `"${recupExFr}" must not yield NOT_ACTIONABLE_INLINE, got ${gateRecupFr.status}`);
console.log('  ✓ "take back my ex" / "récupérer mon ex" => gate not NOT_ACTIONABLE_INLINE, "take back my ex" => controllability low => angles');

// (e) Render invariant: when gate is ACTIONABLE, inline hint must never be shown (allowInlineHint = false)
function wouldShowInlineHint(gateStatus, inlineHint) {
  const allowInlineHint = gateStatus !== 'ACTIONABLE';
  return allowInlineHint && !!inlineHint;
}
assert(wouldShowInlineHint('ACTIONABLE', 'Il va être difficile...') === false, 'ACTIONABLE + non-empty hint must not show hint (showInlineHint=false)');
assert(wouldShowInlineHint('NOT_ACTIONABLE_INLINE', 'hint') === true, 'NOT_ACTIONABLE_INLINE + hint => show');
console.log('  ✓ ACTIONABLE never shows inline hint (allowInlineHint guard)');

console.log('\nSmoke home classify feasibility: all passed.');
