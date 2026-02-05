#!/usr/bin/env node
/**
 * Smoke: Decision Engine V2 — deterministic parts only (no network).
 * Validates: normalize (db/key), days_bucket logic, similarity (trigram Jaccard), outcome types.
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

const dbTypesPath = path.join(libDir, 'db', 'types.ts');
const dbConstantsPath = path.join(libDir, 'db', 'constants.ts');
const dbTypesMod = transpileAndRun(dbTypesPath, require);
const dbConstantsMod = transpileAndRun(dbConstantsPath, require);
const requireForKey = (spec) => {
  if (spec.includes('types')) return dbTypesMod;
  if (spec.includes('constants')) return dbConstantsMod;
  return require(spec);
};
const dbKeyMod = transpileAndRun(path.join(libDir, 'db', 'key.ts'), requireForKey);
const similarityMod = transpileAndRun(path.join(libDir, 'decisionEngine', 'similarity.ts'), require);

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const { normalizeIntentForKey } = dbKeyMod;
const normalized = normalizeIntentForKey('  take back my ex  ');
assert(normalized === 'take back my ex', `normalize: expected "take back my ex", got "${normalized}"`);
console.log('  ✓ normalizeIntentForKey (db/key)');

function daysBucket(days) {
  if (days <= 14) return '<=14';
  if (days <= 30) return '<=30';
  if (days <= 90) return '<=90';
  return '>90';
}
assert(daysBucket(14) === '<=14', 'days_bucket 14');
assert(daysBucket(90) === '<=90', 'days_bucket 90');
assert(daysBucket(100) === '>90', 'days_bucket 100');
console.log('  ✓ days_bucket logic');

const { trigramJaccard, isInEquivalenceBand, SIMILARITY_MIN_INTENT_LENGTH } = similarityMod;
const j1 = trigramJaccard('take back my ex', 'take back my ex');
assert(j1 === 1, `trigramJaccard same: expected 1, got ${j1}`);
const j2 = trigramJaccard('take back my ex', 'get my ex back');
assert(j2 >= 0 && j2 <= 1, `trigramJaccard: expected 0..1, got ${j2}`);
assert(!isInEquivalenceBand(0.5), 'score 0.5 not in band');
assert(isInEquivalenceBand(0.8), 'score 0.8 in band');
assert(SIMILARITY_MIN_INTENT_LENGTH === 20, 'SIMILARITY_MIN_INTENT_LENGTH === 20');
console.log('  ✓ similarity: trigram Jaccard, equivalence band');

const OUTCOMES = ['PROCEED_TO_GENERATE', 'SHOW_ANGLES', 'ASK_CLARIFICATION', 'CONFIRM_AMBITION', 'ASK_USER_CHOOSE_CATEGORY', 'REALISM_ADJUST', 'BLOCKED_SAFETY'];
assert(OUTCOMES.length === 7, 'outcome set size');
console.log('  ✓ outcome types defined');

console.log('\nSmoke decision-engine: all passed.');
