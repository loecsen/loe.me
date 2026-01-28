'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Lexicon, LexRule, ReasonCode } from '@loe/core';

type ValidationResult = { ok: boolean; errors?: string[] };

type SafetyPayload = {
  lexicon: Lexicon;
  validation: ValidationResult;
};

type RuleRef = { scope: 'global' | 'locale'; locale?: string; id: string };

const reasonCodes: ReasonCode[] = [
  'sexual_minors',
  'sexual',
  'violence',
  'hate',
  'self_harm',
  'illegal_wrongdoing',
  'extremism',
  'other',
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export default function AdminSafetyPage() {
  const searchParams = useSearchParams();
  const isDev = process.env.NODE_ENV === 'development';
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY;
  const key = searchParams.get('key') ?? '';
  const hasAccess = isDev || (adminKey && key === adminKey);

  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [selected, setSelected] = useState<RuleRef | null>(null);
  const [draft, setDraft] = useState<LexRule | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testLocale, setTestLocale] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAccess) return;
    void (async () => {
      const response = await fetch(`/api/admin/safety/lexicon?key=${encodeURIComponent(key)}`);
      const payload = (await response.json()) as SafetyPayload;
      if (response.ok) {
        setLexicon(payload.lexicon);
        setValidation(payload.validation);
      }
    })();
  }, [hasAccess, key]);

  const rulesByScope = useMemo(() => {
    if (!lexicon) return { global: [], locales: {} as Record<string, LexRule[]> };
    return {
      global: lexicon.global ?? [],
      locales: lexicon.locales ?? {},
    };
  }, [lexicon]);

  useEffect(() => {
    if (!lexicon) return;
    if (!selected) {
      const firstGlobal = lexicon.global?.[0];
      if (firstGlobal) {
        setSelected({ scope: 'global', id: firstGlobal.id });
        setDraft(clone(firstGlobal));
        return;
      }
      const firstLocale = Object.keys(lexicon.locales ?? {})[0];
      const firstRule = firstLocale ? lexicon.locales?.[firstLocale]?.[0] : undefined;
      if (firstRule) {
        setSelected({ scope: 'locale', locale: firstLocale, id: firstRule.id });
        setDraft(clone(firstRule));
      }
      return;
    }
    const current =
      selected.scope === 'global'
        ? lexicon.global.find((rule) => rule.id === selected.id)
        : lexicon.locales?.[selected.locale ?? '']?.find((rule) => rule.id === selected.id);
    setDraft(current ? clone(current) : null);
  }, [lexicon, selected]);

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

  const updateDraft = (patch: Partial<LexRule>) => {
    if (!draft || !lexicon || !selected) return;
    const nextDraft = { ...draft, ...patch };
    const nextLexicon = clone(lexicon);
    if (selected.scope === 'global') {
      nextLexicon.global = nextLexicon.global.map((rule) =>
        rule.id === selected.id ? nextDraft : rule,
      );
    } else if (selected.locale) {
      const list = nextLexicon.locales?.[selected.locale] ?? [];
      nextLexicon.locales = { ...(nextLexicon.locales ?? {}), [selected.locale]: list };
      nextLexicon.locales[selected.locale] = list.map((rule) =>
        rule.id === selected.id ? nextDraft : rule,
      );
    }
    if (patch.id && patch.id !== selected.id) {
      setSelected({ ...selected, id: patch.id });
    }
    setLexicon(nextLexicon);
    setDraft(nextDraft);
  };

  const addRule = (scope: 'global' | 'locale', locale?: string) => {
    if (!lexicon) return;
    const newRule: LexRule = {
      id: `rule_${Date.now()}`,
      reason_code: 'other',
      pattern: '',
      flags: 'i',
      severity: 'block',
    };
    const next = clone(lexicon);
    if (scope === 'global') {
      next.global = [...(next.global ?? []), newRule];
      setSelected({ scope: 'global', id: newRule.id });
    } else if (locale) {
      const list = next.locales?.[locale] ?? [];
      next.locales = { ...(next.locales ?? {}), [locale]: [...list, newRule] };
      setSelected({ scope: 'locale', locale, id: newRule.id });
    }
    setLexicon(next);
    setDraft(clone(newRule));
  };

  const deleteRule = () => {
    if (!lexicon || !selected) return;
    const next = clone(lexicon);
    if (selected.scope === 'global') {
      next.global = next.global.filter((rule) => rule.id !== selected.id);
    } else if (selected.locale) {
      const list = next.locales?.[selected.locale] ?? [];
      next.locales = {
        ...(next.locales ?? {}),
        [selected.locale]: list.filter((rule) => rule.id !== selected.id),
      };
    }
    setLexicon(next);
    setSelected(null);
    setDraft(null);
  };

  const saveLexicon = async (action: 'validate' | 'save') => {
    if (!lexicon) return;
    setStatus(null);
    const response = await fetch(
      `/api/admin/safety/lexicon?key=${encodeURIComponent(key)}&action=${action}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lexicon),
      },
    );
    const payload = (await response.json()) as SafetyPayload & { error?: string };
    if (response.ok) {
      setLexicon(payload.lexicon);
      setValidation(payload.validation);
      setStatus(action === 'save' ? 'Saved' : 'Validation OK');
    } else {
      setValidation(payload.validation ?? { ok: false, errors: [payload.error ?? 'Validation failed'] });
      setStatus('Validation failed');
    }
  };

  const runTest = async () => {
    setTestResult(null);
    if (!testInput.trim()) return;
    const response = await fetch(`/api/admin/safety/test?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testInput.trim(), locale: testLocale.trim() || undefined }),
    });
    const payload = (await response.json()) as {
      match?: { ruleId: string; reason_code: string; haystack: string; value: string } | null;
    };
    if (!response.ok) {
      setTestResult('Test failed');
      return;
    }
    if (!payload.match) {
      setTestResult('No match');
      return;
    }
    setTestResult(
      `Matched ${payload.match.ruleId} (${payload.match.reason_code}) on ${payload.match.haystack}`,
    );
  };

  const validationErrors = validation?.errors ?? [];

  return (
    <section className="admin-shell">
      <div className="admin-header">
        <h1>Safety lexicon</h1>
        <p>Hard-block rules (global + locales).</p>
      </div>

      {validation && (
        <div className="admin-section">
          <div className="admin-card">
            <strong>{validation.ok ? 'Validation OK' : 'Validation errors'}</strong>
            {validationErrors.length > 0 && (
              <ul className="admin-list">
                {validationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="admin-section admin-grid">
        <div className="admin-card">
          <h2>Global rules</h2>
          <div className="admin-list">
            {rulesByScope.global.map((rule) => (
              <button
                key={rule.id}
                type="button"
                className={`admin-row ${
                  selected?.scope === 'global' && selected.id === rule.id ? 'active' : ''
                }`}
                onClick={() => setSelected({ scope: 'global', id: rule.id })}
              >
                <span>{rule.id}</span>
                <small>{rule.reason_code}</small>
              </button>
            ))}
          </div>
          <button className="secondary-button" type="button" onClick={() => addRule('global')}>
            Add global rule
          </button>
        </div>

        <div className="admin-card">
          <h2>Locale rules</h2>
          {Object.entries(rulesByScope.locales).map(([locale, rules]) => (
            <div key={locale} style={{ marginBottom: 16 }}>
              <h3>{locale}</h3>
              <div className="admin-list">
                {rules.map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    className={`admin-row ${
                      selected?.scope === 'locale' &&
                      selected.locale === locale &&
                      selected.id === rule.id
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => setSelected({ scope: 'locale', locale, id: rule.id })}
                  >
                    <span>{rule.id}</span>
                    <small>{rule.reason_code}</small>
                  </button>
                ))}
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => addRule('locale', locale)}
              >
                Add rule for {locale}
              </button>
            </div>
          ))}
          <button
            className="secondary-button"
            type="button"
            onClick={() => addRule('locale', 'fr')}
          >
            Add rule for fr
          </button>
        </div>
      </div>

      <div className="admin-section admin-grid">
        <div className="admin-card">
          <h2>Rule editor</h2>
          {!draft ? (
            <p>Select a rule to edit.</p>
          ) : (
            <div className="admin-form">
              <label className="input-label" htmlFor="rule-id">
                ID
              </label>
              <input
                id="rule-id"
                type="text"
                value={draft.id}
                onChange={(event) => updateDraft({ id: event.target.value })}
              />
              <label className="input-label" htmlFor="rule-reason">
                Reason code
              </label>
              <select
                id="rule-reason"
                value={draft.reason_code}
                onChange={(event) => updateDraft({ reason_code: event.target.value as ReasonCode })}
              >
                {reasonCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <label className="input-label" htmlFor="rule-pattern">
                Pattern (regex)
              </label>
              <input
                id="rule-pattern"
                type="text"
                value={draft.pattern}
                onChange={(event) => updateDraft({ pattern: event.target.value })}
              />
              <label className="input-label" htmlFor="rule-flags">
                Flags
              </label>
              <input
                id="rule-flags"
                type="text"
                value={draft.flags ?? ''}
                onChange={(event) => updateDraft({ flags: event.target.value })}
              />
              <label className="input-label" htmlFor="rule-severity">
                Severity
              </label>
              <select
                id="rule-severity"
                value={draft.severity ?? 'block'}
                onChange={(event) => updateDraft({ severity: event.target.value as LexRule['severity'] })}
              >
                <option value="block">block</option>
              </select>
              <label className="input-label" htmlFor="rule-example">
                Example
              </label>
              <input
                id="rule-example"
                type="checkbox"
                checked={Boolean(draft.example)}
                onChange={(event) => updateDraft({ example: event.target.checked })}
              />
              <div className="creating-actions">
                <button className="secondary-button" type="button" onClick={deleteRule}>
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="admin-card">
          <h2>Test input</h2>
          <label className="input-label" htmlFor="test-input">
            Text
          </label>
          <textarea
            id="test-input"
            rows={4}
            value={testInput}
            onChange={(event) => setTestInput(event.target.value)}
          />
          <label className="input-label" htmlFor="test-locale">
            Locale
          </label>
          <input
            id="test-locale"
            type="text"
            value={testLocale}
            onChange={(event) => setTestLocale(event.target.value)}
          />
          <div className="creating-actions">
            <button className="primary-button" type="button" onClick={runTest}>
              Run
            </button>
          </div>
          {testResult && <p>{testResult}</p>}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-actions">
          <button className="secondary-button" type="button" onClick={() => saveLexicon('validate')}>
            Validate
          </button>
          <button className="primary-button" type="button" onClick={() => saveLexicon('save')}>
            Save
          </button>
          {status && <span>{status}</span>}
        </div>
      </div>
    </section>
  );
}
