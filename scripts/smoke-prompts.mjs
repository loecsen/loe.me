#!/usr/bin/env node
/**
 * Smoke: Prompt store and JSON shape.
 * Validates lib/prompts/store, published/drafts dirs, required fields. No network.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const appRoot = path.join(repoRoot, 'apps', 'web', 'app');
const publishedDir = path.join(appRoot, 'lib', 'prompts', 'published');
const draftsDir = path.join(appRoot, 'PourLaMaquette', 'prompts-drafts');

const REQUIRED_FIELDS = ['name', 'version', 'purpose_en', 'user_template'];

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(fs.existsSync(publishedDir), `Published dir must exist: ${publishedDir}`);
console.log('  ✓ lib/prompts/published exists');

if (fs.existsSync(draftsDir)) {
  console.log('  ✓ PourLaMaquette/prompts-drafts exists');
} else {
  console.log('  ✓ PourLaMaquette/prompts-drafts (optional)');
}

const publishedFiles = fs.readdirSync(publishedDir).filter((f) => f.endsWith('.json'));
for (const f of publishedFiles) {
  const filePath = path.join(publishedDir, f);
  const raw = fs.readFileSync(filePath, 'utf8');
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    assert(false, `${f}: invalid JSON`);
  }
  for (const key of REQUIRED_FIELDS) {
    assert(obj[key] != null, `${f}: missing required field "${key}"`);
  }
  assert(typeof obj.user_template === 'string', `${f}: user_template must be non-empty string for published`);
  assert(obj.user_template.trim().length > 0, `${f}: user_template must be non-empty for published`);
}
console.log(`  ✓ ${publishedFiles.length} published prompt(s) valid`);

if (fs.existsSync(draftsDir)) {
  const draftFiles = fs.readdirSync(draftsDir).filter((f) => f.endsWith('.json'));
  for (const f of draftFiles) {
    const filePath = path.join(draftsDir, f);
    const raw = fs.readFileSync(filePath, 'utf8');
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      assert(false, `draft ${f}: invalid JSON`);
    }
    for (const key of REQUIRED_FIELDS) {
      assert(obj[key] != null, `draft ${f}: missing required field "${key}"`);
    }
  }
  console.log(`  ✓ ${draftFiles.length} draft prompt(s) valid (empty prompt text allowed)`);
}

console.log('\nSmoke prompts: all passed.');
