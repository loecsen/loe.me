'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

const CATEGORIES = ['LEARN', 'CREATE', 'PERFORM', 'WELLBEING', 'SOCIAL', 'CHALLENGE'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  LEARN: 'Apprendre & comprendre',
  CREATE: 'Créer & s\'exprimer',
  PERFORM: 'Progresser & performer',
  WELLBEING: 'Changer & s\'ancrer',
  SOCIAL: 'Social & collectif',
  CHALLENGE: 'Défis & transformations',
};

type IdeaRoutine = {
  id: string;
  category: string;
  title_en: string;
  intent_en: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
};

type PromptEntry = {
  name: string;
  version: string;
  purpose_en?: string;
  system?: string;
  user_template: string;
  input_schema?: Record<string, unknown>;
};

const PROMPT_NAME = 'idea_routines_generator_v1';

export default function AdminIdeaRoutinesPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<PromptEntry | null>(null);
  const [items, setItems] = useState<IdeaRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, { title_en: string; intent_en: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [generateCategory, setGenerateCategory] = useState<string>(CATEGORIES[0]);
  const [generateBusy, setGenerateBusy] = useState(false);

  const fetchPrompt = useCallback(async () => {
    try {
      const res = await fetch('/api/prompts/list');
      const data = (await res.json()) as { published?: PromptEntry[] };
      const found = (data.published ?? []).find((p) => p.name === PROMPT_NAME);
      setPrompt(found ?? null);
    } catch {
      setPrompt(null);
    }
  }, []);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/idea-routines/list?limit=500');
      const data = (await res.json()) as { items?: IdeaRoutine[] };
      const list = data.items ?? [];
      setItems(list);
      const next: Record<string, { title_en: string; intent_en: string }> = {};
      list.forEach((r) => {
        next[r.id] = { title_en: r.title_en, intent_en: r.intent_en };
      });
      setEditing(next);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      router.replace('/');
      return;
    }
    setLoading(true);
    Promise.all([fetchPrompt(), fetchList()]).finally(() => setLoading(false));
  }, [router, fetchPrompt, fetchList]);

  const byCategory = CATEGORIES.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    routines: items.filter((r) => r.category === cat).slice(0, 21),
  }));

  const handleSave = async (r: IdeaRoutine) => {
    const draft = editing[r.id];
    if (!draft || (draft.title_en === r.title_en && draft.intent_en === r.intent_en)) return;
    setSavingId(r.id);
    try {
      const res = await fetch('/api/idea-routines/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...r,
          title_en: draft.title_en,
          intent_en: draft.intent_en,
        }),
      });
      if (res.ok) await fetchList();
    } finally {
      setSavingId(null);
    }
  };

  const handleGenerate21 = async () => {
    setGenerateBusy(true);
    try {
      const res = await fetch('/api/idea-routines/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: generateCategory }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) await fetchList();
    } finally {
      setGenerateBusy(false);
    }
  };

  const handleRebuildIndex = async () => {
    try {
      await fetch('/api/idea-routines/indexes/rebuild', { method: 'POST' });
      await fetchList();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className={styles.wrap}>
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Admin — Suggestions de rituels</h1>
        <p className={styles.subtitle}>
          Prompt de génération puis résultats éditables par catégorie (6 × 21 suggestions). Dev-only.
        </p>
        <p style={{ marginTop: 8 }}>
          <Link href="/admin/prompts" className={styles.link}>
            Admin Prompts
          </Link>
          {' · '}
          <Link href="/admin/rules" className={styles.link}>
            Admin Rules
          </Link>
          {' · '}
          <Link href="/" className={styles.link}>
            Home
          </Link>
        </p>
      </header>

      {/* 1) Prompt */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Prompt de génération</h2>
        {prompt ? (
          <div className={styles.promptBlock}>
            <p className={styles.promptMeta}>
              <strong>{prompt.name}</strong> v{prompt.version}
              {prompt.purpose_en && ` — ${prompt.purpose_en}`}
            </p>
            <p className={styles.promptVars}>
              Variables : <code>{'{{category}}'}</code> (ex. LEARN), <code>{'{{category_name}}'}</code> (ex. Learn &amp; understand).
            </p>
            {prompt.system && (
              <div className={styles.promptField}>
                <label className={styles.promptLabel}>System</label>
                <pre className={styles.promptPre}>{prompt.system}</pre>
              </div>
            )}
            <div className={styles.promptField}>
              <label className={styles.promptLabel}>User template</label>
              <pre className={styles.promptPre}>{prompt.user_template}</pre>
            </div>
            <p className={styles.promptEdit}>
              Fichier : <code>apps/web/app/lib/prompts/published/idea_routines_generator_v1.json</code>
            </p>
          </div>
        ) : (
          <p>Prompt non trouvé. Vérifier que <code>{PROMPT_NAME}</code> est publié.</p>
        )}
      </section>

      {/* 2) Résultats par catégorie */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Résultats éditables par catégorie (6 × 21)</h2>
        <div className={styles.toolbar}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleRebuildIndex}>
            Rebuild index
          </button>
          <span className={styles.toolbarLabel}>Générer 21 pour :</span>
          <select
            className={styles.select}
            value={generateCategory}
            onChange={(e) => setGenerateCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c} — {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.btn}
            onClick={handleGenerate21}
            disabled={generateBusy}
          >
            {generateBusy ? 'Génération…' : 'Générer 21'}
          </button>
        </div>

        {byCategory.map(({ category, label, routines }) => (
          <div key={category} className={styles.categoryBlock}>
            <h3 className={styles.categoryTitle}>
              {category} — {label} ({routines.length}/21)
            </h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thIndex}>#</th>
                  <th>Titre (EN)</th>
                  <th>Intent (EN)</th>
                  <th className={styles.thAction}>Action</th>
                </tr>
              </thead>
              <tbody>
                {routines.map((r, i) => {
                  const draft = editing[r.id] ?? { title_en: r.title_en, intent_en: r.intent_en };
                  return (
                    <tr key={r.id}>
                      <td className={styles.tdIndex}>{i + 1}</td>
                      <td>
                        <input
                          type="text"
                          className={styles.input}
                          value={draft.title_en}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [r.id]: { ...draft, title_en: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className={styles.input}
                          value={draft.intent_en}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [r.id]: { ...draft, intent_en: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className={styles.tdAction}>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          disabled={savingId === r.id || (draft.title_en === r.title_en && draft.intent_en === r.intent_en)}
                          onClick={() => handleSave(r)}
                        >
                          {savingId === r.id ? '…' : 'Enregistrer'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {routines.length === 0 && (
              <p className={styles.emptyCategory}>Aucune suggestion pour cette catégorie. Utiliser « Générer 21 » ci-dessus.</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
