#!/usr/bin/env node
/**
 * Règles UI pragmatiques (docs/ui-blueprint.md)
 * - style={{ }} interdit dans packages/ui sauf ligne précédente avec "ui-blueprint" ou objet réduit à une var CSS (--*)
 * - couleurs hex/rgba/hsl interdites dans .css hors :root et hors commentaires
 * Usage: node scripts/lint-ui-rules.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.join(__dirname, '..', 'packages', 'ui', 'src');

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
const allowedMockImporter = path.join(appRoot, 'page.tsx');

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
  return path.normalize(file) === path.normalize(allowedMockImporter);
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

if (errors.length > 0) {
  console.error('Règles UI (docs/ui-blueprint.md) + anti-leak mock non respectées:\n');
  errors.forEach((e) => console.error(e));
  process.exit(1);
}

console.log('lint-ui-rules: OK');
