'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { EvalRunResultV1 } from '../../lib/eval/types';
import styles from './page.module.css';

const PAGE_TITLE = 'Evaluation Harness';
const PAGE_SUBTITLE =
  'Run scenarios through the decision pipeline (V2). Results stored in PourLaMaquette/db. Dev-only.';

const showDevTools =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === '1';

const OUTCOMES = ['proceed', 'show_angles', 'needs_clarify', 'show_ambition_confirm', 'show_realism_adjust', 'choose_category', 'playful_nonsense', 'blocked'] as const;
const CATEGORIES = ['LEARN', 'CREATE', 'PERFORM', 'WELLBEING', 'SOCIAL', 'CHALLENGE'] as const;

export default function AdminEvalPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<EvalRunResultV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [runAllLoading, setRunAllLoading] = useState(false);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');
  const [filterLang, setFilterLang] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterSafety, setFilterSafety] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [sortBy, setSortBy] = useState<'updated_at' | 'scenario_id' | 'category' | 'ui_outcome'>('updated_at');
  const [sortDesc, setSortDesc] = useState(true);

  const loadRuns = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (filterCategory) params.set('category', filterCategory);
      if (filterOutcome) params.set('outcome', filterOutcome);
      if (filterLang) params.set('lang', filterLang);
      if (filterTag) params.set('tag', filterTag);
      if (filterSafety) params.set('audience_safety_level', filterSafety);
      if (searchQ.trim()) params.set('q', searchQ.trim());
      const res = await fetch(`/api/eval/runs?${params.toString()}`);
      const data = await res.json();
      setRuns(data.runs ?? []);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterOutcome, filterLang, filterTag, filterSafety, searchQ]);

  useEffect(() => {
    if (!showDevTools) {
      router.replace('/');
      return;
    }
    setLoading(true);
    loadRuns().finally(() => setLoading(false));
  }, [router, loadRuns]);

  const handleRunAll = async () => {
    setRunAllLoading(true);
    try {
      const res = await fetch('/api/eval/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_all: true }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadRuns();
      } else {
        console.error(data);
      }
    } finally {
      setRunAllLoading(false);
    }
  };

  const handleRebuildIndexes = async () => {
    setRebuildLoading(true);
    try {
      await fetch('/api/eval/indexes/rebuild', { method: 'POST' });
      await loadRuns();
    } finally {
      setRebuildLoading(false);
    }
  };

  if (!showDevTools) {
    return null;
  }

  const sorted = [...runs].sort((a, b) => {
    let va: string | number = '';
    let vb: string | number = '';
    switch (sortBy) {
      case 'updated_at':
        va = new Date(a.updated_at).getTime();
        vb = new Date(b.updated_at).getTime();
        return sortDesc ? (vb as number) - (va as number) : (va as number) - (vb as number);
      case 'scenario_id':
        va = a.scenario_id ?? '';
        vb = b.scenario_id ?? '';
        break;
      case 'category':
        va = a.category ?? '';
        vb = b.category ?? '';
        break;
      case 'ui_outcome':
        va = a.ui_outcome ?? '';
        vb = b.ui_outcome ?? '';
        break;
      default:
        return 0;
    }
    const cmp = String(va).localeCompare(String(vb));
    return sortDesc ? -cmp : cmp;
  });

  const th = (key: typeof sortBy, label: string) => (
    <th
      className={styles.th}
      onClick={() => {
        setSortBy(key);
        setSortDesc(sortBy === key ? !sortDesc : true);
      }}
      style={{ cursor: 'pointer' }}
    >
      {label} {sortBy === key && (sortDesc ? '↓' : '↑')}
    </th>
  );

  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.backLink}>
        ← Home
      </Link>
      <Link href="/admin/rules" className={styles.backLink}>
        Rules
      </Link>
      <Link href="/admin/messages" className={styles.backLink}>
        Messages
      </Link>
      <Link href="/admin/knowledge" className={styles.backLink}>
        Knowledge
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>{PAGE_TITLE}</h1>
        <p className={styles.subtitle}>{PAGE_SUBTITLE}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={handleRunAll}
            disabled={runAllLoading}
          >
            {runAllLoading ? 'Running all…' : 'Run all scenarios'}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleRebuildIndexes}
            disabled={rebuildLoading}
          >
            {rebuildLoading ? 'Rebuilding…' : 'Rebuild eval indexes'}
          </button>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Filters</h2>
        <div className={styles.filters}>
          <input
            type="text"
            className={styles.input}
            placeholder="Search intent / title"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          <select
            className={styles.select}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className={styles.select}
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
          >
            <option value="">Outcome</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <input
            type="text"
            className={styles.input}
            placeholder="intent_lang"
            value={filterLang}
            onChange={(e) => setFilterLang(e.target.value)}
          />
          <input
            type="text"
            className={styles.input}
            placeholder="tag"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          />
          <select
            className={styles.select}
            value={filterSafety}
            onChange={(e) => setFilterSafety(e.target.value)}
          >
            <option value="">Audience safety</option>
            <option value="all_ages">all_ages</option>
            <option value="adult_only">adult_only</option>
            <option value="blocked">blocked</option>
          </select>
          <button type="button" className={styles.btn} onClick={loadRuns}>
            Apply
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Runs ({sorted.length})</h2>
        {loading ? (
          <p className={styles.meta}>Loading…</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {th('scenario_id', 'Scenario ID')}
                  {th('category', 'Category')}
                  <th className={styles.th}>Subcategory</th>
                  <th className={styles.th}>Intent</th>
                  <th className={styles.th}>Days</th>
                  <th className={styles.th}>intent_lang</th>
                  <th className={styles.th}>ui_locale</th>
                  <th className={styles.th}>audience_safety</th>
                  <th className={styles.th}>controllability</th>
                  <th className={styles.th}>realism</th>
                  {th('ui_outcome', 'ui_outcome')}
                  <th className={styles.th}>tone</th>
                  <th className={styles.th}>copy_variant</th>
                  <th className={styles.th}>DB cache (aud/ctrl)</th>
                  {th('updated_at', 'updated_at')}
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <Fragment key={r.eval_run_id}>
                    <tr className={styles.tr}>
                      <td className={styles.td}>{r.scenario_id}</td>
                      <td className={styles.td}>{r.category ?? '—'}</td>
                      <td className={styles.td}>{r.sub_category ?? '—'}</td>
                      <td className={styles.td} title={r.scenario?.intent}>
                        {(r.scenario?.intent ?? '').slice(0, 40)}
                        {(r.scenario?.intent?.length ?? 0) > 40 ? '…' : ''}
                      </td>
                      <td className={styles.td}>{r.scenario?.timeframe_days ?? '—'}</td>
                      <td className={styles.td}>{r.scenario?.intent_lang ?? '—'}</td>
                      <td className={styles.td}>{r.scenario?.ui_locale ?? '—'}</td>
                      <td className={styles.td}>{r.audience_safety_level ?? '—'}</td>
                      <td className={styles.td}>{r.controllability_level ?? '—'}</td>
                      <td className={styles.td}>{r.realism_result ?? '—'}</td>
                      <td className={styles.td}>
                        <span className={styles.badgeOutcome}>{r.ui_outcome}</span>
                      </td>
                      <td className={styles.td}>{r.tone ?? '—'}</td>
                      <td className={styles.td} title={r.copy_debug_why ?? undefined}>
                        {r.copy_variant ?? '—'}
                      </td>
                      <td className={styles.td}>
                        {r.audience_safety_from_cache ? 'aud✓' : '—'}
                        {r.controllability_from_cache ? ' ctrl✓' : ''}
                      </td>
                      <td className={styles.td}>{r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}</td>
                      <td className={styles.td}>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => setExpandedId(expandedId === r.eval_run_id ? null : r.eval_run_id)}
                        >
                          {expandedId === r.eval_run_id ? 'Hide' : 'Expand'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === r.eval_run_id && (
                      <tr>
                        <td colSpan={16} className={styles.expandedTd}>
                          {(r.decision_debug as { similarity_hit?: boolean; fingerprint?: string; matched_record_id?: string } | undefined)?.similarity_hit && (
                            <div className={styles.gateTrace}>
                              <strong>Similarity (fingerprint cache)</strong>
                              <pre>
                                {JSON.stringify({
                                  similarity_hit: true,
                                  fingerprint: (r.decision_debug as { fingerprint?: string })?.fingerprint,
                                  matched_record_id: (r.decision_debug as { matched_record_id?: string })?.matched_record_id,
                                }, null, 2)}
                              </pre>
                            </div>
                          )}
                          {r.copy_debug_why != null && (
                            <div className={styles.gateTrace}>
                              <strong>copy_why</strong>
                              <pre>{r.copy_debug_why}</pre>
                            </div>
                          )}
                          <div className={styles.gateTrace}>
                            <strong>Gate trace</strong>
                            <pre>{JSON.stringify(r.gate_trace, null, 2)}</pre>
                          </div>
                          <div className={styles.fullJson}>
                            <strong>Full result (JSON)</strong>
                            <pre>{JSON.stringify(r, null, 2)}</pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && sorted.length === 0 && (
          <p className={styles.meta}>No runs. Click &quot;Run all scenarios&quot; to populate.</p>
        )}
      </section>
    </div>
  );
}
