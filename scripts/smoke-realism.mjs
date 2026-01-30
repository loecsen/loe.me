/**
 * Smoke test for runSoftRealism (soft realism). No Vitest; no new deps.
 * Uses ts.transpileModule + category stub to load apps/web/app/lib/actionability/realism.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const repoRoot = path.resolve(process.cwd());
const realismPath = path.join(repoRoot, 'apps/web/app/lib/actionability/realism.ts');
const source = fs.readFileSync(realismPath, 'utf8');

const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const CATEGORY_STUB = {
  LEARN: 'LEARN',
  CREATE: 'CREATE',
  PERFORM: 'PERFORM',
  WELLBEING: 'WELLBEING',
  SOCIAL: 'SOCIAL',
  CHALLENGE: 'CHALLENGE',
};
const categoryRequiresFeasibility = (cat) =>
  cat != null && ['LEARN', 'CREATE', 'WELLBEING'].includes(cat);
const categoryStub = { Category: CATEGORY_STUB, categoryRequiresFeasibility };

const outputWithStub = output.replace(
  /require\s*\(\s*["']\.\.\/category["']\s*\)/g,
  'CATEGORY_STUB',
);

const mod = { exports: {} };
const wrapper = new Function(
  'exports',
  'require',
  'module',
  '__filename',
  '__dirname',
  'CATEGORY_STUB',
  outputWithStub,
);
wrapper(mod.exports, require, mod, realismPath, path.dirname(realismPath), categoryStub);

const { runSoftRealism } = mod.exports;

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const cases = [
  {
    name: 'maîtriser le chinois en 90 jours => unrealistic',
    run: () => runSoftRealism('maîtriser le chinois en 90 jours', 90, 'LEARN', 'fr'),
    expect: (r) => {
      assert(r.level === 'unrealistic', `Expected level unrealistic, got ${r.level}`);
      assert(
        r.adjustments.some((a) => a.type === 'reduce_scope'),
        'Expected at least one reduce_scope adjustment',
      );
      assert(
        r.adjustments.some((a) => a.type === 'increase_duration'),
        'Expected at least one increase_duration adjustment',
      );
    },
  },
  {
    name: 'apprendre le chinois A2 en 90 jours => ok or stretch',
    run: () => runSoftRealism('apprendre le chinois A2 en 90 jours', 90, 'LEARN', 'fr'),
    expect: (r) => {
      assert(
        r.level !== 'unrealistic',
        `Expected ok or stretch, got ${r.level}`,
      );
    },
  },
  {
    name: '精通中文 90天 => unrealistic',
    run: () => runSoftRealism('精通中文 90天', 90, 'LEARN', 'zh'),
    expect: (r) => {
      assert(r.level === 'unrealistic', `Expected level unrealistic, got ${r.level}`);
      assert(r.adjustments.length >= 1, 'Expected at least one adjustment');
    },
  },
  {
    name: '한국어 유창하게 60일 => unrealistic',
    run: () => runSoftRealism('한국어 유창하게 60일', 60, 'LEARN', 'ko'),
    expect: (r) => {
      assert(r.level === 'unrealistic', `Expected level unrealistic, got ${r.level}`);
      assert(r.adjustments.length >= 1, 'Expected at least one adjustment');
    },
  },
  {
    name: 'Learn Spanish basics in 14 days => ok or stretch',
    run: () => runSoftRealism('Learn Spanish basics in 14 days', 14, 'LEARN', 'en'),
    expect: (r) => {
      assert(
        r.level !== 'unrealistic',
        `Expected ok or stretch, got ${r.level}`,
      );
    },
  },
  {
    name: 'category PERFORM => ok (no evaluation)',
    run: () => runSoftRealism('maîtriser le chinois en 30 jours', 30, 'PERFORM', 'fr'),
    expect: (r) => {
      assert(r.level === 'ok', `Expected level ok, got ${r.level}`);
      assert(r.adjustments.length === 0, 'Expected no adjustments');
    },
  },
  {
    name: 'category SOCIAL => ok (no evaluation)',
    run: () => runSoftRealism('fluent Korean in 20 days', 20, 'SOCIAL', 'en'),
    expect: (r) => {
      assert(r.level === 'ok', `Expected level ok, got ${r.level}`);
      assert(r.adjustments.length === 0, 'Expected no adjustments');
    },
  },
  {
    name: 'ambition + 30 days => 2 duration options',
    run: () => runSoftRealism('master French', 30, 'LEARN', 'en'),
    expect: (r) => {
      assert(r.level === 'unrealistic', `Expected level unrealistic, got ${r.level}`);
      const durations = r.adjustments.filter((a) => a.type === 'increase_duration');
      assert(durations.length === 2, `Expected 2 increase_duration options, got ${durations.length}`);
      const days = durations.map((a) => a.next_days).sort((a, b) => a - b);
      assert(
        JSON.stringify(days) === '[60,90]',
        `Expected [60,90], got ${JSON.stringify(days)}`,
      );
    },
  },
];

let failed = 0;
for (const c of cases) {
  try {
    const result = c.run();
    c.expect(result);
    console.log(`  ✓ ${c.name}`);
  } catch (err) {
    console.error(`  ✗ ${c.name}: ${err.message}`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\nSmoke realism: ${failed} failed`);
  process.exit(1);
}

console.log('\nSmoke realism: all passed.');
