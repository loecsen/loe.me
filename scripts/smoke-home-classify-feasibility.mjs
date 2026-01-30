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
const ambitionMod = transpileAndRun(path.join(repoRoot, 'apps', 'web', 'app', 'lib', 'actionability', 'ambitionConfirmation.ts'));

const { inferCategoryFromIntent, runActionabilityV2, toGateResult } = actionabilityMod;
const { categoryRequiresFeasibility } = categoryMod;
const { isLifeGoalOrRoleAspiration } = ambitionMod;

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

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
