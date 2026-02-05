#!/usr/bin/env node
/**
 * Promote a draft lexicon pack from PourLaMaquette/lexicon-drafts to lib/lexicon/packs.
 * Usage: node scripts/promote-lexicon-pack.mjs <lang>
 * Example: node scripts/promote-lexicon-pack.mjs ro
 * Prints suggested `git add` commands.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const lang = process.argv[2];
if (!lang || !/^[a-z]{2}(-[a-z0-9]+)?$/i.test(lang)) {
  console.error('Usage: node scripts/promote-lexicon-pack.mjs <lang>');
  console.error('Example: node scripts/promote-lexicon-pack.mjs ro');
  process.exit(1);
}

const langCode = lang.split('-')[0];
const draftPath = path.join(repoRoot, 'apps', 'web', 'app', 'PourLaMaquette', 'lexicon-drafts', `${langCode}.json`);
const publishedPath = path.join(repoRoot, 'apps', 'web', 'app', 'lib', 'lexicon', 'packs', `${langCode}.json`);

if (!fs.existsSync(draftPath)) {
  console.error(`Draft not found: ${draftPath}`);
  process.exit(1);
}

const publishedDir = path.dirname(publishedPath);
if (!fs.existsSync(publishedDir)) {
  fs.mkdirSync(publishedDir, { recursive: true });
}

const content = fs.readFileSync(draftPath, 'utf8');
fs.writeFileSync(publishedPath, content, 'utf8');
console.log(`Promoted ${langCode}.json to lib/lexicon/packs/`);
console.log('');
console.log('Suggested git commands:');
console.log(`  git add apps/web/app/lib/lexicon/packs/${langCode}.json`);
console.log(`  git add scripts/promote-lexicon-pack.mjs`);
console.log('(Optionally remove draft after verification: git rm apps/web/app/PourLaMaquette/lexicon-drafts/' + langCode + '.json)');
