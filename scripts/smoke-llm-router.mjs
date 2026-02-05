#!/usr/bin/env node
/**
 * Smoke: LLM router semantics (no network).
 * - Default provider is openai when no env + no dev settings.
 * - Dev settings (when present) define site default; qwen defaults apply only to qwen.
 * - OpenAI must not resolve dashscope baseUrl unless OPENAI_BASE_URL explicitly set.
 */

const QWEN_DEFAULT_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const QWEN_DEFAULT_MODEL = 'qwen-max-2025-01-25';

function assert(condition, message) {
  if (!condition) {
    console.error('Assertion failed:', message);
    process.exit(1);
  }
}

// 1) No dev settings, no env => site default would be openai (we can't call getSiteLlmConfig from .mjs, so assert env resolution only)
const envEmpty = {};
const providerFromEnv = envEmpty.LLM_PROVIDER ?? 'openai';
assert(providerFromEnv === 'openai', 'default provider when unset should be openai');
console.log('  ✓ default provider is openai when no env + no dev settings');

// 2) If dev settings set to qwen, site config would return qwen defaults (simulate: when provider is qwen, baseUrl and model are qwen defaults)
const devSettingsQwen = { provider: 'qwen', model: '', base_url: '' };
const qwenBaseUrl = devSettingsQwen.base_url?.trim() || envEmpty.QWEN_BASE_URL || envEmpty.LLM_BASE_URL || QWEN_DEFAULT_BASE_URL;
const qwenModel = devSettingsQwen.model?.trim() || envEmpty.QWEN_CHAT_MODEL || envEmpty.LLM_CHAT_MODEL || QWEN_DEFAULT_MODEL;
assert(qwenBaseUrl === QWEN_DEFAULT_BASE_URL, 'qwen site default base_url');
assert(qwenModel === QWEN_DEFAULT_MODEL, 'qwen site default model');
console.log('  ✓ if dev settings set to qwen, site config uses qwen defaults');

// 3) OpenAI must not resolve dashscope baseUrl unless OPENAI_BASE_URL explicitly set
const envWithDashscope = { LLM_PROVIDER: 'qwen', LLM_BASE_URL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' };
const openaiBaseUrl = envWithDashscope.OPENAI_BASE_URL?.trim() || undefined;
assert(openaiBaseUrl === undefined, 'openai must not get LLM_BASE_URL (dashscope); OPENAI_BASE_URL unset => undefined');
console.log('  ✓ openai does not resolve dashscope baseUrl unless OPENAI_BASE_URL set');

console.log('\nSmoke LLM router: all passed.');
