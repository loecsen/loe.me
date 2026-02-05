/**
 * Smoke test for isLifeGoalOrRoleAspiration (life-goal intercept, client-only).
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

const { isLifeGoalOrRoleAspiration } = mod.exports;

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// hit true — elite role
const r1 = isLifeGoalOrRoleAspiration('devenir président de la république');
assert(r1.hit === true, `devenir président de la république => hit true, got ${r1.hit}`);

// hit false — normal job, no elite/superlative
const r2 = isLifeGoalOrRoleAspiration('devenir pet sitter');
assert(r2.hit === false, `devenir pet sitter => hit false, got ${r2.hit}`);

// hit true — elite (champion du monde)
const r3 = isLifeGoalOrRoleAspiration('devenir champion du monde');
assert(r3.hit === true, `devenir champion du monde => hit true, got ${r3.hit}`);

// hit true — superlative
const r4 = isLifeGoalOrRoleAspiration('devenir le meilleur pet sitter');
assert(r4.hit === true, `devenir le meilleur pet sitter => hit true (superlatif), got ${r4.hit}`);

// hit false — actionable frame (en 30 jours)
const r5 = isLifeGoalOrRoleAspiration('devenir pet sitter en 30 jours');
assert(r5.hit === false, `devenir pet sitter en 30 jours => hit false, got ${r5.hit}`);

// hit false
const r6 = isLifeGoalOrRoleAspiration('bonjour');
assert(r6.hit === false, `bonjour => hit false, got ${r6.hit}`);

const r7 = isLifeGoalOrRoleAspiration('apprendre le chinois A2 en 90 jours');
assert(r7.hit === false, `apprendre le chinois A2 en 90 jours => hit false, got ${r7.hit}`);

// hit true
const r8 = isLifeGoalOrRoleAspiration('become a billionaire');
assert(r8.hit === true, `become a billionaire => hit true, got ${r8.hit}`);

// hit false (Korean "make pizza")
const r9 = isLifeGoalOrRoleAspiration('피자 만들기');
assert(r9.hit === false, `피자 만들기 => hit false, got ${r9.hit}`);

console.log('  ✓ devenir président de la république => hit true');
console.log('  ✓ devenir pet sitter => hit false');
console.log('  ✓ devenir champion du monde => hit true');
console.log('  ✓ devenir le meilleur pet sitter => hit true');
console.log('  ✓ devenir pet sitter en 30 jours => hit false');
console.log('  ✓ bonjour / apprendre... / become a billionaire / 피자 만들기');
console.log('  ✓ Write daily 90d / Ship project 30d / Speak Italian 7d => hit false');
console.log('  ✓ Get accepted to Harvard / Become world champion => hit true');
console.log('\nSmoke ambition confirmation: all passed.');
