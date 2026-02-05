# LLM Router (dev-only site default + A/B)

The LLM router is the single entry point for server-side LLM usage. It provides a **site default** (from dev settings or env) and supports **per-call overrides** (e.g. run-prompt A/B in the admin playground).

## Env vars

- **LLM_PROVIDER**: `"openai"` or `"qwen"` (default: `"openai"`). Site default provider when no dev settings.
- **OPENAI_API_KEY**: Required for OpenAI. Used when provider is openai.
- **QWEN_API_KEY** or **LLM_API_KEY**: Used when provider is qwen.
- **OPENAI_BASE_URL**, **OPENAI_CHAT_MODEL**: Optional. Only these apply to OpenAI; **LLM_BASE_URL** never leaks into OpenAI. If `OPENAI_CHAT_MODEL` is unset, the router uses `gpt-4o-mini` by default.
- **QWEN_BASE_URL**, **QWEN_CHAT_MODEL**: Optional. Defaults: Dashscope compatible-mode URL, `qwen-max-2025-01-25`. Fallback: **LLM_BASE_URL**, **LLM_CHAT_MODEL**.

## Site default (dev)

- In dev, the **site default** is read from `PourLaMaquette/db/llm_settings.json` (provider, model, base_url). No API keys are stored.
- If the file is missing or invalid, the site default comes from env (**LLM_PROVIDER** + provider-scoped vars).
- **All** server LLM calls use this site default unless a route explicitly passes overrides (e.g. run-prompt A/B).

## Admin LLM page

- **GET /api/dev/llm/current** returns the current site default: `{ provider, model, base_url, source }` (`source` is `"dev_settings"` or `"env"`).
- In **/admin/llm** you can:
  - See **Current site LLM** (provider · model · base_url · source).
  - Compare A vs B (two columns with provider/model/base_url). Runs use the column config as override, not the site default.
  - **Set as site default (dev)** saves that column’s config to the dev settings file so the whole site uses it.

## Tracing (dev/debug)

When `DEBUG=1` or non-production, API responses that call the LLM can include:

- `llm_provider`, `llm_model`, `llm_base_url` (or `"default"`), `llm_source` (`"dev_settings"` | `"env"` | `"override"`), `latency_ms` (optional).

Use these fields to confirm which model and endpoint were used.

## Tiers (default vs reasoning)

In dev, `llm_settings.json` can define **routing**: one config for light tasks (**default**) and one for heavy reasoning (**reasoning**). Use `getSiteLlmClientForTier('default')` for classify, tone, controllability, audience-safety, etc., and `getSiteLlmClientForTier('reasoning')` for missions/generate, decision judges, generateMissionBlocks. The admin LLM page has a "Routage par usage" section to edit these. If a tier is not set, the site default is used.

## Migrating routes to the router

Use `getSiteLlmClientForTier('default')` or `getSiteLlmClientForTier('reasoning')` depending on the task; add `llm_provider`, `llm_model`, `llm_base_url`, `llm_source`, `latency_ms` to the JSON response when `DEBUG=1` or non-production. Example: `app/api/actionability/classify/route.ts` uses `'default'`. Other routes that still call OpenAI via raw `fetch` can be migrated the same way (controllability, lexicon/bootstrap, audience-safety, tone → `'default'`; missions/generate, missions/generate-one, decision judges, domains/infer, generateMissionBlocks → `'reasoning'`).

## Smoke

```bash
npm run smoke:llm-router
```

Checks default provider, qwen-only defaults, and that OpenAI never gets a dashscope base URL unless **OPENAI_BASE_URL** is set.
