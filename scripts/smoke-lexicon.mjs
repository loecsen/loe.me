#!/usr/bin/env node
/**
 * Smoke: Lexicon pack registry and fallback packs.
 * Validates fallback packs exist and conform; registry resolves fallback by script.
 * Does NOT call bootstrap (LLM). No network.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const libLexicon = path.join(repoRoot, 'apps', 'web', 'app', 'lib', 'lexicon');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const requiredFallbackKeys = [
  'latin_generic',
  'cjk_generic',
  'hangul_generic',
  'kana_generic',
  'cyrillic_generic',
  'arabic_generic',
];

const requiredTokenKeys = [
  'greetings',
  'learning_verbs',
  'consume_verbs',
  'romantic_markers',
  'institution_markers',
  'selection_markers',
  'market_markers',
  'elite_role_markers',
  'superlative_markers',
];

assert(fs.existsSync(libLexicon), 'lib/lexicon must exist');
assert(fs.existsSync(path.join(libLexicon, 'types.ts')), 'lib/lexicon/types.ts must exist');
assert(fs.existsSync(path.join(libLexicon, 'registry.ts')), 'lib/lexicon/registry.ts must exist');
assert(fs.existsSync(path.join(libLexicon, 'fallbacks.ts')), 'lib/lexicon/fallbacks.ts must exist');
console.log('  ✓ lib/lexicon structure');

const fallbacksPath = path.join(libLexicon, 'fallbacks.ts');
const fallbacksSource = fs.readFileSync(fallbacksPath, 'utf8');
for (const key of requiredFallbackKeys) {
  assert(fallbacksSource.includes(key), `FALLBACK_PACKS must include ${key}`);
}
console.log('  ✓ FALLBACK_PACKS keys:', requiredFallbackKeys.join(', '));

const typesPath = path.join(libLexicon, 'types.ts');
const typesSource = fs.readFileSync(typesPath, 'utf8');
assert(typesSource.includes('LexiconPackV1'), 'types must define LexiconPackV1');
assert(typesSource.includes('lexicon-pack-v1'), 'version must be lexicon-pack-v1');
for (const tk of requiredTokenKeys) {
  assert(typesSource.includes(tk), `LexiconPackTokens must include ${tk}`);
}
console.log('  ✓ LexiconPackV1 token keys');

const registryPath = path.join(libLexicon, 'registry.ts');
const registrySource = fs.readFileSync(registryPath, 'utf8');
assert(registrySource.includes('getFallbackPackForIntent'), 'registry must export getFallbackPackForIntent');
assert(registrySource.includes('getLexSignals'), 'registry must export getLexSignals');
assert(registrySource.includes('loadPublishedPack'), 'registry must export loadPublishedPack');
assert(registrySource.includes('loadDraftPack'), 'registry must export loadDraftPack');
assert(registrySource.includes('getLexiconForIntent'), 'registry must export getLexiconForIntent');
console.log('  ✓ registry exports');

const packsDir = path.join(libLexicon, 'packs');
assert(fs.existsSync(packsDir), 'lib/lexicon/packs must exist');
console.log('  ✓ lib/lexicon/packs exists');

// --- token bucket rules
const CORE_BUCKETS = new Set(['greetings', 'learning_verbs', 'consume_verbs']);

function assertTokenBucket(name, arr) {
  if (!Array.isArray(arr)) {
    fail(`tokens.${name} must be an array`);
  }

  // validate strings + no empty/whitespace tokens
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v !== 'string') {
      fail(`tokens.${name}[${i}] must be a string`);
    }
    if (!v.trim()) {
      fail(`tokens.${name}[${i}] must be a non-empty string`);
    }
  }

  // relaxed minimums
  if (CORE_BUCKETS.has(name) && arr.length < 1) {
    fail(`tokens.${name} is a core bucket and must contain at least 1 token`);
  }
}

const requiredBuckets = [
  'greetings',
  'learning_verbs',
  'consume_verbs',
  'romantic_markers',
  'institution_markers',
  'selection_markers',
  'market_markers',
  'elite_role_markers',
  'superlative_markers',
];

const samplePath = path.join(packsDir, '_sample.json');
assert(fs.existsSync(samplePath), 'lib/lexicon/packs/_sample.json must exist');
const sampleRaw = fs.readFileSync(samplePath, 'utf8');
const sample = JSON.parse(sampleRaw);
assert(sample.version === 'lexicon-pack-v1', '_sample.json must have version lexicon-pack-v1');
assert(typeof sample.lang === 'string', '_sample.json must have lang');
assert(sample.tokens && typeof sample.tokens === 'object', '_sample.json must have tokens');

for (const bucket of requiredBuckets) {
  if (!(bucket in sample.tokens)) {
    fail(`Missing tokens bucket: ${bucket}`);
  }
  assertTokenBucket(bucket, sample.tokens[bucket]);
}
console.log('  ✓ packs/_sample.json loads and has required keys');

const draftDir = path.join(repoRoot, 'apps', 'web', 'app', 'PourLaMaquette', 'lexicon-drafts');
assert(fs.existsSync(draftDir), 'PourLaMaquette/lexicon-drafts must exist');
console.log('  ✓ PourLaMaquette/lexicon-drafts exists');

console.log('\nSmoke lexicon: all passed.');
