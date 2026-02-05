'use client';

import { useEffect, useState, useCallback } from 'react';

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

type ListResponse = {
  published: PromptEntry[];
  drafts: PromptEntry[];
  known_names: string[];
};

export type PromptTraceEntry = { prompt_name: string; response: string };

type PipelinePromptsEditorProps = {
  className?: string;
  /** Prompts utilisés pour la demande du moment + réponse LLM (V2 resolve). Null ou vide = afficher message. */
  promptTrace?: PromptTraceEntry[] | null;
  /** Reformulation (demande du moment avec jours) pour affichage dans le bloc. Ex. "Ton projet : Apprendre le chinois en 14 jours". */
  reformulationDisplay?: string | null;
};

export function PipelinePromptsEditor({ className = '', promptTrace = null, reformulationDisplay = null }: PipelinePromptsEditorProps) {
  const [list, setList] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, PromptEntry>>({});
  const [savingName, setSavingName] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ name: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/prompts/list');
      const data = (await res.json()) as ListResponse;
      setList(data);
      const byName: Record<string, PromptEntry> = {};
      for (const name of data.known_names ?? []) {
        const entry = data.published?.find((p) => p.name === name) ?? {
          name,
          version: '1.0.0',
          purpose_en: '',
          user_template: '',
          system: '',
        };
        byName[name] = { ...entry };
      }
      setEditing(byName);
    } catch {
      setList(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setEntryField = (name: string, field: 'system' | 'user_template', value: string) => {
    setEditing((prev) => {
      const next = { ...prev };
      const cur = next[name];
      if (!cur) return prev;
      next[name] = { ...cur, [field]: value };
      return next;
    });
  };

  const handleSave = async (name: string) => {
    const entry = editing[name];
    if (!entry) return;
    setSavingName(name);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/admin/prompts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, entry }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setSaveStatus({ name, ok: !!data.ok });
      if (data.ok) {
        load();
      }
    } catch {
      setSaveStatus({ name, ok: false });
    } finally {
      setSavingName(null);
    }
  };

  if (loading || !list) {
    return (
      <div className={className} aria-live="polite">
        <div className="homeDebugTitle" style={{ fontWeight: 600, marginBottom: 6 }}>
          Prompts du pipeline
        </div>
        <p className="homeDebugLegend" style={{ margin: 0, fontSize: '0.7rem', color: 'var(--loe-color-muted)' }}>
          {loading ? 'Chargement…' : 'Impossible de charger la liste.'}
        </p>
      </div>
    );
  }

  const names =
    promptTrace && promptTrace.length > 0 ? promptTrace.map((t) => t.prompt_name) : [];

  return (
    <details className={className} style={{ marginTop: 'var(--loe-space-md)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 6 }}>
        Prompts du pipeline (éditer puis Valider pour mettre à jour lib/prompts/published/*.json)
      </summary>
      {reformulationDisplay && (
        <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '6px 0 10px', color: 'var(--loe-color-text)' }}>
          {reformulationDisplay}
        </p>
      )}
      <p style={{ fontSize: '0.7rem', color: 'var(--loe-color-muted)', margin: '6px 0 12px' }}>
        {promptTrace && promptTrace.length > 0
          ? 'Uniquement les prompts utilisés pour la demande du moment. Réponse LLM affichée au-dessus du prompt.'
          : 'Soumettez une intention (parcours V2) pour voir les prompts utilisés pour cette demande.'}
      </p>
      {(!promptTrace || promptTrace.length === 0) && (
        <p style={{ fontSize: '0.75rem', color: 'var(--loe-color-muted)', margin: '8px 0', fontStyle: 'italic' }}>
          Aucun prompt à afficher. Soumettez une intention pour lancer le parcours V2.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {names.map((name) => {
          const entry = editing[name];
          if (!entry) return null;
          const traceEntry = promptTrace?.find((t) => t.prompt_name === name);
          const responseText = traceEntry?.response ?? '';
          const isSaving = savingName === name;
          const status = saveStatus?.name === name ? saveStatus : null;
          return (
            <div
              key={name}
              style={{
                border: '1px solid var(--loe-color-border)',
                borderRadius: 'var(--loe-radius-sm)',
                padding: 12,
                background: 'var(--loe-color-surface)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>{name}</div>
              {entry.purpose_en && (
                <div style={{ fontSize: '0.7rem', color: 'var(--loe-color-muted)', marginBottom: 8 }}>
                  {entry.purpose_en}
                </div>
              )}
              {responseText && (
                <>
                  <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: 4 }}>
                    Réponse (demande du moment)
                  </label>
                  <pre
                    style={{
                      margin: '0 0 12px 0',
                      padding: 8,
                      fontSize: '0.75rem',
                      fontFamily: 'ui-monospace, monospace',
                      background: 'var(--loe-color-surface)',
                      border: '1px solid var(--loe-color-border)',
                      borderRadius: 4,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {responseText}
                  </pre>
                </>
              )}
              <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: 4 }}>
                system
              </label>
              <textarea
                value={entry.system ?? ''}
                onChange={(e) => setEntryField(name, 'system', e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.75rem',
                  padding: 8,
                  boxSizing: 'border-box',
                }}
                spellCheck={false}
              />
              <label style={{ display: 'block', fontSize: '0.7rem', marginTop: 8, marginBottom: 4 }}>
                user_template
              </label>
              <textarea
                value={entry.user_template ?? ''}
                onChange={(e) => setEntryField(name, 'user_template', e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.75rem',
                  padding: 8,
                  boxSizing: 'border-box',
                }}
                spellCheck={false}
              />
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleSave(name)}
                  disabled={isSaving}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSaving ? 'Enregistrement…' : 'Valider'}
                </button>
                {status && (
                  <span style={{ fontSize: '0.75rem', color: status.ok ? 'green' : 'var(--loe-color-error, red)' }}>
                    {status.ok ? 'Enregistré.' : 'Erreur.'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
