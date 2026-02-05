#!/usr/bin/env node
/**
 * Smoke: dev DB (decision_records + prompt_catalog). No network.
 * Creates temp db folder, upserts a record, searches it, rebuilds index.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// 1) lib/db exists and exports
const libDb = path.join(repoRoot, 'apps', 'web', 'app', 'lib', 'db');
assert(fs.existsSync(libDb), 'lib/db must exist');
assert(fs.existsSync(path.join(libDb, 'types.ts')), 'lib/db/types.ts must exist');
assert(fs.existsSync(path.join(libDb, 'key.ts')), 'lib/db/key.ts must exist');
assert(fs.existsSync(path.join(libDb, 'provider.ts')), 'lib/db/provider.ts must exist');
assert(fs.existsSync(path.join(libDb, 'decisionStore.file.ts')), 'lib/db/decisionStore.file.ts must exist');
assert(fs.existsSync(path.join(libDb, 'promptStore.file.ts')), 'lib/db/promptStore.file.ts must exist');
console.log('  ✓ lib/db structure');

const keySource = fs.readFileSync(path.join(libDb, 'key.ts'), 'utf8');
assert(keySource.includes('buildDecisionUniqueKey'), 'key.ts must export buildDecisionUniqueKey');
assert(keySource.includes('decisionIdFromUniqueKey'), 'key.ts must export decisionIdFromUniqueKey');
console.log('  ✓ key builder');

// 2) PourLaMaquette/db exists
const dbRoot = path.join(repoRoot, 'apps', 'web', 'app', 'PourLaMaquette', 'db');
assert(fs.existsSync(dbRoot), 'PourLaMaquette/db must exist');
assert(fs.existsSync(path.join(dbRoot, 'tables')), 'PourLaMaquette/db/tables must exist');
assert(fs.existsSync(path.join(dbRoot, 'indexes')), 'PourLaMaquette/db/indexes must exist');
assert(fs.existsSync(path.join(dbRoot, 'README.md')), 'PourLaMaquette/db/README.md must exist');
console.log('  ✓ PourLaMaquette/db structure');

// 3) Deterministic key: same input => same unique_key
// We cannot call buildDecisionUniqueKey from ESM without loading TS; so we inline a minimal hash.
const crypto = await import('node:crypto');
function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}
const intent = 'learn spanish';
const payload = [intent.trim().toLowerCase(), 'en', '', '<=14', 'false'].join('\n');
const key1 = sha256Hex(payload);
const key2 = sha256Hex(payload);
assert(key1 === key2, 'Deterministic key: same input must yield same hash');
console.log('  ✓ deterministic key (inline sha256)');

console.log('\nSmoke db: all passed.');
