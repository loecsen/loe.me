#!/usr/bin/env node
/**
 * Smoke: normalizeRitualPlan enforces 1 day = 1 step, 7 steps per level.
 * No network: transpiles TS locally and runs deterministic checks.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const targetPath = path.join(
  repoRoot,
  'apps',
  'web',
  'app',
  'lib',
  'rituals',
  'normalizeRitualPlan.ts',
);

function transpileAndRun(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  const wrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  wrapper(mod.exports, require, mod, filePath, path.dirname(filePath));
  return mod.exports;
}

const { normalizeRitualPlan } = transpileAndRun(targetPath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makePlan(stepCount) {
  return {
    levels: [
      {
        title: 'Level A',
        steps: Array.from({ length: stepCount }, (_, i) => ({
          title: `Step ${i + 1}`,
          competencyId: 'comp-1',
          axis: 'understand',
          effortType: 'practice',
          durationMin: 5,
          required: true,
        })),
      },
    ],
    competencies: [{ id: 'comp-1' }],
  };
}

const case7 = normalizeRitualPlan(makePlan(7), 7, { stepsPerLevel: 7, locale: 'en' });
assert(case7.plan.levels.length === 1, 'days=7 should yield 1 level');
assert(case7.plan.levels[0].steps.length === 7, 'days=7 should yield 7 steps');
assert(case7.plan.levels[0].steps[6].id === 'step-1-7', 'step-1-7 should exist');

const case14 = normalizeRitualPlan(makePlan(14), 14, { stepsPerLevel: 7, locale: 'en' });
assert(case14.plan.levels.length === 2, 'days=14 should yield 2 levels');
assert(case14.plan.levels[1].steps[6].id === 'step-2-7', 'step-2-7 should exist');

const case10 = normalizeRitualPlan(makePlan(10), 10, { stepsPerLevel: 7, locale: 'en' });
assert(case10.plan.levels.length === 2, 'days=10 should yield 2 levels');
assert(case10.plan.levels[1].steps.length === 3, 'days=10 should yield 7 + 3 steps');

const tooLong = normalizeRitualPlan(makePlan(12), 10, { stepsPerLevel: 7, locale: 'en' });
assert(tooLong.plan.levels.length === 2, 'over production keeps levels based on totalSteps');
assert(tooLong.plan.levels[1].steps.length === 3, 'over production truncates to 10 steps');

const tooShort = normalizeRitualPlan(makePlan(6), 10, { stepsPerLevel: 7, locale: 'en' });
const autofilled = tooShort.plan.levels.flatMap((level) => level.steps).filter((step) => step.is_autofill === true);
assert(autofilled.length === 4, 'under production should auto-fill to 10');

console.log('smoke-normalize-ritual-plan: ok');
