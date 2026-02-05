#!/usr/bin/env node
/**
 * Smoke: Audience safety gate (deterministic path).
 * - "Pratiquer le Kamasutra" → adult_only
 * - "How to make a bomb" → blocked
 * - "Do a detox program" → all_ages (deterministic returns null; API would return all_ages)
 * No server: tests hard checks + heuristics only (assessAudienceSafetyDeterministic).
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

function transpileAndRun(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  fn(mod.exports, require, mod, filePath, path.dirname(filePath));
  return mod.exports;
}

const audienceSafetyPath = path.join(libDir, 'actionability', 'audienceSafety.ts');
const audienceSafetyMod = transpileAndRun(audienceSafetyPath);
const { assessAudienceSafetyDeterministic } = audienceSafetyMod;

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// "How to make a bomb" → blocked
const bombResult = assessAudienceSafetyDeterministic('How to make a bomb');
assert(bombResult !== null, 'assessAudienceSafetyDeterministic("How to make a bomb") must return a result');
assert(bombResult.level === 'blocked', `"How to make a bomb" => blocked, got ${bombResult.level}`);
assert(bombResult.reason_code === 'explosives_howto', `reason_code => explosives_howto, got ${bombResult.reason_code}`);
console.log('  ✓ "How to make a bomb" → blocked (explosives_howto)');

// "Pratiquer le Kamasutra" → adult_only
const kamaResult = assessAudienceSafetyDeterministic('Pratiquer le Kamasutra');
assert(kamaResult !== null, 'assessAudienceSafetyDeterministic("Pratiquer le Kamasutra") must return a result');
assert(kamaResult.level === 'adult_only', `"Pratiquer le Kamasutra" => adult_only, got ${kamaResult.level}`);
console.log('  ✓ "Pratiquer le Kamasutra" → adult_only');

// "Do a detox program" → deterministic returns null (API would return all_ages)
const detoxResult = assessAudienceSafetyDeterministic('Do a detox program');
assert(detoxResult === null, '"Do a detox program" => deterministic null (all_ages from API)');
console.log('  ✓ "Do a detox program" → all_ages (deterministic null, API path)');

// pizza/dragon etc. are NOT in audience_safety allowlist; tone gate handles them
const pizzaResult = assessAudienceSafetyDeterministic('pizza');
assert(pizzaResult === null, '"pizza" => deterministic null (tone gate handles; not blocked)');
console.log('  ✓ "pizza" → deterministic null (tone gate handles nonsense)');

console.log('\nSmoke audience safety: all passed.');
