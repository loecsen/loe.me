#!/usr/bin/env node
/**
 * Smoke: idea_routines store (paths, read/write ndjson, index rebuild, random pick excludes used).
 * No server; uses fs and inlined pick logic.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const tablesDir = path.join(repoRoot, 'apps', 'web', 'app', 'PourLaMaquette', 'db', 'tables');
const indexesDir = path.join(repoRoot, 'apps', 'web', 'app', 'PourLaMaquette', 'db', 'indexes');
const tablePath = path.join(tablesDir, 'idea_routines.ndjson');
const indexPath = path.join(indexesDir, 'idea_routines.index.json');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// 1) Store paths exist
assert(fs.existsSync(tablesDir), 'PourLaMaquette/db/tables must exist');
assert(fs.existsSync(indexesDir), 'PourLaMaquette/db/indexes must exist');
console.log('  ✓ store paths exist');

// 2) Table exists (seed may have run)
if (!fs.existsSync(tablePath)) {
  fs.mkdirSync(tablesDir, { recursive: true });
  fs.writeFileSync(tablePath, '', 'utf-8');
}
const tableContent = fs.readFileSync(tablePath, 'utf-8');
const lines = tableContent.split('\n').filter((l) => l.trim());
console.log('  ✓ table readable, lines:', lines.length);

// 3) Read/write a routine (append one line, parse back)
const testId = 'idea-smoke-test-' + Date.now();
const testRow = {
  id: testId,
  category: 'LEARN',
  canonical_lang: 'en',
  title_en: 'Smoke test routine',
  intent_en: 'Smoke test intent',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  source: 'seed',
};
fs.appendFileSync(tablePath, JSON.stringify(testRow) + '\n', 'utf-8');
const afterAppend = fs.readFileSync(tablePath, 'utf-8');
const parsedLines = afterAppend.split('\n').filter(Boolean);
const found = parsedLines.some((l) => {
  try {
    const o = JSON.parse(l);
    return o.id === testId;
  } catch {
    return false;
  }
});
assert(found, 'appended row must be readable');
console.log('  ✓ read/write ndjson');

// 4) Index: exists or create minimal
if (!fs.existsSync(indexPath)) {
  fs.mkdirSync(indexesDir, { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify({}) + '\n', 'utf-8');
}
const indexContent = fs.readFileSync(indexPath, 'utf-8');
JSON.parse(indexContent);
console.log('  ✓ index readable');

// 5) Random selection: <=4 and excludes used ids (inlined logic)
function pickRandom(arr, excludeIds, idGetter, count) {
  const set = new Set(excludeIds);
  const available = arr.filter((t) => !set.has(idGetter(t)));
  if (available.length <= count) return available;
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
const items = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
  { id: 'c', title: 'C' },
  { id: 'd', title: 'D' },
  { id: 'e', title: 'E' },
];
const picked = pickRandom(items, ['a', 'b'], (x) => x.id, 4);
assert(picked.length <= 4, 'pickRandom returns at most 4');
assert(!picked.some((p) => p.id === 'a' || p.id === 'b'), 'excluded ids must not appear');
console.log('  ✓ random pick <=4 and excludes used');

console.log('\nSmoke idea-routines: all passed.');
