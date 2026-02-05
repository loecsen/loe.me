#!/usr/bin/env node
/**
 * Smoke: Evaluation Harness. No network.
 * Asserts scenarios file exists with enough scenarios, eval store paths, admin page paths.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const appsWeb = path.join(repoRoot, 'apps', 'web', 'app');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// 1) lib/eval exists and has types + scenarios + runner
const libEval = path.join(appsWeb, 'lib', 'eval');
assert(fs.existsSync(libEval), 'lib/eval must exist');
assert(fs.existsSync(path.join(libEval, 'types.ts')), 'lib/eval/types.ts must exist');
assert(fs.existsSync(path.join(libEval, 'scenarios.ts')), 'lib/eval/scenarios.ts must exist');
assert(fs.existsSync(path.join(libEval, 'runner.ts')), 'lib/eval/runner.ts must exist');
console.log('  ✓ lib/eval structure');

const scenariosSource = fs.readFileSync(path.join(libEval, 'scenarios.ts'), 'utf8');
assert(scenariosSource.includes('EVAL_SCENARIOS'), 'scenarios.ts must export EVAL_SCENARIOS');
assert(scenariosSource.includes('MIN_SCENARIOS_PER_CATEGORY'), 'scenarios.ts must export MIN_SCENARIOS_PER_CATEGORY');
// Count scenario-like entries (id: '...') to ensure we have a reasonable set
const scenarioIdMatches = scenariosSource.match(/id:\s*['"][^'"]+['"]/g) ?? [];
assert(scenarioIdMatches.length >= 15, `scenarios.ts must define at least 15 scenarios (found ${scenarioIdMatches.length})`);
console.log('  ✓ scenarios file has EVAL_SCENARIOS and enough entries');

// 2) eval store
assert(fs.existsSync(path.join(appsWeb, 'lib', 'db', 'evalStore.file.ts')), 'lib/db/evalStore.file.ts must exist');
const evalStoreSource = fs.readFileSync(path.join(appsWeb, 'lib', 'db', 'evalStore.file.ts'), 'utf8');
assert(evalStoreSource.includes('upsertEvalRun'), 'evalStore must export upsertEvalRun');
assert(evalStoreSource.includes('listEvalRuns'), 'evalStore must export listEvalRuns');
assert(evalStoreSource.includes('searchEvalRuns'), 'evalStore must export searchEvalRuns');
assert(evalStoreSource.includes('rebuildEvalIndex'), 'evalStore must export rebuildEvalIndex');
console.log('  ✓ eval store exports');

// 3) PourLaMaquette/db tables + indexes (paths used by fileStore)
const dbRoot = path.join(appsWeb, 'PourLaMaquette', 'db');
assert(fs.existsSync(dbRoot), 'PourLaMaquette/db must exist');
assert(fs.existsSync(path.join(dbRoot, 'tables')), 'PourLaMaquette/db/tables must exist');
assert(fs.existsSync(path.join(dbRoot, 'indexes')), 'PourLaMaquette/db/indexes must exist');
console.log('  ✓ PourLaMaquette/db paths (eval_runs table/index created on first write)');

// 4) Admin eval page
assert(fs.existsSync(path.join(appsWeb, 'admin', 'eval', 'page.tsx')), 'admin/eval/page.tsx must exist');
assert(fs.existsSync(path.join(appsWeb, 'admin', 'eval', 'page.module.css')), 'admin/eval/page.module.css must exist');
const adminEvalSource = fs.readFileSync(path.join(appsWeb, 'admin', 'eval', 'page.tsx'), 'utf8');
assert(adminEvalSource.includes('EvalRunResultV1'), 'Admin eval page must use EvalRunResultV1');
assert(adminEvalSource.includes('/api/eval/run'), 'Admin eval page must call eval run API');
assert(adminEvalSource.includes('/api/eval/runs'), 'Admin eval page must call eval runs API');
console.log('  ✓ Admin eval page and imports');

// 5) API routes
assert(fs.existsSync(path.join(appsWeb, 'api', 'eval', 'run', 'route.ts')), 'api/eval/run/route.ts must exist');
assert(fs.existsSync(path.join(appsWeb, 'api', 'eval', 'runs', 'route.ts')), 'api/eval/runs/route.ts must exist');
assert(fs.existsSync(path.join(appsWeb, 'api', 'eval', 'indexes', 'rebuild', 'route.ts')), 'api/eval/indexes/rebuild/route.ts must exist');
console.log('  ✓ Eval API routes');

console.log('\nSmoke eval: all passed.');
