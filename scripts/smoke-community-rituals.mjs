#!/usr/bin/env node
/**
 * Smoke: community rituals seed file exists, parses, and has at least 1 ritual per category in FR.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const seedPath = path.join(
  repoRoot,
  'apps',
  'web',
  'app',
  'PourLaMaquette',
  'community-rituals',
  'community_rituals_v1.ndjson',
);

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(fs.existsSync(seedPath), 'community_rituals_v1.ndjson must exist');
console.log('  ✓ seed file exists');

const raw = fs.readFileSync(seedPath, 'utf-8');
const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
const rituals = lines.map((l) => {
  try {
    return JSON.parse(l);
  } catch (e) {
    throw new Error('Invalid NDJSON line: ' + e.message);
  }
});
assert(rituals.length >= 1, 'at least 1 ritual in seed');
console.log('  ✓ seed parses, count:', rituals.length);

const categories = ['LEARN', 'CREATE', 'PERFORM', 'WELLBEING', 'SOCIAL', 'CHALLENGE'];
const frRituals = rituals.filter((r) => (r.ui_locale || '').toLowerCase().startsWith('fr'));
const byCategory = {};
for (const c of categories) {
  byCategory[c] = frRituals.filter((r) => r.category === c).length;
}
const missing = categories.filter((c) => (byCategory[c] || 0) === 0);
assert(missing.length === 0, 'FR beta: at least 1 ritual per category; missing: ' + missing.join(', '));
console.log('  ✓ at least 1 FR ritual per category');

console.log('\nSmoke community-rituals: all passed.');
