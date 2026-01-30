#!/usr/bin/env node
/**
 * Smoke: RULES_REGISTRY coherence (static registry, no side effects).
 * - registry.ts exports RULES_REGISTRY (const array), no registerRule
 * - Critical gates present in registry (via parsing registry.ts: imports from entries => gates)
 * - Each entry file exports a RuleDoc with gate, reason_codes, examples_pass, examples_fail
 * Usage: node scripts/smoke-rules-registry.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const rulesDir = path.join(repoRoot, 'apps', 'web', 'app', 'lib', 'rules');
const entriesDir = path.join(rulesDir, 'entries');

const CRITICAL_GATES = ['actionability_v2', 'classifier', 'category', 'realism_soft', 'confirmation'];

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// 1) registry.ts: must export RULES_REGISTRY, must NOT use registerRule or push
const registryPath = path.join(rulesDir, 'registry.ts');
assert(fs.existsSync(registryPath), `Missing: ${registryPath}`);
const registrySource = fs.readFileSync(registryPath, 'utf8');
assert(registrySource.includes('RULES_REGISTRY'), 'registry.ts must export RULES_REGISTRY');
assert(!registrySource.includes('registerRule'), 'registry.ts must not use registerRule (static only)');
assert(!registrySource.includes('.push('), 'registry.ts must not use .push (static only)');

// 2) registry.ts must import all 5 entry docs and assign RULES_REGISTRY = [ ... ]
const entryImports = ['ruleActionabilityV2', 'ruleClassifier', 'ruleCategory', 'ruleRealism', 'ruleAmbition'];
for (const name of entryImports) {
  assert(registrySource.includes(name), `registry.ts must import ${name}`);
}
assert(
  /RULES_REGISTRY:\s*RuleDoc\[\]\s*=\s*\[[\s\S]*\]/.test(registrySource),
  'registry.ts must define RULES_REGISTRY = [ ... ]',
);

// 3) Each critical gate has an entry file exporting a RuleDoc with that gate
const gateToFile = {
  actionability_v2: 'actionabilityV2.ts',
  classifier: 'classifier.ts',
  category: 'category.ts',
  realism_soft: 'realism.ts',
  confirmation: 'ambition.ts',
};

for (const gate of CRITICAL_GATES) {
  const fileName = gateToFile[gate];
  const filePath = path.join(entriesDir, fileName);
  assert(fs.existsSync(filePath), `Missing entry file for gate "${gate}": ${filePath}`);
  const source = fs.readFileSync(filePath, 'utf8');
  assert(
    source.includes(`gate: '${gate}'`) || source.includes(`gate: "${gate}"`),
    `Entry ${fileName} must export RuleDoc with gate "${gate}"`,
  );
  assert(!source.includes('registerRule'), `Entry ${fileName} must not call registerRule`);
  assert(source.includes('reason_codes:'), `Entry ${fileName} must have reason_codes`);
  assert(source.includes('examples_pass:'), `Entry ${fileName} must have examples_pass`);
  assert(source.includes('examples_fail:'), `Entry ${fileName} must have examples_fail`);

  const reasonMatch = source.match(/reason_codes:\s*\[([\s\S]*?)\]/);
  assert(reasonMatch, `Entry ${fileName}: could not find reason_codes array`);
  const reasonCount = (reasonMatch[1].match(/['"][^'"]+['"]/g) || []).length;
  assert(reasonCount >= 1, `Entry ${fileName}: reason_codes must have >= 1 element, got ${reasonCount}`);

  const passMatch = source.match(/examples_pass:\s*\[([\s\S]*?)\]/);
  const failMatch = source.match(/examples_fail:\s*\[([\s\S]*?)\]/);
  assert(passMatch, `Entry ${fileName}: could not find examples_pass array`);
  assert(failMatch, `Entry ${fileName}: could not find examples_fail array`);
  const passCount = (passMatch[1].match(/['"`][^'"`]+['"`]/g) || []).length;
  const failCount = (failMatch[1].match(/['"`][^'"`]+['"`]/g) || []).length;
  const totalExamples = passCount + failCount;
  assert(
    totalExamples >= 2,
    `Entry ${fileName}: examples_pass + examples_fail must have >= 2 total, got pass=${passCount} fail=${failCount}`,
  );
}

console.log('smoke-rules-registry: OK');
process.exit(0);
