#!/usr/bin/env node
/**
 * Smoke: taxonomy categories registry.
 * - All 6 categories exist
 * - Each has requires_feasibility_eval boolean
 * - Each has default_playbook_id existing in playbooks
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

function loadTsModule(relativePath, customRequire) {
  const filePath = path.join(repoRoot, 'apps/web/app/lib', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const ts = require('typescript');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  const wrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  wrapper(mod.exports, customRequire ?? require, mod, filePath, path.dirname(filePath));
  return mod.exports;
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const taxonomyCategories = loadTsModule('taxonomy/categories.ts');
const taxonomyPlaybooks = loadTsModule('taxonomy/playbooks.ts');

const { CATEGORY_DOCS, categoryRequiresFeasibility } = taxonomyCategories;
const { PLAYBOOK_DOCS } = taxonomyPlaybooks;

const playbookIds = new Set(PLAYBOOK_DOCS.map((p) => p.id));

assert(CATEGORY_DOCS.length === 6, `Expected 6 categories, got ${CATEGORY_DOCS.length}`);

for (const doc of CATEGORY_DOCS) {
  assert(
    typeof doc.requires_feasibility_eval === 'boolean',
    `Category ${doc.id} must have requires_feasibility_eval boolean`,
  );
  assert(
    doc.default_playbook_id != null && doc.default_playbook_id !== '',
    `Category ${doc.id} must have default_playbook_id`,
  );
  assert(
    playbookIds.has(doc.default_playbook_id),
    `Category ${doc.id} default_playbook_id "${doc.default_playbook_id}" must exist in playbooks`,
  );
}

assert(categoryRequiresFeasibility('LEARN') === true, 'LEARN must require feasibility');
assert(categoryRequiresFeasibility('WELLBEING') === true, 'WELLBEING must require feasibility');
assert(categoryRequiresFeasibility('PERFORM') === false, 'PERFORM must not require feasibility');

console.log('smoke-taxonomy: OK');
