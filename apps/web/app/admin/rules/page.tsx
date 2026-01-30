'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { runActionabilityV2, toGateResult, inferCategoryFromIntent } from '../../lib/actionability';
import { runSoftRealism } from '../../lib/actionability/realism';
import { needsAmbitionConfirmation, isLifeGoalOrRoleAspiration } from '../../lib/actionability/ambitionConfirmation';
import { RULES_REGISTRY } from '../../lib/rules/registry';
import { CATEGORY_DISPLAY, CATEGORIES_REQUIRING_FEASIBILITY, Category } from '../../lib/category';
import type { RuleDoc } from '../../lib/rules/types';
import styles from './page.module.css';

const PAGE_TITLE = 'Ritual creation rules';
const PAGE_SUBTITLE =
  'Actionability → Borderline classifier → Safety → Category → Soft realism → Ambition confirmation';

const showDevTools =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === '1';

function groupByGate(rules: RuleDoc[]): Map<string, RuleDoc[]> {
  const m = new Map<string, RuleDoc[]>();
  for (const r of rules) {
    const list = m.get(r.gate) ?? [];
    list.push(r);
    m.set(r.gate, list);
  }
  return m;
}

function ruleMatchesSearch(rule: RuleDoc, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  const hay = [
    rule.id,
    rule.gate,
    rule.applies_when,
    rule.outcome,
    rule.reason_codes.join(' '),
    rule.category_behavior ?? '',
    rule.notes ?? '',
  ].join(' ');
  return hay.toLowerCase().includes(lower);
}

