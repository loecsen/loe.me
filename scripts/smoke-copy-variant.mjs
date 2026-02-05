#!/usr/bin/env node
/**
 * Smoke: Copy variant resolver (no network).
 * - tone=nonsense => support_playful_nonsense
 * - ui_outcome=needs_clarify => support_unclear_goal
 * - controllability_reason_code=romantic_outcome => support_external_outcome
 * - no signals => support_generic_angles
 * - pizza must never show external_outcome (tone wins)
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

const copyVariantPath = path.join(libDir, 'gates', 'copyVariant.ts');
const copyVariantMod = transpileAndRun(copyVariantPath);
const { resolveCopyVariant } = copyVariantMod;

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// tone=nonsense => support_playful_nonsense (NOT external_outcome)
const nonsenseResult = resolveCopyVariant({ tone: 'nonsense', ui_outcome: 'show_angles' });
assert(
  nonsenseResult.variant === 'support_playful_nonsense',
  `tone=nonsense => support_playful_nonsense, got ${nonsenseResult.variant}`,
);
console.log('  ✓ tone=nonsense → support_playful_nonsense');

// tone=playful => support_playful_nonsense
const playfulResult = resolveCopyVariant({ tone: 'playful', ui_outcome: 'show_angles' });
assert(
  playfulResult.variant === 'support_playful_nonsense',
  `tone=playful => support_playful_nonsense, got ${playfulResult.variant}`,
);
console.log('  ✓ tone=playful → support_playful_nonsense');

// ui_outcome=needs_clarify => support_unclear_goal
const clarifyResult = resolveCopyVariant({ ui_outcome: 'needs_clarify' });
assert(
  clarifyResult.variant === 'support_unclear_goal',
  `ui_outcome=needs_clarify => support_unclear_goal, got ${clarifyResult.variant}`,
);
console.log('  ✓ ui_outcome=needs_clarify → support_unclear_goal');

// controllability_reason_code=romantic_outcome => support_external_outcome
const romanticResult = resolveCopyVariant({
  tone: 'serious',
  ui_outcome: 'show_angles',
  controllability_reason_code: 'romantic_outcome',
});
assert(
  romanticResult.variant === 'support_external_outcome',
  `controllability_reason_code=romantic_outcome => support_external_outcome, got ${romanticResult.variant}`,
);
console.log('  ✓ controllability_reason_code=romantic_outcome → support_external_outcome');

// no signals / unknown => support_generic_angles
const genericResult = resolveCopyVariant({
  tone: 'serious',
  ui_outcome: 'show_angles',
  controllability_reason_code: null,
  classify_reason_code: null,
});
assert(
  genericResult.variant === 'support_generic_angles',
  `no mapped reason_code => support_generic_angles, got ${genericResult.variant}`,
);
console.log('  ✓ no mapped reason_code → support_generic_angles');

// blocked does NOT map to support_unclear_goal; copy variants apply to supportive flows only
const blockedResult = resolveCopyVariant({ audience_safety_level: 'blocked' });
assert(
  blockedResult.variant === 'support_generic_angles',
  `blocked must not map to unclear; got ${blockedResult.variant} (expected support_generic_angles)`,
);
assert(
  blockedResult.variant !== 'support_unclear_goal',
  'blocked must not be treated as unclear goal',
);
console.log('  ✓ audience_safety_level=blocked → support_generic_angles (blocked handled by blocked UI)');

console.log('\nSmoke copy variant: all passed.');
