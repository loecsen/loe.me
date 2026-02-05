'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '../../components/I18nProvider';
import styles from './page.module.css';

const PAGE_TITLE = 'LLM Playground';
const PAGE_SUBTITLE =
  'Compare OpenAI vs Qwen (Alibaba). Dev-only. API key from env (LLM_API_KEY or OPENAI_API_KEY).';

const QWEN_DEFAULT_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const QWEN_DEFAULT_MODEL = 'qwen-max-2025-01-25';
const DEFAULT_PRICING = {
  'openai:gpt-4o': { input_per_1k: 0.0025, output_per_1k: 0.01 },
  'openai:gpt-4o-mini': { input_per_1k: 0.00015, output_per_1k: 0.0006 },
  'openai:gpt-5.2': { input_per_1k: 0.004, output_per_1k: 0.012 },
  'qwen:qwen-max-2025-01-25': { input_per_1k: 0.0028, output_per_1k: 0.0084 },
  'qwen:qwen-plus': { input_per_1k: 0.00012, output_per_1k: 0.00036 },
  'qwen:qwen-turbo': { input_per_1k: 0.00004, output_per_1k: 0.00012 },
};
const ROUTING_MODEL_OPTIONS = [
  'gpt-5.2',
  'gpt-4o',
  'gpt-4o-mini',
  'qwen-max-2025-01-25',
  'qwen-plus',
  'qwen-turbo',
];

const showDevTools =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === '1';

type LlmProvider = 'openai' | 'qwen';

type TierConfig = { provider?: LlmProvider; model?: string; base_url?: string };

type DevSettings = {
  provider: LlmProvider;
  model?: string;
  base_url?: string;
  pricing?: Record<string, { input_per_1k: number; output_per_1k: number }>;
  routing?: { default?: TierConfig; reasoning?: TierConfig };
} | null;

type RunResult = {
  ok: boolean;
  llm?: { provider: string; model: string; base_url: string | null; source?: string };
  suspicious?: boolean;
  latency_ms?: number;
  output_text?: string;
  output_json?: unknown;
  cost?: {
    currency: 'usd';
    input_tokens: number;
    output_tokens: number;
    input_cost_usd: number;
    output_cost_usd: number;
    total_cost_usd: number;
    input_rate_per_1k: number;
    output_rate_per_1k: number;
    source: 'env' | 'code' | 'dev_settings';
  } | null;
  error?: string;
  error_key?: string;
};

type SiteLlmConfig = {
  provider: string;
  model: string;
  base_url: string | null;
  source: string;
} | null;

function isSuspiciousClient(
  resolved: { provider: string; model?: string | null; base_url?: string | null },
): boolean {
  const base = (resolved.base_url ?? '').toLowerCase();
  const model = (resolved.model ?? '').toLowerCase();
  if (resolved.provider === 'openai' && base.includes('dashscope')) return true;
  if (resolved.provider === 'qwen' && (model.startsWith('gpt-') || model.startsWith('o1') || /^o\d/.test(model)))
    return true;
  return false;
}

