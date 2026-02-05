#!/usr/bin/env node
/**
 * Promote a draft prompt to published.
 * Usage: node scripts/promote-prompt.mjs <prompt_name>
 * Copies PourLaMaquette/prompts-drafts/<name>.json -> app/lib/prompts/published/<name>.json
 * Cwd-independent: repo root from script dir.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const appRoot = path.join(repoRoot, 'apps', 'web', 'app');
const draftsDir = path.join(appRoot, 'PourLaMaquette', 'prompts-drafts');
const publishedDir = path.join(appRoot, 'lib', 'prompts', 'published');

const name = process.argv[2];
if (!name || !/^[a-z0-9_]+$/i.test(name)) {
  console.error('Usage: node scripts/promote-prompt.mjs <prompt_name>');
  console.error('Example: node scripts/promote-prompt.mjs equivalence_judge_v1');
  process.exit(1);
}

const draftPath = path.join(draftsDir, `${name}.json`);
const publishedPath = path.join(publishedDir, `${name}.json`);

if (!fs.existsSync(draftPath)) {
  console.error(`Draft not found: ${draftPath}`);
  process.exit(1);
}

try {
  if (!fs.existsSync(publishedDir)) {
    fs.mkdirSync(publishedDir, { recursive: true });
  }
  const content = fs.readFileSync(draftPath, 'utf8');
  JSON.parse(content);
  fs.writeFileSync(publishedPath, content, 'utf8');
  console.log(`Promoted: ${draftPath} -> ${publishedPath}`);
} catch (err) {
  console.error(err.message ?? err);
  process.exit(1);
}
