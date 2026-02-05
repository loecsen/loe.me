# LLM Playground (dev-only)

The LLM Playground lets you compare **OpenAI** and **Qwen** (Alibaba Model Studio) using a generic run-prompt endpoint and an admin UI. Everything is dev-only; no secrets are stored in files.

## Environment

- **LLM_PROVIDER**: Site default provider: `"openai"` or `"qwen"` (default: `openai`).

Config is **provider-scoped** so OpenAI runs never use Qwen/Dashscope settings.

### OpenAI (when provider is `openai`)

- **OPENAI_API_KEY**: API key (required for OpenAI runs).
- **OPENAI_BASE_URL**: Optional. If unset, OpenAI uses the SDK default (no custom base). **LLM_BASE_URL is never used for OpenAI** (avoids hitting Dashscope by mistake).
- **OPENAI_CHAT_MODEL**: Optional. If unset, the router uses `gpt-4o-mini` as the default model.

### Qwen (when provider is `qwen`)

- **QWEN_API_KEY** or **LLM_API_KEY**: API key for Qwen/Dashscope.
- **QWEN_BASE_URL**: Optional. Default: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`. Fallback: **LLM_BASE_URL**.
- **QWEN_CHAT_MODEL**: Optional. Default: `qwen-max-2025-01-25`. Fallback: **LLM_CHAT_MODEL**.

The API key is **always** read from the environment. It is never stored in the dev settings file or in the repo.

## Using the admin page

1. Run the app in dev: `npm -w apps/web run dev`.
2. Open **http://localhost:3000/admin/llm** (or follow the “LLM Playground” link from Admin Rules or Admin Knowledge).
3. Enter a **prompt** (system instruction) and **input** (user message).
4. Configure column **A** and **B** (provider, optional model, optional base URL).
5. Use **Run A**, **Run B**, or **Run A/B** to call the LLM(s). The response and metadata (provider, model, base_url, latency) appear in each column.
6. **Set as dev default** saves that column’s provider/model/base_url to the dev settings file (`PourLaMaquette/db/llm_settings.json`). Only these values are stored; the API key always comes from env.

## API

- **GET /api/dev/llm-settings** — Returns current dev settings or `null`. 403 in production.
- **POST /api/dev/llm-settings** — Body: `{ provider?, model?, base_url? }`. Writes dev settings. 403 in production.
- **POST /api/dev/llm/run-prompt** — Body: `{ provider?, model?, base_url?, prompt_text, input, response_format? }`. Runs one chat completion and returns `{ ok, llm, latency_ms, output_text, output_json?, usage?, cost?, error? }`. 403 in production.

## Pricing (optional)

If you want cost estimates in the playground output, set `LLM_PRICING_JSON` in the environment. Example:

```json
{
  "openai:gpt-5-nano": { "input_per_1k": 0.001, "output_per_1k": 0.003 },
  "qwen:qwen-max-2025-01-25": { "input_per_1k": 0.002, "output_per_1k": 0.006 }
}
```

The response will include a `cost` object with token counts and USD totals when a matching entry exists.

## Smoke tests

**Config (no network):**

```bash
npm run smoke:llm-config
```

Checks that default provider is OpenAI when `LLM_PROVIDER` is unset, and that Qwen defaults and overrides are applied as documented.

**Qwen live (optional, network):**

With the dev server running and `LLM_API_KEY` set to a DashScope key:

```bash
node scripts/smoke-llm-qwen.mjs
```

Sends “Quelle est la capitale de la France ?” to Qwen and prints the response.
