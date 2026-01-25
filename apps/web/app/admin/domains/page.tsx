'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type EffortType =
  | 'quiz'
  | 'listen'
  | 'speak'
  | 'read'
  | 'write'
  | 'drill'
  | 'simulation'
  | 'checklist'
  | 'reflection'
  | 'watch'
  | 'practice'
  | 'review';

type ResourceProvider = 'loecsen' | 'youtube' | 'web' | 'userProvided';

type DomainPlaybook = {
  id: string;
  label: string;
  version: number;
  profile: { label: string; intent: string; audience?: string };
  allowedEffortTypes: EffortType[];
  weights: Partial<Record<EffortType, number>>;
  rules: string[];
  remediationRules: string[];
  resourcePolicy: {
    allowSearch: boolean;
    maxResources: number;
    preferOrder: ResourceProvider[];
    languageFallback: boolean;
  };
};

type DomainsPayload = {
  registry: DomainPlaybook[];
  overrides: { playbooks: DomainPlaybook[] };
  resolved: DomainPlaybook[];
  validation: { ok: boolean; errors?: string[] };
};

const allEfforts: EffortType[] = [
  'quiz',
  'listen',
  'speak',
  'read',
  'write',
  'drill',
  'simulation',
  'checklist',
  'reflection',
  'watch',
  'practice',
  'review',
];

const allProviders: ResourceProvider[] = ['loecsen', 'youtube', 'web', 'userProvided'];

