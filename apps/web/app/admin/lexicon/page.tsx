'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '../rules/page.module.css';

const showDevTools =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === '1';

export default function AdminLexiconPage() {
  const [published, setPublished] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [targetLang, setTargetLang] = useState('ro');
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<string | null>(null);

  useEffect(() => {
    if (!showDevTools) return;
    fetch('/api/lexicon/packs')
      .then((r) => r.json())
      .then((data: { published: string[]; drafts: string[] }) => {
        setPublished(data.published ?? []);
        setDrafts(data.drafts ?? []);
      })
      .catch(() => {});
  }, []);

  const handleBootstrap = async () => {
    const lang = targetLang.trim().toLowerCase().slice(0, 10);
    if (!lang) return;
    setBootstrapLoading(true);
    setBootstrapResult(null);
    try {
      const res = await fetch('/api/lexicon/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_lang: lang }),
      });
      const data = await res.json();
      setBootstrapResult(JSON.stringify(data, null, 2));
      if (data.ok && data.source === 'draft') {
        setDrafts((prev) => (prev.includes(lang.split('-')[0]) ? prev : [...prev, lang.split('-')[0]]));
      }
    } catch (e) {
      setBootstrapResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBootstrapLoading(false);
    }
  };

  if (!showDevTools) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.backLink}>
        ← Home
      </Link>
      <Link href="/admin/rules" className={styles.backLink} style={{ marginLeft: 8 }}>
        Rules
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Language Packs (Lexicon)</h1>
        <p className={styles.subtitle}>
          On-demand lexicon packs for unknown languages. Fallback always works; no blocking.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Published packs</h2>
        <p className={styles.pipelineStepMeta}>
          {published.length === 0 ? 'None (lib/lexicon/packs/ is empty)' : published.join(', ')}
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Draft packs (dev-only)</h2>
        <p className={styles.pipelineStepMeta}>
          {drafts.length === 0 ? 'None' : drafts.join(', ')}
        </p>
        <p className={styles.pipelineStepMeta}>
          Promote: <code>node scripts/promote-lexicon-pack.mjs &lt;lang&gt;</code>
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Bootstrap language pack</h2>
        <div className={styles.searchRow}>
          <label className={styles.simulatorLabel} htmlFor="target-lang">
            target_lang (BCP-47)
          </label>
          <input
            id="target-lang"
            type="text"
            className={styles.simulatorInput}
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            placeholder="ro, pt, pt-BR…"
          />
          <button
            type="button"
            className={styles.simulatorButton}
            onClick={handleBootstrap}
            disabled={bootstrapLoading}
          >
            {bootstrapLoading ? 'Bootstrap…' : 'Bootstrap'}
          </button>
        </div>
        {bootstrapResult && (
          <pre className={styles.pipelineStepMeta} style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>
            {bootstrapResult}
          </pre>
        )}
      </section>
    </div>
  );
}
