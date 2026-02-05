'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

type PromptEntry = {
  name: string;
  version: string;
  purpose_en: string;
  token_budget_target?: number;
  safety_notes_en?: string;
  system?: string;
  user_template: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
};

type LlmCurrent = {
  provider: string;
  model: string;
  base_url: string | null;
  source?: string;
} | null;

type LlmRouting = {
  default?: { provider?: string; model?: string; base_url?: string };
  reasoning?: { provider?: string; model?: string; base_url?: string };
} | null;

const PAGE_TITLE = 'Admin Prompts (Decision Engine V2)';
const PAGE_SUBTITLE =
  'Published prompts (lib/prompts/published) and drafts (PourLaMaquette/prompts-drafts). Dev-only. All docs in English.';

const showDevTools =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === '1';

export default function AdminPromptsPage() {
  const router = useRouter();
  const [published, setPublished] = useState<PromptEntry[]>([]);
  const [drafts, setDrafts] = useState<PromptEntry[]>([]);
  const [knownNames, setKnownNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [bootstrapBusy, setBootstrapBusy] = useState<string | null>(null);
  const [llmCurrent, setLlmCurrent] = useState<LlmCurrent>(null);
  const [llmRouting, setLlmRouting] = useState<LlmRouting>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    fetch('/api/prompts/list')
      .then((res) => res.json())
      .then((data) => {
        setPublished(data.published ?? []);
        setDrafts(data.drafts ?? []);
        setKnownNames(data.known_names ?? []);
      })
      .catch(() => {
        setPublished([]);
        setDrafts([]);
        setKnownNames([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadLlmInfo = useCallback(() => {
    Promise.all([fetch('/api/dev/llm/current'), fetch('/api/dev/llm-settings')])
      .then(async ([currentRes, settingsRes]) => {
        const current = currentRes.ok ? await currentRes.json() : null;
        const settings = settingsRes.ok ? await settingsRes.json() : null;
        setLlmCurrent(
          current?.provider
            ? {
                provider: current.provider,
                model: current.model ?? '',
                base_url: current.base_url ?? null,
                source: current.source,
              }
            : null,
        );
        setLlmRouting(settings?.routing ?? null);
      })
      .catch(() => {
        setLlmCurrent(null);
        setLlmRouting(null);
      });
  }, []);

  useEffect(() => {
    if (!showDevTools) {
      router.replace('/');
      return;
    }
    fetchList();
    loadLlmInfo();
  }, [router, fetchList, loadLlmInfo]);

  const handleBootstrap = async (promptName: string) => {
    setBootstrapBusy(promptName);
    try {
      const res = await fetch('/api/prompts/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_name: promptName }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchList();
      }
    } finally {
      setBootstrapBusy(null);
    }
  };

  const missingNames = knownNames.filter(
    (n) => !published.some((p) => p.name === n) && !drafts.some((d) => d.name === n),
  );
  const formatTier = (tier?: { provider?: string; model?: string; base_url?: string } | null) => {
    if (!tier) return 'site default';
    const provider = tier.provider ?? 'site default';
    const model = tier.model ?? 'default';
    const base = tier.base_url ? 'custom' : 'default';
    return `${provider} · ${model} · ${base}`;
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>{PAGE_TITLE}</h1>
        <p className={styles.subtitle}>{PAGE_SUBTITLE}</p>
        {llmCurrent && (
          <p className={styles.meta}>
            LLM site default: {llmCurrent.provider} · {llmCurrent.model} · {llmCurrent.base_url ? 'custom' : 'default'}
            {llmCurrent.source ? ` · ${llmCurrent.source}` : ''}
          </p>
        )}
        {llmRouting && (
          <p className={styles.meta}>
            LLM routing: défaut = {formatTier(llmRouting.default)} · reasoning = {formatTier(llmRouting.reasoning)}
          </p>
        )}
        <p style={{ marginTop: 8 }}>
          <Link href="/admin/rules" className={styles.link}>
            Admin Rules
          </Link>
          {' · '}
          <Link href="/admin/knowledge" className={styles.link}>
            Knowledge (DB)
          </Link>
          {' · '}
          <Link href="/" className={styles.link}>
            Home
          </Link>
        </p>
      </header>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {missingNames.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Missing prompts (Bootstrap / Create draft)</h2>
              <p className={styles.meta}>Create a draft for a known prompt name. Then edit in PourLaMaquette/prompts-drafts and promote via scripts/promote-prompt.mjs.</p>
              <ul className={styles.missingList}>
                {missingNames.map((name) => (
                  <li key={name} className={styles.missingItem}>
                    <code>{name}</code>
                    <button
                      type="button"
                      className={styles.bootstrapBtn}
                      onClick={() => handleBootstrap(name)}
                      disabled={bootstrapBusy !== null}
                    >
                      {bootstrapBusy === name ? 'Creating…' : 'Bootstrap / Create draft'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Published</h2>
            {published.length === 0 ? (
              <p className={styles.meta}>No published prompts.</p>
            ) : (
              published.map((p) => (
                <div key={p.name} className={styles.card}>
                  <div className={styles.cardName}>{p.name}</div>
                  <div className={styles.meta}>
                    version {p.version}
                    {p.token_budget_target != null && ` · ${p.token_budget_target} tokens target`}
                  </div>
                  <div className={styles.meta}>{p.purpose_en}</div>
                  {p.safety_notes_en && (
                    <div className={styles.meta}>Safety: {p.safety_notes_en}</div>
                  )}
                  <pre className={styles.pre}>
                    {p.system ? `[system]\n${p.system}\n\n` : ''}[user]\n{p.user_template}
                  </pre>
                </div>
              ))
            )}
          </section>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Drafts</h2>
            {drafts.length === 0 ? (
              <p className={styles.meta}>No draft prompts.</p>
            ) : (
              drafts.map((p) => (
                <div key={p.name} className={styles.card}>
                  <div className={styles.cardName}>{p.name} (draft)</div>
                  <div className={styles.meta}>version {p.version}</div>
                  <div className={styles.meta}>{p.purpose_en}</div>
                  <pre className={styles.pre}>
                    {p.user_template || '(empty)'}
                  </pre>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
