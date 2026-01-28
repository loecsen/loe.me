import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const filePath = path.resolve(
  process.cwd(),
  'apps/web/app/lib/realism/realismGate.ts',
);
const source = fs.readFileSync(filePath, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const module = { exports: {} };
const wrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
wrapper(module.exports, require, module, filePath, path.dirname(filePath));

const { runRealismGate } = module.exports;

const cases = [
  {
    name: 'fluent japonais 7j',
    result: runRealismGate('devenir fluent en japonais en 7 jours', 7, 'fr'),
    expect: { status: 'needs_reformulation', reason: 'unrealistic' },
  },
  {
    name: 'apprendre chinois 90j',
    result: runRealismGate('apprendre chinois', 90, 'fr'),
    expect: { status: 'ok' },
  },
  {
    name: 'guitare et piano 14j',
    result: runRealismGate('apprendre guitare et piano en 14 jours', 14, 'fr'),
    expect: { status: 'needs_reformulation', reason: 'unrealistic' },
  },
  {
    name: 'réussir ma vie',
    result: runRealismGate('réussir ma vie', undefined, 'fr'),
    expect: { status: 'ok' },
  },
];

const failures = cases.filter((entry) => {
  if (!entry.result) return true;
  if (entry.expect.status !== entry.result.status) return true;
  if (entry.expect.reason && entry.expect.reason !== 'unrealistic') return false;
  if (entry.expect.reason === 'unrealistic' && entry.result.status !== 'needs_reformulation') {
    return true;
  }
  if (entry.expect.reason === 'unrealistic' && entry.result.choices.length < 2) {
    return true;
  }
  return false;
});

if (failures.length > 0) {
  console.error('Realism Gate smoke tests failed:', failures.map((f) => f.name));
  process.exit(1);
}

console.log('Realism Gate smoke tests passed.');
