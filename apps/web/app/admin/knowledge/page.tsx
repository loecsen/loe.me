'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DecisionRecordV1 } from '../../lib/db/types';
import type { PromptCatalogEntryV1 } from '../../lib/db/types';
import styles from './page.module.css';

const PAGE_TITLE = 'Knowledge (dev DB)';
const PAGE_SUBTITLE =
  'Decision records (AI doubt resolution) and prompt catalog. Dev-only. All data under PourLaMaquette/db.';

const showDevTools =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === '1';

export default function AdminKnowledgePage() {
  const router = useRouter();
  const [decisions, setDecisions] = useState<DecisionRecordV1[]>([]);
  const [prompts, setPrompts] = useState<PromptCatalogEntryV1[]>([]);
  const [searchIntent, setSearchIntent] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchLang, setSearchLang] = useState('');
  const [searchResults, setSearchResults] = useState<DecisionRecordV1[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDecisions = useCallback(async () => {
    try {
      const res = await fetch('/api/db/decisions?limit=20');
      const data = await res.json();
      setDecisions(data.records ?? []);
    } catch {
      setDecisions([]);
    }
  }, []);

  const loadPrompts = useCallback(async () => {
    try {
      const res = await fetch('/api/db/prompts?limit=50');
      const data = await res.json();
      setPrompts(data.entries ?? []);
    } catch {
      setPrompts([]);
    }
  }, []);

  useEffect(() => {
    if (!showDevTools) {
      router.replace('/');
      return;
    }
    setLoading(true);
    Promise.all([loadDecisions(), loadPrompts()]).finally(() => setLoading(false));
  }, [router, loadDecisions, loadPrompts]);

  const handleSearch = async () => {
    try {
      const res = await fetch('/api/db/decision/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent_substring: searchIntent.trim() || undefined,
          category: searchCategory.trim() || undefined,
          intent_lang: searchLang.trim() || undefined,
          limit: 50,
        }),
      });
      const data = await res.json();
      setSearchResults(data.records ?? []);
    } catch {
      setSearchResults([]);
    }
  };

  const handleRebuildIndexes = async () => {
    setRebuilding(true);
    try {
      await fetch('/api/db/indexes/rebuild', { method: 'POST' });
      await loadDecisions();
      await loadPrompts();
    } finally {
      setRebuilding(false);
    }
  };

  if (!showDevTools) {
    return null;
  }

  const displayList = searchResults !== null ? searchResults : decisions;

  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.backLink}>
        ← Home
      </Link>
      <Link href="/admin/rules" className={styles.backLink}>
        Rules
      </Link>
      <Link href="/admin/eval" className={styles.backLink}>
        Eval Harness
      </Link>
      <Link href="/admin/lexicon" className={styles.backLink}>
        Language Packs
      </Link>
      <Link href="/admin/llm" className={styles.backLink}>
        LLM Playground
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>{PAGE_TITLE}</h1>
        <p className={styles.subtitle}>{PAGE_SUBTITLE}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Counts</h2>
        <div className={styles.counts}>
          <span className={styles.countBadge}>decision_records: {decisions.length} (latest 20)</span>
          <span className={styles.countBadge}>prompt_catalog: {prompts.length}</span>
        </div>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleRebuildIndexes}
          disabled={rebuilding}
        >
          {rebuilding ? 'Rebuilding…' : 'Rebuild indexes'}
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Search decisions</h2>
        <div className={styles.searchRow}>
          <label className={styles.label} htmlFor="search-intent">
            Intent (substring)
          </label>
          <input
            id="search-intent"
            type="text"
            className={styles.input}
            value={searchIntent}
            onChange={(e) => setSearchIntent(e.target.value)}
            placeholder="e.g. ex, president"
          />
          <label className={styles.label} htmlFor="search-category">
            Category
          </label>
          <input
            id="search-category"
            type="text"
            className={styles.input}
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
            placeholder="LEARN, WELLBEING, …"
          />
          <label className={styles.label} htmlFor="search-lang">
            Intent lang
          </label>
          <input
            id="search-lang"
            type="text"
            className={styles.input}
            value={searchLang}
            onChange={(e) => setSearchLang(e.target.value)}
            placeholder="en, fr, …"
          />
          <button type="button" className={styles.btn} onClick={handleSearch}>
            Search
          </button>
          {searchResults !== null && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => { setSearchResults(null); }}
            >
              Clear
            </button>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {searchResults !== null ? `Search results (${displayList.length})` : 'Latest decision records'}
        </h2>
        {loading ? (
          <p className={styles.recordMeta}>Loading…</p>
        ) : (
          <div className={styles.recordList}>
            {displayList.length === 0 ? (
              <p className={styles.recordMeta}>No records. Use Home to submit intents; decisions are stored after classify/controllability.</p>
            ) : (
              displayList.map((rec) => (
                <div key={rec.id} className={styles.recordCard}>
                  <div className={styles.recordIntent}>{rec.intent_raw}</div>
                  <div className={styles.recordMeta}>
                    {rec.intent_lang} · {rec.category ?? '—'} · {rec.verdict} · {rec.updated_at}
                    {rec.intent_fingerprint != null && rec.intent_fingerprint !== '' && (
                      <> · fp={rec.intent_fingerprint}</>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ marginTop: 8 }}
                    onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                  >
                    {expandedId === rec.id ? 'Hide JSON' : 'View JSON'}
                  </button>
                  {expandedId === rec.id && (
                    <pre className={styles.recordJson}>{JSON.stringify(rec, null, 2)}</pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Prompt catalog</h2>
        <div className={styles.promptList}>
          {prompts.length === 0 ? (
            <p className={styles.recordMeta}>No prompts. Seed via script or register when calling LLMs.</p>
          ) : (
            prompts.map((p) => (
              <div key={p.id} className={styles.promptCard}>
                <div className={styles.promptName}>{p.name} @ {p.version_semver ?? p.version}</div>
                <p className={styles.promptPurpose}>{p.purpose_en}</p>
                {(p.token_budget_target != null || p.safety_notes_en) && (
                  <p className={styles.recordMeta}>
                    {p.token_budget_target != null && `tokens: ${p.token_budget_target}`}
                    {p.token_budget_target != null && p.safety_notes_en && ' · '}
                    {p.safety_notes_en && p.safety_notes_en.slice(0, 60)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
