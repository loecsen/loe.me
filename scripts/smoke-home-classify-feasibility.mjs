#!/usr/bin/env node
/**
 * Smoke: Home path uses classify for feasibility categories (LEARN/CREATE/WELLBEING)
 * and ambition block still has priority.
 * - "je veux récupérer mon ex copine car je suis triste" => category WELLBEING => classify path
 * - "apprendre chinois A2 90 jours" => category LEARN => classify path (no regression)
 * - "devenir champion du monde" => life-goal hit => ambition block (priority)
 * No network: validates inferCategoryFromIntent + categoryRequiresFeasibility + isLifeGoalOrRoleAspiration.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const repoRoot = path.resolve(process.cwd());

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

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const libDir = path.join(repoRoot, 'apps/web/app/lib');
const categoryMod = transpileAndRun(path.join(libDir, 'category.ts'));
const typesMod = transpileAndRun(path.join(libDir, 'actionability/types.ts'));
const customRequire = (id) => {
  if (id === './category' || id.endsWith('/category')) return categoryMod;
  if (id === './actionability/types' || id.endsWith('actionability/types')) return typesMod;
  return require(id);
};
const actionabilityMod = transpileAndRun(path.join(libDir, 'actionability.ts'), customRequire);
const ambitionMod = transpileAndRun(path.join(repoRoot, 'apps/web/app/lib/actionability/ambitionConfirmation.ts'));

const { inferCategoryFromIntent, runActionabilityV2, toGateResult } = actionabilityMod;
const { categoryRequiresFeasibility } = categoryMod;
const { isLifeGoalOrRoleAspiration } = ambitionMod;

// "je veux récupérer mon ex copine car je suis triste" => WELLBEING => feasibility => classify path
const exIntent = 'je veux récupérer mon ex copine car je suis triste';
const catEx = inferCategoryFromIntent(exIntent);
assert(catEx === 'WELLBEING', `inferCategoryFromIntent("${exIntent}") => WELLBEING, got ${catEx}`);
assert(categoryRequiresFeasibility(catEx), 'categoryRequiresFeasibility(WELLBEING) must be true');
const gateEx = toGateResult(runActionabilityV2(exIntent, 14));
assert(gateEx.status === 'ACTIONABLE', `gate for ex intent should be ACTIONABLE, got ${gateEx.status}`);
console.log('  ✓ "je veux récupérer mon ex copine..." => WELLBEING, ACTIONABLE => classify path');

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

console.log('\nSmoke home classify feasibility: all passed.');
