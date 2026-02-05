#!/usr/bin/env node
/**
 * Smoke: Tone gate (deterministic).
 * - "pizza" => playful or nonsense (playful_nonsense UI)
 * - "become a dragon" => playful_nonsense
 * - "write daily for 30 days" => serious (null => proceed)
 * - "get my ex back" => serious (null => not nonsense)
 * No server: tests detectToneDeterministic only.
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

const tonePath = path.join(libDir, 'actionability', 'tone.ts');
const toneMod = transpileAndRun(tonePath);
const { detectToneDeterministic } = toneMod;

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// "pizza" => playful or nonsense (playful_nonsense)
const pizzaResult = detectToneDeterministic('pizza', 'en');
assert(pizzaResult !== null, '"pizza" must return a tone result');
assert(
  (pizzaResult.tone === 'playful' || pizzaResult.tone === 'nonsense') && pizzaResult.confidence >= 0.85,
  `"pizza" => playful/nonsense with confidence >= 0.85, got tone=${pizzaResult.tone} confidence=${pizzaResult.confidence}`,
);
console.log('  ✓ "pizza" → playful_nonsense');

// "become a dragon" => playful
const dragonResult = detectToneDeterministic('become a dragon', 'en');
assert(dragonResult !== null, '"become a dragon" must return a tone result');
assert(
  dragonResult.tone === 'playful' && dragonResult.confidence >= 0.85,
  `"become a dragon" => playful, got tone=${dragonResult.tone} confidence=${dragonResult.confidence}`,
);
console.log('  ✓ "become a dragon" → playful_nonsense');

// "write daily for 30 days" => serious (null)
const writeResult = detectToneDeterministic('write daily for 30 days', 'en');
assert(writeResult === null, '"write daily for 30 days" => serious (null)');
console.log('  ✓ "write daily for 30 days" → serious');

// "get my ex back" => serious (null, not nonsense)
const exResult = detectToneDeterministic('get my ex back', 'en');
assert(exResult === null, '"get my ex back" => serious (null)');
console.log('  ✓ "get my ex back" → serious');

console.log('\nSmoke tone: all passed.');
