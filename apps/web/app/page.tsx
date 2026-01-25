'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useI18n } from './components/I18nProvider';
import PlanImage from './components/PlanImage';
import {
  buildRitualStorageKey,
  RITUAL_INDEX_KEY,
  type RitualIndexItem,
  type RitualRecord,
} from './lib/rituals/inProgress';

const dayOptions = [7, 14, 21, 30, 60, 90] as const;

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const showDebug =
    process.env.NODE_ENV === 'development' || searchParams.get('debug') === '1';
  const [intention, setIntention] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(14);
  const [customDays, setCustomDays] = useState('');
  const [ritualIndex, setRitualIndex, ritualsReady] = useLocalStorage<RitualIndexItem[]>(
    RITUAL_INDEX_KEY,
    [],
  );

  const placeholderText = useMemo(() => t.placeholders.join('\n'), [t.placeholders]);

  const finalDays = useMemo(() => {
    const parsed = Number(customDays);
    if (customDays && !Number.isNaN(parsed)) {
      return parsed;
    }
    return selectedDays ?? 14;
  }, [customDays, selectedDays]);

  const createRitualId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `ritual_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!intention.trim()) {
      return;
    }
    const ritualId = createRitualId();
    const now = new Date().toISOString();
    const record: RitualRecord = {
      ritualId,
      intention: intention.trim(),
      days: finalDays,
      status: 'generating',
      createdAt: now,
      updatedAt: now,
    };
    setRitualIndex((prev) => [record, ...prev]);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(buildRitualStorageKey(ritualId), JSON.stringify(record));
      } catch {
        // ignore write errors
      }
    }
    router.push(`/ritual/${ritualId}`);
  };

  const getRitualVariant = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  };

  return (
    <section className="home-shell">
      <div className="home-hero">
        <div className="home-mark">
          <div className="home-logo-icon" aria-hidden="true" />
          <span className="home-logo-text">Loe.me</span>
        </div>
        <p className="home-tagline">{t.homeTagline}</p>
        <h1>{t.homeHeroTitle}</h1>
      </div>

      <form className="ritual-form ritual-form-card" onSubmit={handleSubmit}>
        <label className="input-label" htmlFor="ritual-intention">
          {t.homeIntentionLabel}
        </label>
        <textarea
          id="ritual-intention"
          placeholder={placeholderText}
          value={intention}
          onChange={(event) => setIntention(event.target.value)}
          rows={4}
        />
        <div className="ritual-docs">
          <button className="text-button ritual-docs-button" type="button">
            {t.homeAddDocs}
          </button>
          <span className="ritual-docs-tag">{t.homeGuided}</span>
        </div>
        <p className="ritual-helper">{t.homeDocsHelper}</p>

        <div className="ritual-days">
          <p className="ritual-question">{t.homeDaysQuestion}</p>
          <div className="ritual-days-slider">
            <span>
              {finalDays}
              {t.daysLong}
            </span>
            <input
              type="range"
              min={7}
              max={90}
              step={1}
              value={finalDays}
              onChange={(event) => {
                setCustomDays(event.target.value);
                setSelectedDays(null);
              }}
              aria-label="Durée du rituel en jours"
            />
          </div>
          <div className="chip-row chip-row-pills">
            {dayOptions.map((days) => (
              <button
                key={days}
                type="button"
                className={`chip chip-pill ${selectedDays === days ? 'chip-active' : ''}`}
                onClick={() => {
                  setSelectedDays(days);
                  setCustomDays('');
                }}
              >
                {days}
                {t.daysShort}
              </button>
            ))}
          </div>
        </div>

        <button className="primary-button ritual-cta ritual-cta-wide" type="submit">
          {t.homeCreate}
        </button>
      </form>

      <div className="home-history">
        <div>
          <h2>{t.homeHistoryTitle}</h2>
          <p>{t.homeHistorySubtitle}</p>
        </div>
        {!ritualsReady ? (
          <div className="home-history-empty">{t.homeHistoryLoading}</div>
        ) : ritualIndex.length > 0 ? (
          <div className="home-grid">
            {ritualIndex.slice(0, 7).map((ritual) => {
              const ritualId = ritual.ritualId;
              const variant = getRitualVariant(ritualId);
              const hasFavorite = variant % 4 === 0;
              return (
                <div
                  key={ritualId}
                  className="mission-card"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    if ((event.target as HTMLElement | null)?.closest('.mission-delete')) {
                      return;
                    }
                    router.push(`/ritual/${ritualId}`);
                  }}
                  onKeyDown={(event) => {
                    if ((event.target as HTMLElement | null)?.closest('.mission-delete')) {
                      return;
                    }
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      router.push(`/ritual/${ritualId}`);
                    }
                  }}
                >
                  <div className="mission-thumb">
                    {hasFavorite && <span className="mission-star">★</span>}
                    <PlanImage
                      intention={ritual.intention}
                      title={ritual.pathTitle ?? ritual.intention}
                      styleId={ritual.imageStyleId}
                      styleVersion={ritual.imageStyleVersion}
                      stylePrompt={ritual.imageStylePrompt}
                      className="mission-thumb-image"
                    />
                  </div>
                  <div className="mission-meta">
                    <div className="mission-meta-row">
                      <span className="mission-avatar" aria-hidden="true" />
                      <div className="mission-meta-title">
                        <span className="mission-title">
                          {ritual.pathTitle ?? ritual.intention}
                        </span>
                        {!ritual.pathTitle && (
                          <span className="mission-subtitle">{t.homeMissionFallback}</span>
                        )}
                      </div>
                    </div>
                    {ritual.pathSummary && (
                      <p className="mission-subtitle">{ritual.pathSummary}</p>
                    )}
                    {showDebug && ritual.debugMeta && (
                      <div className="mission-subtitle">
                        domain={ritual.debugMeta.domainId} v=
                        {ritual.debugMeta.domainPlaybookVersion} · validation=
                        {ritual.debugMeta.validationMode} · stubs=
                        {ritual.debugMeta.stubsCount} · full=
                        {ritual.debugMeta.fullCount} · plan=
                        {ritual.debugMeta.promptPlan?.promptVersion} (
                        {ritual.debugMeta.promptPlan?.promptHash?.slice(0, 8)}) · planMs=
                        {ritual.debugMeta.promptPlan?.latencyMs} · next=
                        {ritual.debugMeta.promptFull?.promptVersion} (
                        {ritual.debugMeta.promptFull?.promptHash?.slice(0, 8)}) · nextMs=
                        {ritual.debugMeta.promptFull?.latencyMs}
                        {ritual.debugMeta.qualityWarnings?.length
                          ? ` · warnings=${ritual.debugMeta.qualityWarnings.join(',')}`
                          : ''}
                        {ritual.debugMeta.axisMapped?.length
                          ? ` · axisMapped=${ritual.debugMeta.axisMapped.length} (${ritual.debugMeta.axisMapped
                              .slice(0, 3)
                              .map((entry) => `${entry.from}→${entry.to}`)
                              .join(', ')})`
                          : ''}
                        {ritual.debugMeta.zodIssues
                          ? ` · zodIssues=${JSON.stringify(ritual.debugMeta.zodIssues).slice(
                              0,
                              120,
                            )}…`
                          : ''}
                        {ritual.debugMeta.axisMapped?.length ? (
                          <span className="chip chip-pill" style={{ marginLeft: 6 }}>
                            axis mapped: {ritual.debugMeta.axisMapped.length}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <div className="mission-viewed">
                      Viewed{' '}
                      {ritual.createdAt
                        ? new Date(ritual.createdAt).toLocaleDateString()
                        : t.homeUnknownDate}
                    </div>
                    <button
                      className="mission-delete"
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setRitualIndex((prev) =>
                          prev.filter((item) => item.ritualId !== ritualId),
                        );
                        if (typeof window !== 'undefined') {
                          try {
                            window.localStorage.removeItem(buildRitualStorageKey(ritualId));
                          } catch {
                            // ignore
                          }
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="home-history-empty">{t.homeHistoryEmpty}</div>
        )}
      </div>

      <div className="home-admin-link">
        <a href="/admin/images?key=1">Retour à l’admin images</a>
      </div>
    </section>
  );
}