const toLines = (value: string[]) => value.join('\n');
const fromLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export default function AdminDomainsPage() {
  const searchParams = useSearchParams();
  const isDev = process.env.NODE_ENV === 'development';
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY;
  const key = searchParams.get('key') ?? '';
  const hasAccess = isDev || (adminKey && key === adminKey);

  const [data, setData] = useState<DomainsPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<DomainPlaybook | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAccess) return;
    void (async () => {
      const response = await fetch(`/api/admin/domains?key=${encodeURIComponent(key)}`);
      const payload = (await response.json()) as DomainsPayload;
      if (response.ok) {
        setData(payload);
        const firstId = payload.resolved[0]?.id ?? '';
        setSelectedId(firstId);
      }
    })();
  }, [hasAccess, key]);

  useEffect(() => {
    if (!data || !selectedId) return;
    const resolved = data.resolved.find((entry) => entry.id === selectedId) ?? null;
    setDraft(resolved ? JSON.parse(JSON.stringify(resolved)) : null);
  }, [data, selectedId]);

  if (!hasAccess) {
    return (
      <section className="admin-shell">
        <div className="admin-card">
          <h1>Not found</h1>
          <p>This page is not available.</p>
        </div>
      </section>
    );
  }

  const resolvedJson = draft ? JSON.stringify(draft, null, 2) : '';

  const updateAllowed = (effort: EffortType, enabled: boolean) => {
    if (!draft) return;
    const allowed = new Set(draft.allowedEffortTypes);
    if (enabled) {
      allowed.add(effort);
    } else {
      allowed.delete(effort);
    }
    setDraft({ ...draft, allowedEffortTypes: Array.from(allowed) });
  };

  const updateWeight = (effort: EffortType, value: number) => {
    if (!draft) return;
    setDraft({ ...draft, weights: { ...draft.weights, [effort]: value } });
  };

  const updatePolicy = (patch: Partial<DomainPlaybook['resourcePolicy']>) => {
    if (!draft) return;
    setDraft({ ...draft, resourcePolicy: { ...draft.resourcePolicy, ...patch } });
  };

  const updateOverride = async (action: 'save' | 'reset' | 'validate') => {
    if (!data || !draft) return;
    setStatus(null);
    if (action === 'reset') {
      const response = await fetch(`/api/admin/domains/reset?key=${encodeURIComponent(key)}`, {
        method: 'POST',
      });
      const payload = (await response.json()) as DomainsPayload;
      if (response.ok) {
        setData({ ...data, ...payload });
        setStatus('Reset ok');
      }
      return;
    }
    if (action === 'save') {
      const overrides = {
        playbooks: [
          ...data.overrides.playbooks.filter((entry) => entry.id !== draft.id),
          draft,
        ],
      };
      const response = await fetch(`/api/admin/domains/save?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides),
      });
      const payload = (await response.json()) as DomainsPayload;
      if (response.ok) {
        setData({ ...data, overrides: payload.overrides, resolved: payload.resolved });
        setStatus('Saved');
      } else {
        setStatus('Save failed');
      }
      return;
    }
    if (action === 'validate') {
      const response = await fetch(`/api/admin/domains?key=${encodeURIComponent(key)}`);
      const payload = (await response.json()) as DomainsPayload;
      if (response.ok) {
        setData(payload);
        setStatus(payload.validation.ok ? 'Validation OK' : 'Validation failed');
      }
    }
  };

  const resolvedList = data?.resolved ?? [];
  const validationErrors = data?.validation?.errors ?? [];
  const validationBanner = data?.validation
    ? data.validation.ok
      ? 'Validation OK'
      : 'Validation errors'
    : null;

  return (
    <section className="admin-shell">
      <div className="admin-header">
        <h1>Domains</h1>
        <p>Playbooks and domain profiles.</p>
      </div>
      {validationBanner && (
        <div className="admin-section">
          <div className="admin-card">
            <strong>{validationBanner}</strong>
            {validationErrors.length > 0 && (
              <div className="admin-muted">{validationErrors.length} issue(s)</div>
            )}
          </div>
        </div>
      )}

      <div className="admin-section admin-grid">
        <div className="admin-card">
          <h2>Domains</h2>
          <div className="admin-style-list">
            {resolvedList.map((entry) => (
              <button
                key={entry.id}
                className={`admin-style-card ${entry.id === selectedId ? 'is-active' : ''}`}
                type="button"
                onClick={() => setSelectedId(entry.id)}
              >
                <div>
                  <div className="admin-style-title">
                    <strong>{entry.id}</strong>
                  </div>
                  <div className="admin-style-meta">v{entry.version}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <h2>Editor</h2>
          {!draft ? (
            <p className="admin-muted">Select a domain to edit.</p>
          ) : (
            <>
              <label className="input-label">Label</label>
              <input
                type="text"
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              />

              <label className="input-label">Profile label</label>
              <input
                type="text"
                value={draft.profile.label}
                onChange={(event) =>
                  setDraft({ ...draft, profile: { ...draft.profile, label: event.target.value } })
                }
              />

              <label className="input-label">Profile intent</label>
              <textarea
                rows={3}
                value={draft.profile.intent}
                onChange={(event) =>
                  setDraft({ ...draft, profile: { ...draft.profile, intent: event.target.value } })
                }
              />

              <label className="input-label">Profile audience</label>
              <input
                type="text"
                value={draft.profile.audience ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    profile: { ...draft.profile, audience: event.target.value },
                  })
                }
              />

              <div className="admin-section">
                <h3>Allowed efforts</h3>
                <div className="day-grid">
                  {allEfforts.map((effort) => (
                    <label key={effort} className="toggle-row">
                      <span>{effort}</span>
                      <input
                        type="checkbox"
                        checked={draft.allowedEffortTypes.includes(effort)}
                        onChange={(event) => updateAllowed(effort, event.target.checked)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="admin-section">
                <h3>Weights</h3>
                <div className="admin-style-list">
                  {draft.allowedEffortTypes.map((effort) => (
                    <label key={effort} className="toggle-row">
                      <span>{effort}</span>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={draft.weights[effort] ?? 1}
                        onChange={(event) =>
                          updateWeight(effort, Number(event.target.value) || 0)
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              <label className="input-label">Rules (one per line)</label>
              <textarea
                rows={4}
                value={toLines(draft.rules)}
                onChange={(event) => setDraft({ ...draft, rules: fromLines(event.target.value) })}
              />

              <label className="input-label">Remediation rules (one per line)</label>
              <textarea
                rows={3}
                value={toLines(draft.remediationRules)}
                onChange={(event) =>
                  setDraft({ ...draft, remediationRules: fromLines(event.target.value) })
                }
              />

              <div className="admin-section">
                <h3>Resource policy</h3>
                <label className="toggle-row">
                  <span>Allow search</span>
                  <input
                    type="checkbox"
                    checked={draft.resourcePolicy.allowSearch}
                    onChange={(event) => updatePolicy({ allowSearch: event.target.checked })}
                  />
                </label>
                <label className="toggle-row">
                  <span>Language fallback</span>
                  <input
                    type="checkbox"
                    checked={draft.resourcePolicy.languageFallback}
                    onChange={(event) => updatePolicy({ languageFallback: event.target.checked })}
                  />
                </label>
                <label className="input-label">Max resources (0-5)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={draft.resourcePolicy.maxResources}
                  onChange={(event) =>
                    updatePolicy({ maxResources: Number(event.target.value) || 0 })
                  }
                />
                <div className="admin-style-list">
                  {allProviders.map((provider) => (
                    <label key={provider} className="toggle-row">
                      <span>{provider}</span>
                      <input
                        type="checkbox"
                        checked={draft.resourcePolicy.preferOrder.includes(provider)}
                        onChange={(event) => {
                          const set = new Set(draft.resourcePolicy.preferOrder);
                          if (event.target.checked) {
                            set.add(provider);
                          } else {
                            set.delete(provider);
                          }
                          updatePolicy({ preferOrder: Array.from(set) });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="admin-section">
                <h3>Version</h3>
                <div className="admin-actions">
                  <span className="admin-muted">v{draft.version}</span>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setDraft({ ...draft, version: draft.version + 1 })}
                  >
                    Bump version
                  </button>
                </div>
              </div>

              <div className="admin-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => updateOverride('validate')}
                >
                  Validate
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => updateOverride('save')}
                >
                  Save
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => updateOverride('reset')}
                >
                  Reset
                </button>
              </div>

              {status && <p className="admin-muted">{status}</p>}
              {validationErrors.length > 0 && (
                <pre className="admin-code-block">{validationErrors.join('\n')}</pre>
              )}

              <label className="input-label">Resolved JSON</label>
              <div className="admin-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(resolvedJson);
                      setCopyStatus('Copied');
                      setTimeout(() => setCopyStatus(null), 1200);
                    } catch {
                      setCopyStatus('Copy failed');
                    }
                  }}
                >
                  Copy JSON
                </button>
                {copyStatus && <span className="admin-muted">{copyStatus}</span>}
              </div>
              <textarea readOnly rows={10} value={resolvedJson} />
            </>
          )}
        </div>
      </div>

      <div className="admin-footer-link">
        <a href="/">Retour à l’accueil</a>
      </div>
    </section>
  );
}
