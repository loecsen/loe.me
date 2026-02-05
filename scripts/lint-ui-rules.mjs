#!/usr/bin/env node
/**
 * Règles UI pragmatiques (docs/ui-blueprint.md)
 * - style={{ }} interdit dans packages/ui sauf ligne précédente avec "ui-blueprint" ou objet réduit à une var CSS (--*)
 * - couleurs hex/rgba/hsl interdites dans .css hors :root et hors commentaires
 * - si modif actionability/realism/confirmation/classifier, le diff doit inclure registry (lib/rules)
 * Usage: node scripts/lint-ui-rules.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const uiRoot = path.join(repoRoot, 'packages', 'ui', 'src');

const errors = [];

function walk(dir, ext, fn) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, ext, fn);
    else if (e.name.endsWith(ext)) fn(full);
  }
}

// En .tsx : interdire style={{ sauf ligne précédente avec "ui-blueprint"
walk(uiRoot, '.tsx', (file) => {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('style={{')) continue;
    if (line.trimStart().startsWith('//')) continue;
    const prev = lines[i - 1]?.trim() ?? '';
    if (prev.includes('ui-blueprint')) continue;
    errors.push(`${file}:${i + 1}: style={{}} interdit (docs/ui-blueprint.md). Utiliser classes var(--loe-*) ou commentaire "ui-blueprint".`);
  }
});

// En .css : interdire couleurs en dur hors :root et hors commentaires
walk(uiRoot, '.css', (file) => {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  let depth = 0;
  let inRoot = false;
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('/*')) inBlockComment = true;
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('//')) continue;
    if (/^\s*:root\s*\{/.test(line)) {
      inRoot = true;
      depth = 1;
    } else {
      for (const c of line) {
        if (c === '{') depth++;
        if (c === '}') {
          depth--;
          if (depth === 0) inRoot = false;
        }
      }
    }
    const hasHex = /#[0-9a-fA-F]{3,8}\b/.test(line) || (/rgba?\([^)]+\)/.test(line) && !line.trimStart().startsWith('--loe-')) || /hsla?\([^)]+\)/.test(line);
    if (hasHex && !inRoot) {
      errors.push(`${file}:${i + 1}: couleur en dur interdite (docs/ui-blueprint.md). Utiliser var(--loe-color-*).`);
    }
  }
});

// Anti-fuite mock : seul apps/web/app/page.tsx peut importer PourLaMaquette
const appRoot = path.join(__dirname, '..', 'apps', 'web', 'app');
const mockDir = path.join(appRoot, 'PourLaMaquette');
const allowedMockImporters = [
  path.join(appRoot, 'page.tsx'),
  path.join(appRoot, 'lib', 'lexicon', 'registry.ts'), // path-only reference to PourLaMaquette/lexicon-drafts
];

function walkAll(dir, ext, fn) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkAll(full, ext, fn);
    else if (e.name.endsWith(ext)) fn(full);
  }
}

function isAllowedMockImporter(file) {
  const normalized = path.normalize(file);
  return allowedMockImporters.some((allowed) => path.normalize(allowed) === normalized);
}

function hasMockImport(content) {
  return /from\s+['"].*PourLaMaquette|import\s+.*PourLaMaquette/.test(content);
}

walkAll(appRoot, '.tsx', (file) => {
  if (file.startsWith(mockDir + path.sep)) return; // fichiers dans PourLaMaquette exclus
  const content = fs.readFileSync(file, 'utf-8');
  if (hasMockImport(content) && !isAllowedMockImporter(file)) {
    const relative = path.relative(path.join(__dirname, '..'), file);
    errors.push(`Mock leak detected: ${relative} imports PourLaMaquette. Only Home provider may import mocks.`);
  }
});

walkAll(appRoot, '.ts', (file) => {
  if (file.startsWith(mockDir + path.sep)) return;
  const content = fs.readFileSync(file, 'utf-8');
  if (hasMockImport(content) && !isAllowedMockImporter(file)) {
    const relative = path.relative(path.join(__dirname, '..'), file);
    errors.push(`Mock leak detected: ${relative} imports PourLaMaquette. Only Home provider may import mocks.`);
  }
});

// No direct import of PourLaMaquette/db outside PourLaMaquette (only lib/db provider uses path)
function hasDbImport(content) {
  return /from\s+['"].*PourLaMaquette\/db|import\s+.*PourLaMaquette\/db/.test(content);
}
walkAll(appRoot, '.tsx', (file) => {
  if (file.startsWith(mockDir + path.sep)) return;
  const content = fs.readFileSync(file, 'utf-8');
  if (hasDbImport(content)) {
    const relative = path.relative(path.join(__dirname, '..'), file);
    errors.push(`Direct import of PourLaMaquette/db forbidden: ${relative}. Use lib/db provider only.`);
  }
});
walkAll(appRoot, '.ts', (file) => {
  if (file.startsWith(mockDir + path.sep)) return;
  const content = fs.readFileSync(file, 'utf-8');
  if (hasDbImport(content)) {
    const relative = path.relative(path.join(__dirname, '..'), file);
    errors.push(`Direct import of PourLaMaquette/db forbidden: ${relative}. Use lib/db provider only.`);
  }
});

// Rules registry coherence: if staged files touch rule logic or lexicon/classify/generate, registry or entries must be touched too
const RULE_LOGIC_PATHS = [
  'apps/web/app/lib/actionability.ts',
  'apps/web/app/lib/actionability/realism.ts',
  'apps/web/app/lib/actionability/ambitionConfirmation.ts',
  'apps/web/app/lib/prompts/actionabilityClassifier.ts',
];
const LEXICON_OR_GATE_PATHS = [
  'apps/web/app/lib/lexicon/',
  'apps/web/app/api/lexicon/',
  'apps/web/app/api/actionability/classify/',
  'apps/web/app/api/missions/generate/',
];
const PROMPT_OR_LLM_PATHS = [
  'apps/web/app/lib/prompts/',
  'apps/web/app/api/actionability/',
  'apps/web/app/api/controllability/',
  'apps/web/app/api/lexicon/bootstrap/',
];
const DECISION_ENGINE_PATHS = [
  'apps/web/app/lib/decisionEngine/',
  'apps/web/app/api/judge/',
  'apps/web/app/api/decision/',
  'apps/web/app/lib/prompts/store',
  'apps/web/app/admin/prompts/',
];
const REGISTRY_PATHS = [
  'apps/web/app/lib/rules/registry.ts',
  'apps/web/app/lib/rules/entries/',
];
function getStagedFiles() {
  try {
    return execSync('git diff --name-only --cached', { encoding: 'utf-8', cwd: repoRoot })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}
const staged = getStagedFiles();
const touchesRuleLogic = RULE_LOGIC_PATHS.some((p) => staged.some((f) => f === p || f.startsWith(p + '/')));
const touchesLexiconOrGate =
  LEXICON_OR_GATE_PATHS.some((p) => staged.some((f) => f === p || f.startsWith(p)));
const touchesPromptOrLlm =
  PROMPT_OR_LLM_PATHS.some((p) => staged.some((f) => f === p || f.startsWith(p)));
const touchesDecisionEngine =
  DECISION_ENGINE_PATHS.some((p) => staged.some((f) => f === p || f.startsWith(p)));
const touchesRegistry =
  staged.some((f) => f === REGISTRY_PATHS[0]) ||
  staged.some((f) => f.startsWith(REGISTRY_PATHS[1]));
if (touchesRuleLogic && !touchesRegistry) {
  errors.push(
    'Rules registry: if you modify actionability.ts, realism.ts, ambitionConfirmation.ts or actionabilityClassifier, also update apps/web/app/lib/rules/registry.ts or lib/rules/entries/*.ts',
  );
}
if (touchesLexiconOrGate && !touchesRegistry) {
  errors.push(
    'Rules registry: if you modify lib/lexicon, api/lexicon, api/actionability/classify or api/missions/generate, also update apps/web/app/lib/rules/registry.ts or lib/rules/entries/*.ts',
  );
}
if (touchesPromptOrLlm && !touchesRegistry) {
  errors.push(
    'Rules registry: if you modify lib/prompts or any api/* LLM route (actionability, controllability, lexicon/bootstrap), also update apps/web/app/lib/rules/registry.ts or lib/rules/entries/*.ts (or prompt catalog).',
  );
}
if (touchesDecisionEngine && !touchesRegistry) {
  errors.push(
    'Rules registry: if you modify lib/decisionEngine, api/judge, api/decision, lib/prompts/store or admin/prompts, also update apps/web/app/lib/rules/registry.ts or lib/rules/entries/*.ts (decision_engine_v2, prompt_policy).',
  );
}

if (errors.length > 0) {
  console.error('Règles UI (docs/ui-blueprint.md) + anti-leak mock non respectées:\n');
  errors.forEach((e) => console.error(e));
  process.exit(1);
}

console.log('lint-ui-rules: OK');
