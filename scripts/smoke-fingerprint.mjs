#!/usr/bin/env node
/**
 * Smoke: Intent fingerprint — equivalent intents yield same fp (e.g. "apprendre à faire de la couture" vs "apprendre la couture").
 * No network. Deterministic.
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

const fingerprintPath = path.join(libDir, 'intent', 'fingerprint.ts');
const fingerprintMod = transpileAndRun(fingerprintPath, require);
const { computeIntentFingerprint } = fingerprintMod;

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const intentA = 'apprendre à faire de la couture';
const intentB = 'apprendre la couture';
const fpA = computeIntentFingerprint(intentA, 'fr', null);
const fpB = computeIntentFingerprint(intentB, 'fr', null);

assert(typeof fpA.fp === 'string', 'fpA.fp must be string');
assert(typeof fpB.fp === 'string', 'fpB.fp must be string');
assert(fpA.fp.includes('couture'), `fp for "${intentA}" should contain "couture", got fp="${fpA.fp}"`);
assert(fpB.fp.includes('couture'), `fp for "${intentB}" should contain "couture", got fp="${fpB.fp}"`);
assert(fpA.fp === fpB.fp, `Equivalent intents must yield same fp: "${fpA.fp}" !== "${fpB.fp}"`);

console.log('  ✓ computeIntentFingerprint: equivalent FR intents → same fp');
console.log(`    "${intentA}" → fp=${fpA.fp}`);
console.log(`    "${intentB}" → fp=${fpB.fp}`);
console.log('smoke-fingerprint OK');
