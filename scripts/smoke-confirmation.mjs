/**
 * Smoke test for needsAmbitionConfirmation (confirmation block heuristic).
 * No deps; uses ts.transpileModule to load ambitionConfirmation.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const repoRoot = path.resolve(process.cwd());
const filePath = path.join(repoRoot, 'apps/web/app/lib/actionability/ambitionConfirmation.ts');
const source = fs.readFileSync(filePath, 'utf8');

const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const mod = { exports: {} };
const wrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
wrapper(mod.exports, require, mod, filePath, path.dirname(filePath));

const { needsAmbitionConfirmation } = mod.exports;

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// Should need confirmation (life-goal / role markers)
assert(
  needsAmbitionConfirmation('devenir président de la république'),
  'devenir président de la république => needsConfirmation true',
);
assert(
  needsAmbitionConfirmation('become a billionaire'),
  'become a billionaire => needsConfirmation true',
);
assert(
  needsAmbitionConfirmation('convertirme en millonario'),
  'convertirme en millonario => needsConfirmation true',
);

// Should NOT need confirmation (standard ambitious, not life-goal)
assert(
  !needsAmbitionConfirmation('maîtriser le chinois en 90 jours'),
  'maîtriser le chinois en 90 jours => needsConfirmation false',
);
assert(
  !needsAmbitionConfirmation('Learn Spanish basics in 14 days'),
  'Learn Spanish basics => needsConfirmation false',
);

console.log('  ✓ devenir président => true');
console.log('  ✓ become a billionaire => true');
console.log('  ✓ convertirme en millonario => true');
console.log('  ✓ maîtriser chinois 90j => false');
console.log('  ✓ Learn Spanish basics => false');
console.log('\nSmoke confirmation: all passed.');