export default function AdminRulesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [simIntent, setSimIntent] = useState('devenir président de la république');
  const [simDays, setSimDays] = useState(30);
  const [simLocale, setSimLocale] = useState('fr');
  const [localResult, setLocalResult] = useState<string | null>(null);
  const [classifyResult, setClassifyResult] = useState<string | null>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);

  const filteredRules = useMemo(
    () => RULES_REGISTRY.filter((r) => ruleMatchesSearch(r, search)),
    [search],
  );
  const rulesByGate = useMemo(() => groupByGate(filteredRules), [filteredRules]);

  useEffect(() => {
    if (!showDevTools) {
      router.replace('/');
    }
  }, [router]);

  const runLocalGates = () => {
    const trimmed = simIntent.trim();
    const days = typeof simDays === 'number' && Number.isFinite(simDays) ? Math.max(7, Math.min(365, simDays)) : 14;
    const actionabilityResult = runActionabilityV2(trimmed, days);
    const gate = toGateResult(actionabilityResult);
    const category = gate.category ?? inferCategoryFromIntent(trimmed);
    const softRealism = runSoftRealism(trimmed, days, category, simLocale);
    const ambitionConfirm = needsAmbitionConfirmation(trimmed);
    const lifeGoal = isLifeGoalOrRoleAspiration(trimmed);

    const expectedHomeBranch = lifeGoal.hit
      ? 'life_goal_confirm'
      : gate.status === 'NOT_ACTIONABLE_INLINE'
        ? 'inline_hint'
        : gate.status === 'BORDERLINE'
          ? 'BORDERLINE → classify'
          : softRealism.level === 'unrealistic' && softRealism.adjustments.length > 0
            ? 'realism_pending'
            : 'proceed';

    setLocalResult(
      [
        `ActionabilityV2: ${gate.status} (reason: ${actionabilityResult.reason_code})`,
        `Category (inferred): ${category ?? '—'}`,
        `Soft realism: ${softRealism.level}${softRealism.why_short ? ` — ${softRealism.why_short}` : ''}`,
        `Ambition confirmation (unrealistic): ${ambitionConfirm}`,
        `Life-goal intercept: ${lifeGoal.hit}${lifeGoal.marker ? ` (marker: ${lifeGoal.marker})` : ''}`,
        `Expected Home branch: ${expectedHomeBranch}`,
      ].join('\n'),
    );
    setClassifyResult(null);
  };

  const callClassifyApi = async () => {
    setClassifyLoading(true);
    setClassifyResult(null);
    try {
      const res = await fetch('/api/actionability/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: simIntent.trim(),
          timeframe_days: simDays,
          display_lang: simLocale.split('-')[0],
        }),
      });
      const data = await res.json();
      setClassifyResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setClassifyResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClassifyLoading(false);
    }
  };

  if (!showDevTools) {
    return null;
  }

  const feasibilityRequired = CATEGORIES_REQUIRING_FEASIBILITY;
  const feasibilityNotRequired = [Category.PERFORM, Category.SOCIAL, Category.CHALLENGE] as const;

  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.backLink}>
        ← Home
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>{PAGE_TITLE}</h1>
        <p className={styles.subtitle}>{PAGE_SUBTITLE}</p>
        <div className={styles.badges}>
          <span className={styles.badge}>
            env: {process.env.NODE_ENV ?? 'development'}
          </span>
          <span className={styles.badge}>
            showDevTools: {process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === '1' ? '1' : '0'}
          </span>
          <span className={styles.badge}>
            build: {typeof __NEXT_DATA__ !== 'undefined' ? 'next' : '—'}
          </span>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Categories</h2>
        <div className={styles.categoriesGrid}>
          {CATEGORY_DISPLAY.map((c) => (
            <div key={c.id} className={styles.categoryCard}>
              <span className={styles.categoryEmoji}>{c.emoji}</span>
              <span className={styles.categoryLabel}>{c.label}</span>
              <div className={styles.categoryId}>{c.id}</div>
            </div>
          ))}
        </div>
        <div className={styles.feasibilityRule}>
          <strong>Feasibility required</strong> (soft realism) ={' '}
          {feasibilityRequired.join(', ')}.
          <br />
          <strong>Feasibility NOT required</strong> = {feasibilityNotRequired.join(', ')}.
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Rules (by gate)</h2>
        <div className={styles.searchRow}>
          <label className={styles.simulatorLabel} htmlFor="rules-search">
            Filter
          </label>
          <input
            id="rules-search"
            type="text"
            className={styles.simulatorInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="gate, outcome, reason_code…"
          />
        </div>
        <div className={styles.pipelineList}>
          {Array.from(rulesByGate.entries()).map(([gate, rules]) => (
            <div key={gate} className={styles.gateGroup}>
              <h3 className={styles.gateGroupTitle}>{gate}</h3>
              {rules.map((r) => (
                <div key={r.id} className={styles.pipelineStep}>
                  <div className={styles.pipelineStepName}>{r.id}</div>
                  <p className={styles.pipelineStepBut}>{r.applies_when}</p>
                  <div className={styles.ruleBadges}>
                    <span className={styles.exampleBadge}>outcome: {r.outcome}</span>
                    {r.category_behavior && (
                      <span className={styles.exampleBadgeNeutral}>{r.category_behavior}</span>
                    )}
                  </div>
                  <p className={styles.pipelineStepMeta}>
                    reason_codes: {r.reason_codes.join(', ')}
                  </p>
                  {r.notes && (
                    <p className={styles.pipelineStepMeta}>
                      <span className={styles.filePath}>{r.notes}</span>
                    </p>
                  )}
                  <div className={styles.examplesRow}>
                    <div>
                      <span className={styles.exampleLabel}>Pass: </span>
                      {r.examples_pass.length > 0
                        ? r.examples_pass.join(' · ')
                        : '—'}
                    </div>
                    <div>
                      <span className={styles.exampleLabel}>Fail: </span>
                      {r.examples_fail.length > 0
                        ? r.examples_fail.join(' · ')
                        : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Try it (local gates)</h2>
        <p className={styles.pipelineStepBut}>
          Run actionability + category + soft realism + ambition checks locally. No API call to
          missions/generate. Optional: call classify API if status is BORDERLINE.
        </p>
        <div className={styles.simulator}>
          <div className={styles.simulatorRow}>
            <label className={styles.simulatorLabel} htmlFor="sim-intent">
              Intent
            </label>
            <input
              id="sim-intent"
              type="text"
              className={styles.simulatorInput}
              value={simIntent}
              onChange={(e) => setSimIntent(e.target.value)}
              placeholder="devenir président de la république"
            />
          </div>
          <div className={styles.simulatorRow}>
            <label className={styles.simulatorLabel} htmlFor="sim-days">
              Days
            </label>
            <input
              id="sim-days"
              type="number"
              min={7}
              max={365}
              className={styles.simulatorInput}
              value={simDays}
              onChange={(e) => setSimDays(Number(e.target.value) || 14)}
            />
          </div>
          <div className={styles.simulatorRow}>
            <label className={styles.simulatorLabel} htmlFor="sim-locale">
              Locale
            </label>
            <select
              id="sim-locale"
              className={styles.simulatorSelect}
              value={simLocale}
              onChange={(e) => setSimLocale(e.target.value)}
            >
              <option value="fr">fr</option>
              <option value="en">en</option>
              <option value="es">es</option>
              <option value="de">de</option>
              <option value="it">it</option>
            </select>
          </div>
          <div className={styles.simulatorButtons}>
            <button type="button" className={styles.simulatorButton} onClick={runLocalGates}>
              Run local gates
            </button>
            <button
              type="button"
              className={`${styles.simulatorButton} ${styles.simulatorButtonSecondary}`}
              onClick={callClassifyApi}
              disabled={classifyLoading}
            >
              {classifyLoading ? 'Calling…' : 'Call classify API'}
            </button>
          </div>
          {localResult && (
            <pre className={styles.simulatorResult}>{localResult}</pre>
          )}
          {classifyResult && (
            <pre className={styles.simulatorResult}>{classifyResult}</pre>
          )}
        </div>
      </section>
    </div>
  );
}
