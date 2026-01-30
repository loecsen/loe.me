#!/usr/bin/env node
/**
 * Smoke: playbooks registry.
 * - All playbook ids are unique
 * - Required ui_modes exist: INLINE_HINT_REPHRASE, INLINE_CONFIRM_BIG_ASPIRATION,
 *   INLINE_TWO_PATHS_CONTROL, INLINE_SOFT_REALISM_KEEP_ADJUST, PROCEED_GENERATE, BLOCKED_SAFETY
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

function loadTsModule(relativePath) {
  const filePath = path.join(repoRoot, 'apps/web/app/lib', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const ts = require('typescript');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  const wrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  wrapper(mod.exports, require, mod, filePath, path.dirname(filePath));
  return mod.exports;
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const taxonomyPlaybooks = loadTsModule('taxonomy/playbooks.ts');

const { PLAYBOOK_DOCS, PLAYBOOK_UI_MODES } = taxonomyPlaybooks;

const requiredModes = [
  'INLINE_HINT_REPHRASE',
  'INLINE_CONFIRM_BIG_ASPIRATION',
  'INLINE_TWO_PATHS_CONTROL',
  'INLINE_SOFT_REALISM_KEEP_ADJUST',
  'PROCEED_GENERATE',
  'BLOCKED_SAFETY',
];

const ids = PLAYBOOK_DOCS.map((p) => p.id);
const uniqueIds = new Set(ids);
assert(ids.length === uniqueIds.size, `Playbook ids must be unique; got ${ids.length} docs, ${uniqueIds.size} unique`);

for (const mode of requiredModes) {
  const found = PLAYBOOK_DOCS.some((p) => p.ui_mode === mode);
  assert(found, `Required playbook with ui_mode "${mode}" must exist`);
}

assert(PLAYBOOK_UI_MODES.length >= 6, `Expected at least 6 ui_modes, got ${PLAYBOOK_UI_MODES.length}`);

console.log('smoke-playbooks: OK');
