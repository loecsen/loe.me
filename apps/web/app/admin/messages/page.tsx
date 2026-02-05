'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { translations } from '../../lib/i18n';
import { SCENARIO_MESSAGES } from '../../lib/admin/scenarioMessages';
import type { ScenarioMessageEntry } from '../../lib/admin/scenarioMessages';
import styles from './page.module.css';

const PAGE_TITLE = 'Messages selon les scénarios';
const PAGE_SUBTITLE =
  'Messages affichés en français selon le parcours (variantes support, sécurité, ambition, etc.). L’action indique d’où vient le message. Les modifications sont enregistrées en surcharge (data/i18n-overrides.json).';

const showDevTools =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === '1';

const frDefaults = translations.fr as Record<string, string>;

function groupByGroup(entries: ScenarioMessageEntry[]): Map<string, ScenarioMessageEntry[]> {
  const m = new Map<string, ScenarioMessageEntry[]>();
  for (const e of entries) {
    const list = m.get(e.group) ?? [];
    list.push(e);
    m.set(e.group, list);
  }
  return m;
}

export default function AdminMessagesPage() {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadOverrides = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messages-overrides');
      const data = (await res.json()) as { fr?: Record<string, string> };
      setOverrides(data.fr ?? {});
      const merged: Record<string, string> = {};
      for (const e of SCENARIO_MESSAGES) {
        merged[e.key] = (data.fr ?? {})[e.key] ?? frDefaults[e.key] ?? '';
      }
      setLocalValues(merged);
    } catch {
      const merged: Record<string, string> = {};
      for (const e of SCENARIO_MESSAGES) {
        merged[e.key] = frDefaults[e.key] ?? '';
      }
      setLocalValues(merged);
      setOverrides({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showDevTools) {
      router.replace('/');
      return;
    }
    loadOverrides();
  }, [router, loadOverrides]);

  const setValue = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    setSaveMessage(null);
    try {
      const res = await fetch('/api/admin/messages-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fr: localValues }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string } | undefined;
      if (data?.ok) {
        setOverrides(localValues);
        setSaveStatus('success');
        setSaveMessage('Surcharges enregistrées. Recharge la page d’accueil pour voir les changements.');
      } else {
        setSaveStatus('error');
        setSaveMessage(data?.error ?? 'Erreur lors de l’enregistrement.');
      }
    } catch (err) {
      setSaveStatus('error');
      setSaveMessage(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  };

  const grouped = groupByGroup(SCENARIO_MESSAGES);
  const groupOrder = Array.from(grouped.keys()).sort();

  if (!showDevTools) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      <Link href="/admin/rules" className={styles.backLink}>
        ← Rules
      </Link>
      <Link href="/admin/eval" className={styles.backLink}>
        Eval
      </Link>
      <Link href="/" className={styles.backLink}>
        Home
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>{PAGE_TITLE}</h1>
        <p className={styles.subtitle}>{PAGE_SUBTITLE}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer les surcharges'}
          </button>
        </div>
        {saveStatus === 'success' && <p className={styles.success}>{saveMessage}</p>}
        {saveStatus === 'error' && <p className={styles.error}>{saveMessage}</p>}
      </header>

      <section className={styles.section}>
        {loading ? (
          <p className={styles.meta}>Chargement…</p>
        ) : (
          <>
            {groupOrder.map((group) => (
              <div key={group}>
                <h2 className={styles.groupTitle}>{group}</h2>
                {(grouped.get(group) ?? []).map((entry) => (
                  <div key={entry.key} className={styles.row}>
                    <div>
                      <div className={styles.actionLabel}>{entry.action}</div>
                      <div className={styles.keyLabel}>{entry.key}</div>
                    </div>
                    <div>
                      <textarea
                        className={styles.input}
                        value={localValues[entry.key] ?? ''}
                        onChange={(e) => setValue(entry.key, e.target.value)}
                        rows={Math.max(2, Math.ceil(((localValues[entry.key] ?? '').length || 40) / 50))}
                        placeholder={frDefaults[entry.key] ?? ''}
                        aria-label={entry.action}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