function runPrompt(
  payload: {
    provider?: LlmProvider;
    model?: string;
    base_url?: string;
    prompt_text: string;
    input: string;
    response_format?: 'text' | 'json';
  },
): Promise<RunResult> {
  return fetch('/api/dev/llm/run-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => r.json());
}

export default function AdminLlmPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [devSettings, setDevSettings] = useState<DevSettings>(null);
  const [promptText, setPromptText] = useState('You are a helpful assistant. Answer concisely.');
  const [inputText, setInputText] = useState('Quelle est la capitale de la France ?');
  const [providerA, setProviderA] = useState<LlmProvider>('openai');
  const [modelA, setModelA] = useState('');
  const [baseUrlA, setBaseUrlA] = useState('');
  const [providerB, setProviderB] = useState<LlmProvider>('qwen');
  const [modelB, setModelB] = useState('');
  const [baseUrlB, setBaseUrlB] = useState('');
  const [resultA, setResultA] = useState<RunResult | null>(null);
  const [resultB, setResultB] = useState<RunResult | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [siteLlm, setSiteLlm] = useState<SiteLlmConfig>(null);
  const [pricingText, setPricingText] = useState('');
  const [pricingError, setPricingError] = useState('');
  const [pricingSaved, setPricingSaved] = useState(false);
  const [routingDefaultProvider, setRoutingDefaultProvider] = useState<LlmProvider>('openai');
  const [routingDefaultModel, setRoutingDefaultModel] = useState('');
  const [routingDefaultBaseUrl, setRoutingDefaultBaseUrl] = useState('');
  const [routingReasoningProvider, setRoutingReasoningProvider] = useState<LlmProvider>('openai');
  const [routingReasoningModel, setRoutingReasoningModel] = useState('');
  const [routingReasoningBaseUrl, setRoutingReasoningBaseUrl] = useState('');
  const [routingFastProvider, setRoutingFastProvider] = useState<LlmProvider>('openai');
  const [routingFastModel, setRoutingFastModel] = useState('');
  const [routingFastBaseUrl, setRoutingFastBaseUrl] = useState('');
  const [routingSaved, setRoutingSaved] = useState(false);
  const [routingError, setRoutingError] = useState('');

  const loadSiteLlm = useCallback(async () => {
    try {
      const res = await fetch('/api/dev/llm/current');
      if (res.ok) {
        const data = await res.json();
        setSiteLlm(
          data?.provider != null
            ? {
                provider: data.provider,
                model: data.model ?? '',
                base_url: data.base_url ?? null,
                source: data.source ?? 'env',
              }
            : null,
        );
      } else {
        setSiteLlm(null);
      }
    } catch {
      setSiteLlm(null);
    }
  }, []);

  const loadSettings = useCallback(async (options?: { syncRunModels?: boolean }) => {
    const syncRunModels = options?.syncRunModels !== false;
    try {
      const res = await fetch('/api/dev/llm-settings');
      if (res.ok) {
        const data = await res.json();
        setDevSettings(data);
        if (data?.provider && syncRunModels) {
          setProviderA(data.provider);
          const rawModelA = data.model ?? '';
          const rawBaseUrlA = data.base_url ?? '';
          const sanitizedModelA =
            data.provider === 'openai' && rawModelA.toLowerCase().startsWith('qwen-')
              ? ''
              : rawModelA;
          const sanitizedBaseUrlA =
            data.provider === 'openai' && rawBaseUrlA.toLowerCase().includes('dashscope')
              ? ''
              : rawBaseUrlA;
          setModelA(sanitizedModelA);
          setBaseUrlA(sanitizedBaseUrlA);
          const other: LlmProvider = data.provider === 'openai' ? 'qwen' : 'openai';
          setProviderB(other);
          setModelB(other === 'qwen' ? QWEN_DEFAULT_MODEL : '');
          setBaseUrlB(other === 'qwen' ? QWEN_DEFAULT_BASE_URL : '');
        }
        const pricingSeed = data?.pricing ?? DEFAULT_PRICING;
        setPricingText(JSON.stringify(pricingSeed, null, 2));
        setPricingError('');
        setPricingSaved(false);
        const r = data?.routing;
        setRoutingDefaultProvider((r?.default?.provider as LlmProvider) ?? 'openai');
        setRoutingDefaultModel(r?.default?.model ?? '');
        setRoutingDefaultBaseUrl(r?.default?.base_url ?? '');
        setRoutingReasoningProvider((r?.reasoning?.provider as LlmProvider) ?? 'openai');
        setRoutingReasoningModel(r?.reasoning?.model ?? '');
        setRoutingReasoningBaseUrl(r?.reasoning?.base_url ?? '');
        setRoutingFastProvider((r?.fast?.provider as LlmProvider) ?? 'openai');
        setRoutingFastModel(r?.fast?.model ?? '');
        setRoutingFastBaseUrl(r?.fast?.base_url ?? '');
        setRoutingSaved(false);
        setRoutingError('');
      }
    } catch {
      setDevSettings(null);
    }
  }, []);

  const onProviderChangeA = (next: LlmProvider) => {
    setProviderA(next);
    if (next === 'openai') {
      setBaseUrlA('');
      setModelA('');
    } else {
      if (baseUrlA.trim() === '') setBaseUrlA(QWEN_DEFAULT_BASE_URL);
      if (modelA.trim() === '') setModelA(QWEN_DEFAULT_MODEL);
    }
  };

  const onProviderChangeB = (next: LlmProvider) => {
    setProviderB(next);
    if (next === 'openai') {
      setBaseUrlB('');
      setModelB('');
    } else {
      if (baseUrlB.trim() === '') setBaseUrlB(QWEN_DEFAULT_BASE_URL);
      if (modelB.trim() === '') setModelB(QWEN_DEFAULT_MODEL);
    }
  };

  useEffect(() => {
    if (!showDevTools) {
      router.replace('/');
      return;
    }
    loadSettings();
    loadSiteLlm();
  }, [router, loadSettings, loadSiteLlm]);

  const runA = async () => {
    setLoadingA(true);
    setResultA(null);
    try {
      const r = await runPrompt({
        provider: providerA,
        model: modelA,
        base_url: baseUrlA,
        prompt_text: promptText,
        input: inputText,
      });
      setResultA(r);
    } finally {
      setLoadingA(false);
    }
  };

  const runB = async () => {
    setLoadingB(true);
    setResultB(null);
    try {
      const r = await runPrompt({
        provider: providerB,
        model: modelB,
        base_url: baseUrlB,
        prompt_text: promptText,
        input: inputText,
      });
      setResultB(r);
    } finally {
      setLoadingB(false);
    }
  };

  const runBoth = async () => {
    setLoadingA(true);
    setLoadingB(true);
    setResultA(null);
    setResultB(null);
    try {
      const [rA, rB] = await Promise.all([
        runPrompt({
          provider: providerA,
          model: modelA,
          base_url: baseUrlA,
          prompt_text: promptText,
          input: inputText,
        }),
        runPrompt({
          provider: providerB,
          model: modelB,
          base_url: baseUrlB,
          prompt_text: promptText,
          input: inputText,
        }),
      ]);
      setResultA(rA);
      setResultB(rB);
    } finally {
      setLoadingA(false);
      setLoadingB(false);
    }
  };

  const savePricing = async () => {
    setPricingError('');
    setPricingSaved(false);
    const raw = pricingText.trim();
    let payload: unknown = null;
    if (raw === '') {
      payload = null;
    } else {
      try {
        payload = JSON.parse(raw);
      } catch {
        setPricingError('JSON invalide. Exemple attendu: {"openai:gpt-5-nano":{"input_per_1k":0.001,"output_per_1k":0.003}}');
        return;
      }
    }
    try {
      await fetch('/api/dev/llm-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing: payload }),
      });
      await loadSettings();
      setPricingSaved(true);
    } catch (e) {
      console.error(e);
      setPricingError('Erreur réseau lors de la sauvegarde.');
    }
  };

  const saveRouting = async () => {
    setRoutingError('');
    setRoutingSaved(false);
    try {
      await fetch('/api/dev/llm-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routing: {
            default: {
              provider: routingDefaultProvider,
              model: routingDefaultModel.trim() || undefined,
              base_url: routingDefaultBaseUrl.trim() || undefined,
            },
            reasoning: {
              provider: routingReasoningProvider,
              model: routingReasoningModel.trim() || undefined,
              base_url: routingReasoningBaseUrl.trim() || undefined,
            },
            fast: {
              provider: routingFastProvider,
              model: routingFastModel.trim() || undefined,
              base_url: routingFastBaseUrl.trim() || undefined,
            },
          },
        }),
      });
      await loadSettings({ syncRunModels: false });
      setRoutingSaved(true);
    } catch (e) {
      console.error(e);
      setRoutingError('Erreur réseau lors de la sauvegarde.');
    }
  };

  const setDefaultA = async () => {
    try {
      await fetch('/api/dev/llm-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerA,
          model: modelA.trim() || undefined,
          base_url: baseUrlA.trim() || undefined,
        }),
      });
      await loadSettings();
      await loadSiteLlm();
    } catch (e) {
      console.error(e);
    }
  };

  const setDefaultB = async () => {
    try {
      await fetch('/api/dev/llm-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerB,
          model: modelB.trim() || undefined,
          base_url: baseUrlB.trim() || undefined,
        }),
      });
      await loadSettings();
      await loadSiteLlm();
    } catch (e) {
      console.error(e);
    }
  };

  const renderResponse = (result: RunResult | null, loading: boolean) => {
    if (loading) return <div className={styles.responsePanelEmpty}>Running…</div>;
    if (!result) return <div className={styles.responsePanelEmpty}>No result yet.</div>;
    const resolved = result.llm;
    const baseDisplay = resolved?.base_url ?? 'default';
    const suspicious = resolved && (result.suspicious === true || isSuspiciousClient(resolved));
    const costDisplay =
      result.cost && Number.isFinite(result.cost.total_cost_usd)
        ? ` · $${result.cost.total_cost_usd.toFixed(6)}`
        : '';

    if (!result.ok) {
      return (
        <div className={styles.responsePanel}>
          <div className={styles.responseError}>
            {result.error_key && typeof t[result.error_key as keyof typeof t] === 'string'
              ? (t[result.error_key as keyof typeof t] as string)
              : (result.error ?? 'Error')}
          </div>
          {resolved && (
            <div className={styles.responseMeta}>
              {resolved.provider} · {resolved.model} · {baseDisplay}
              {result.latency_ms != null && ` · ${result.latency_ms} ms`}
              {resolved.source && ` · ${resolved.source}`}
              {costDisplay}
              {suspicious && (
                <span className={styles.suspiciousBadge}>⚠︎ provider/base_url or model mismatch</span>
              )}
            </div>
          )}
        </div>
      );
    }
    const display =
      result.output_json != null
        ? JSON.stringify(result.output_json, null, 2)
        : (result.output_text ?? '');
    return (
      <div className={styles.responsePanel}>
        <pre className={styles.responseContent}>{display}</pre>
        <div className={styles.responseMeta}>
          {resolved?.provider} · {resolved?.model} · {baseDisplay}
          {result.latency_ms != null && ` · ${result.latency_ms} ms`}
          {resolved?.source && ` · ${resolved.source}`}
          {costDisplay}
          {suspicious && (
            <span className={styles.suspiciousBadge}>⚠︎ provider/base_url or model mismatch</span>
          )}
        </div>
      </div>
    );
  };

  if (!showDevTools) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.backLink}>
        ← Home
      </Link>
      <Link href="/admin/rules" className={styles.backLink}>
        Rules
      </Link>
      <Link href="/admin/knowledge" className={styles.backLink}>
        Knowledge
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>
          {PAGE_TITLE}
          <span className={styles.devOnlyBadge}>Dev only</span>
        </h1>
        <p className={styles.subtitle}>{PAGE_SUBTITLE}</p>
        {siteLlm && (
          <p className={styles.siteLlmLine} aria-live="polite">
            <strong>Current site LLM:</strong>{' '}
            {siteLlm.provider} · {siteLlm.model} · {siteLlm.base_url == null || siteLlm.base_url === '' ? 'default' : 'custom'} · {siteLlm.source}
          </p>
        )}
      </header>

      <section className={styles.sharedSection}>
        <h2 className={styles.sectionTitle}>Routage par usage (dev)</h2>
        <p className={styles.configHint}>
          Fast = micro (controllability). Défaut = tâches légères (classif, ton, audience). Reasoning = tâches lourdes (missions, decision engine). Vide = site default.
        </p>
        <div className={styles.routingGrid}>
          <div className={styles.routingRow}>
            <span className={styles.routingLabel}>Fast (micro)</span>
            <select
              className={styles.select}
              value={routingFastProvider}
              onChange={(e) => setRoutingFastProvider(e.target.value as LlmProvider)}
            >
              <option value="openai">OpenAI</option>
              <option value="qwen">Qwen</option>
            </select>
            <select
              className={styles.select}
              value=""
              onChange={(e) => setRoutingFastModel(e.target.value)}
            >
              <option value="">Modèles…</option>
              {ROUTING_MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <input
              className={styles.input}
              type="text"
              value={routingFastModel}
              onChange={(e) => setRoutingFastModel(e.target.value)}
              placeholder="Model (optionnel)"
              list="routing-models"
            />
            <input
              className={styles.input}
              type="text"
              value={routingFastBaseUrl}
              onChange={(e) => setRoutingFastBaseUrl(e.target.value)}
              placeholder="Base URL (optionnel)"
            />
          </div>
          <div className={styles.routingRow}>
            <span className={styles.routingLabel}>Défaut (léger)</span>
            <select
              className={styles.select}
              value={routingDefaultProvider}
              onChange={(e) => setRoutingDefaultProvider(e.target.value as LlmProvider)}
            >
              <option value="openai">OpenAI</option>
              <option value="qwen">Qwen</option>
            </select>
            <select
              className={styles.select}
              value=""
              onChange={(e) => setRoutingDefaultModel(e.target.value)}
            >
              <option value="">Modèles…</option>
              {ROUTING_MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <input
              className={styles.input}
              type="text"
              value={routingDefaultModel}
              onChange={(e) => setRoutingDefaultModel(e.target.value)}
              placeholder="Model (optionnel)"
              list="routing-models"
            />
            <input
              className={styles.input}
              type="text"
              value={routingDefaultBaseUrl}
              onChange={(e) => setRoutingDefaultBaseUrl(e.target.value)}
              placeholder="Base URL (optionnel)"
            />
          </div>
          <div className={styles.routingRow}>
            <span className={styles.routingLabel}>Reasoning (lourd)</span>
            <select
              className={styles.select}
              value={routingReasoningProvider}
              onChange={(e) => setRoutingReasoningProvider(e.target.value as LlmProvider)}
            >
              <option value="openai">OpenAI</option>
              <option value="qwen">Qwen</option>
            </select>
            <select
              className={styles.select}
              value=""
              onChange={(e) => setRoutingReasoningModel(e.target.value)}
            >
              <option value="">Modèles…</option>
              {ROUTING_MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <input
              className={styles.input}
              type="text"
              value={routingReasoningModel}
              onChange={(e) => setRoutingReasoningModel(e.target.value)}
              placeholder="Model (optionnel)"
              list="routing-models"
            />
            <input
              className={styles.input}
              type="text"
              value={routingReasoningBaseUrl}
              onChange={(e) => setRoutingReasoningBaseUrl(e.target.value)}
              placeholder="Base URL (optionnel)"
            />
          </div>
        </div>
        {routingError && <div className={styles.responseError}>{routingError}</div>}
        {routingSaved && <div className={styles.configHint}>Routage enregistré.</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={saveRouting}>
            Enregistrer le routage
          </button>
        </div>
        <datalist id="routing-models">
          {ROUTING_MODEL_OPTIONS.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
        <datalist id="run-models">
          {ROUTING_MODEL_OPTIONS.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
      </section>

      <section className={styles.sharedSection}>
        <h2 className={styles.sectionTitle}>Prompt (shared)</h2>
        <textarea
          className={`${styles.textarea} ${styles.textareaPrompt}`}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="System instruction or combined prompt"
          spellCheck={false}
        />
      </section>

      <section className={styles.sharedSection}>
        <h2 className={styles.sectionTitle}>Pricing (dev)</h2>
        <label className={styles.label} htmlFor="pricing-json">
          Tarifs par modèle (USD / 1k tokens)
        </label>
        <textarea
          id="pricing-json"
          className={styles.textarea}
          placeholder={`{\n  "openai:gpt-5-nano": { "input_per_1k": 0.001, "output_per_1k": 0.003 },\n  "qwen:qwen-max-2025-01-25": { "input_per_1k": 0.002, "output_per_1k": 0.006 }\n}`}
          value={pricingText}
          onChange={(event) => {
            setPricingText(event.target.value);
            setPricingSaved(false);
          }}
        />
        <div className={styles.configHint}>
          Clés: <code>provider:model</code>. Laisser vide pour désactiver le calcul de coût.
        </div>
        {pricingError && <div className={styles.responseError}>{pricingError}</div>}
        {pricingSaved && <div className={styles.configHint}>Tarifs enregistrés.</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={savePricing}>
            Enregistrer les tarifs
          </button>
        </div>
      </section>

      <section className={styles.sharedSection}>
        <h2 className={styles.sectionTitle}>Input (shared)</h2>
        <textarea
          className={styles.textarea}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="User message to send"
          spellCheck={false}
        />
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={runA} disabled={loadingA || loadingB}>
          Run A
        </button>
        <button type="button" className={styles.btn} onClick={runB} disabled={loadingA || loadingB}>
          Run B
        </button>
        <button type="button" className={styles.btn} onClick={runBoth} disabled={loadingA || loadingB}>
          Run A/B
        </button>
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <h3 className={styles.columnTitle}>A</h3>
          <div className={styles.configRow}>
            <select
              className={styles.select}
              value={providerA}
              onChange={(e) => onProviderChangeA(e.target.value as LlmProvider)}
            >
              <option value="openai">OpenAI</option>
              <option value="qwen">Qwen</option>
            </select>
            <input
              className={styles.input}
              type="text"
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              placeholder="Model (optional)"
              list="run-models"
            />
            <input
              className={styles.input}
              type="text"
              value={baseUrlA}
              onChange={(e) => setBaseUrlA(e.target.value)}
              placeholder="Base URL (optional)"
            />
          </div>
          <p className={styles.configHint} aria-live="polite">
            {providerA === 'openai'
              ? 'OpenAI uses default base URL unless you set a custom one.'
              : 'Qwen uses Dashscope compatible-mode by default.'}
          </p>
          {renderResponse(resultA, loadingA)}
          <button type="button" className={`${styles.btnSecondary} ${styles.btnSetDefault}`} onClick={setDefaultA}>
            Set as site default (dev)
          </button>
        </div>

        <div className={styles.column}>
          <h3 className={styles.columnTitle}>B</h3>
          <div className={styles.configRow}>
            <select
              className={styles.select}
              value={providerB}
              onChange={(e) => onProviderChangeB(e.target.value as LlmProvider)}
            >
              <option value="openai">OpenAI</option>
              <option value="qwen">Qwen</option>
            </select>
            <input
              className={styles.input}
              type="text"
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              placeholder="Model (optional)"
              list="run-models"
            />
            <input
              className={styles.input}
              type="text"
              value={baseUrlB}
              onChange={(e) => setBaseUrlB(e.target.value)}
              placeholder="Base URL (optional)"
            />
          </div>
          <p className={styles.configHint} aria-live="polite">
            {providerB === 'openai'
              ? 'OpenAI uses default base URL unless you set a custom one.'
              : 'Qwen uses Dashscope compatible-mode by default.'}
          </p>
          {renderResponse(resultB, loadingB)}
          <button type="button" className={`${styles.btnSecondary} ${styles.btnSetDefault}`} onClick={setDefaultB}>
            Set as site default (dev)
          </button>
        </div>
      </div>
    </div>
  );
}
