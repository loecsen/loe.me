#!/usr/bin/env node
/**
 * Optional smoke: call dev run-prompt with provider=qwen and a French question.
 * Requires: dev server running (npm -w apps/web run dev), LLM_API_KEY set to DashScope key.
 * Usage: LLM_API_KEY=sk-... node scripts/smoke-llm-qwen.mjs
 */

const BASE = process.env.LLM_PLAYGROUND_BASE ?? 'http://localhost:3000';

async function main() {
  const res = await fetch(`${BASE}/api/dev/llm/run-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'qwen',
      prompt_text: 'You are a helpful assistant. Answer concisely in the same language as the question.',
      input: 'Quelle est la capitale de la France ?',
    }),
  });
  const data = await res.json();

  if (res.status === 403) {
    console.log('  ⚠ Dev endpoint returned 403 (expected in production).');
    process.exit(0);
  }
  if (res.status === 503 && data.error?.includes('API key')) {
    console.log('  ⚠ LLM_API_KEY not set or invalid. Set it to a DashScope key to test Qwen.');
    process.exit(0);
  }
  if (!res.ok) {
    console.error('  ✗ Request failed:', res.status, data);
    process.exit(1);
  }
  if (!data.ok) {
    console.error('  ✗ LLM error:', data.error);
    process.exit(1);
  }

  console.log('  ✓ Qwen responded:', data.llm?.provider, data.llm?.model);
  console.log('  ✓ Latency:', data.latency_ms, 'ms');
  console.log('  ✓ Answer:', (data.output_text ?? '').slice(0, 120) + (data.output_text?.length > 120 ? '…' : ''));
  console.log('\nSmoke LLM Qwen: passed.');
}

main().catch((err) => {
  if (err.cause?.code === 'ECONNREFUSED') {
    console.log('  ⚠ Dev server not running. Start with: npm -w apps/web run dev');
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
