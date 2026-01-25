'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { buildInitialProgress, recomputeStates } from '@loe/core';
import type {
  LearningPath,
  LearningPathBlueprintV2,
  LearningPathState,
  MissionFull,
  MissionStub,
} from '@loe/core';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useI18n } from '../../components/I18nProvider';
import { buildPlanImageKey, requestMissionImage } from '../../lib/images/utils';
import { getSelectedStyleId } from '../../lib/images/styleSelection';
import { getImageStyle } from '../../lib/images/styles';
import {
  buildRitualLockKey,
  buildRitualStorageKey,
  RITUAL_INDEX_KEY,
  getRitualIdMap,
  setRitualIdMap,
  type RitualIndexItem,
  type RitualRecord,
} from '../../lib/rituals/inProgress';

type MissionEntry = MissionStub & {
  blocks?: MissionFull['blocks'];
  generatedAt?: string;
  contentStatus?: 'missing' | 'ready' | 'generating' | 'error';
  effortType?: string;
  estimatedMinutes?: number;
};

type MissionData = {
  ritualId: string;
  ritualKey: string;
  generatedAt: string;
  path: LearningPathState;
  missions: MissionEntry[];
  sourcePath?: LearningPath;
  sourceMissionStubs?: MissionStub[];
  sourceMissionsById?: Record<string, MissionFull>;
  sourceMissionsByStep?: Record<string, string[]>;
  sourceStepAttempts?: Record<string, number>;
};

type MissionsResponse = {
  ritualId?: string;
  ritualPath?: string;
  path: LearningPath & {
    domainId?: string;
    domainProfile?: string;
    domainPlaybookVersion?: string;
  };
  missionStubs: Array<
    MissionStub & {
      stepId: string;
      effortType: string;
      estimatedMinutes: number;
      resources: unknown[];
    }
  >;
  missions?: MissionFull[];
  debugMeta?: {
    domainId?: string;
    domainPlaybookVersion?: string;
    validationMode?: string;
    promptPlan?: { promptHash: string; promptVersion: string; latencyMs: number };
    promptFull?: { promptHash: string; promptVersion: string; latencyMs: number };
    stubsCount?: number;
    fullCount?: number;
    qualityWarnings?: string[];
    zodIssues?: unknown;
    axisMapped?: Array<{ from: string; to: string }>;
  };
};

type RitualSnapshot = {
  ritualId: string;
  intention: string;
  days: number;
  proposal: null;
  createdAt: string;
  lastActiveAt?: string;
};

const stepDelaysMs = [0, 380, 760, 1120, 1500];
const lockTtlMs = 2 * 60 * 1000;

const toLegacyBlueprint = (path: LearningPath): LearningPathBlueprintV2 => ({
  id: path.id,
  title: path.pathTitle,
  summary: path.pathSummary,
  levels: path.levels.map((level) => ({
    id: level.id,
    title: level.title,
    steps: level.steps.map((step) => ({
      id: step.id,
      title: step.title,
      missionId: step.missionId,
      required: step.required,
      passCriteria: 'completion',
    })),
  })),
});

export default function RitualPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const ritualId = typeof params?.id === 'string' ? params.id : '';
  const { t, locale } = useI18n();
  const showDebug =
    process.env.NODE_ENV === 'development' || searchParams.get('debug') === '1';
  const [ritualIndex, setRitualIndex] = useLocalStorage<RitualIndexItem[]>(
    RITUAL_INDEX_KEY,
    [],
  );
  const [, setMissionData] = useLocalStorage<MissionData | null>('loe.missionData', null);
  const [, setCurrentRitual] = useLocalStorage<RitualSnapshot | null>('loe.ritual', null);

  const [record, setRecord] = useState<RitualRecord | null>(null);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [revealStage, setRevealStage] = useState(0);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustGoal, setAdjustGoal] = useState('');
  const [adjustDays, setAdjustDays] = useState('');
  const inflightRef = useRef(false);

  const steps = useMemo(
    () => [
      t.creatingStep1,
      t.creatingStep2,
      t.creatingStep3,
      t.creatingStep4,
      t.creatingStep5,
    ],
    [t],
  );

  useEffect(() => {
    if (!ritualId || typeof window === 'undefined') {
      return;
    }
    try {
      const map = getRitualIdMap();
      const mapped = map[ritualId];
      if (mapped && mapped !== ritualId) {
        router.replace(`/ritual/${mapped}`);
        return;
      }
      const raw = window.localStorage.getItem(buildRitualStorageKey(ritualId));
      if (!raw) {
        router.replace('/');
        return;
      }
      const parsed = JSON.parse(raw) as RitualRecord;
      setRecord(parsed);
      setAdjustGoal(parsed.intention);
      setAdjustDays(String(parsed.days));
    } catch {
      router.replace('/');
    }
  }, [ritualId, router]);

  useEffect(() => {
    let cancelled = false;
    const timers = steps.map((_, index) =>
      setTimeout(() => {
        if (!cancelled) {
          setVisibleSteps((prev) => Math.max(prev, index + 1));
        }
      }, stepDelaysMs[index] ?? stepDelaysMs[stepDelaysMs.length - 1]),
    );
    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [steps]);

  useEffect(() => {
    const ready = record?.status === 'ready';
    if (!ready) {
      setRevealStage(0);
      return;
    }
    const timers = [
      setTimeout(() => setRevealStage(1), 250),
      setTimeout(() => setRevealStage(2), 550),
      setTimeout(() => setRevealStage(3), 850),
    ];
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [record?.status]);

  const toIndexItem = useCallback((next: RitualRecord): RitualIndexItem => ({
    ritualId: next.ritualId,
    intention: next.intention,
    days: next.days,
    status: next.status,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
    pathTitle: next.pathTitle,
    pathSummary: next.pathSummary,
    pathDescription: next.pathDescription,
    feasibilityNote: next.feasibilityNote,
    previewStubs: next.previewStubs,
    imageStyleId: next.imageStyleId,
    imageStyleVersion: next.imageStyleVersion,
    imageStylePrompt: next.imageStylePrompt,
    debugMeta: next.debugMeta,
  }), []);

  const updateRecord = useCallback((next: RitualRecord) => {
    setRecord(next);
    setRitualIndex((prev) => {
      const existing = prev.find((item) => item.ritualId === next.ritualId);
      if (!existing) {
        return [toIndexItem(next), ...prev];
      }
      return prev.map((item) =>
        item.ritualId === next.ritualId ? { ...item, ...toIndexItem(next) } : item,
      );
    });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(buildRitualStorageKey(next.ritualId), JSON.stringify(next));
      } catch {
        // ignore write errors
      }
    }
  }, [setRitualIndex, toIndexItem]);

  useEffect(() => {
    if (!record || record.status !== 'generating' || !ritualId) {
      return;
    }
    if (inflightRef.current) {
      return;
    }
    if (typeof window !== 'undefined') {
      const lockKey = buildRitualLockKey(ritualId);
      const raw = window.localStorage.getItem(lockKey);
      const lockUntil = raw ? Number(raw) : 0;
      if (lockUntil && lockUntil > Date.now()) {
        return;
      }
      window.localStorage.setItem(lockKey, String(Date.now() + lockTtlMs));
    }
    inflightRef.current = true;

    let active = true;
    const run = async () => {
      const endpointUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/api/missions/generate`
          : '/api/missions/generate';
      let payload: unknown;
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[client] generate request', {
            intention: record.intention,
            days: record.days,
            locale,
            endpointUrl,
            origin: typeof window !== 'undefined' ? window.location.origin : 'server',
          });
        }
        const requestPayload = {
          intention: record.intention,
          days: record.days,
          locale,
        };
        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        });
        const rawText = await response.text();
        if (process.env.NODE_ENV !== 'production') {
          console.log('[client] generate response', {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
          });
        }
        try {
          payload = rawText ? JSON.parse(rawText) : null;
        } catch (parseError) {
          payload = { rawText };
          if (process.env.NODE_ENV !== 'production') {
            console.error('[client] generate invalid_json', parseError);
            console.log('[client] generate rawText', rawText.slice(0, 200));
          }
          if (!response.ok) {
            throw new Error(
              JSON.stringify({
                message: 'invalid_json',
                debugMeta: {
                  status: response.status,
                  statusText: response.statusText,
                  rawText,
                },
              }),
            );
          }
        }
        if (!response.ok) {
          const errorMessage =
            (payload as { error?: string } | undefined)?.error ?? 'generation_failed';
          if (process.env.NODE_ENV !== 'production') {
            console.log('[client] generate rawText', rawText.slice(0, 200));
          }
          throw new Error(
            JSON.stringify({
              message: errorMessage,
              debugMeta: {
                status: response.status,
                statusText: response.statusText,
                payload,
                rawText,
              },
            }),
          );
        }
        if (payload && typeof payload === 'object' && 'error' in (payload as Record<string, unknown>)) {
          const errorPayload = payload as {
            error?: string;
            reason?: string;
            validationErrors?: unknown;
          };
          if (process.env.NODE_ENV !== 'production') {
            console.log('[client] generate rawText', rawText.slice(0, 200));
          }
          throw new Error(
            JSON.stringify({
              message: errorPayload.error ?? 'generation_failed',
              debugMeta: {
                error: errorPayload.error,
                reason: errorPayload.reason,
                validationErrors: errorPayload.validationErrors,
                payload,
                rawText,
              },
            }),
          );
        }
        const parsedRitualId =
          (payload as { data?: { ritualId?: string } })?.data?.ritualId ??
          (payload as { ritualId?: string })?.ritualId;
        const data = (payload as { data?: MissionsResponse & { ritualPath?: string } })?.data;
        if (!data?.path || !Array.isArray(data.missionStubs)) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[client] generate invalid_payload', payload);
          }
          throw new Error(
            JSON.stringify({
              message: 'invalid_payload',
              debugMeta: { payload, rawText },
            }),
          );
        }
        const resolvedRitualId = parsedRitualId ?? data.ritualId ?? ritualId;
        if (process.env.NODE_ENV !== 'production') {
          console.log('[client] generate returned ritualId', data.ritualId, data.ritualPath);
          console.log('[client] generate parsed ritualId', parsedRitualId);
          console.log('[client] current route id', ritualId);
        }
        const legacyBlueprint = toLegacyBlueprint(data.path);
        const pathState = recomputeStates({
          blueprint: legacyBlueprint,
          progress: buildInitialProgress(legacyBlueprint),
        });
        const styleId = getSelectedStyleId();
        const style = getImageStyle(styleId);
        const fullMissions = new Map((data.missions ?? []).map((mission) => [mission.id, mission]));
        const missionsByIdSource = (data.missions ?? []).reduce<Record<string, MissionFull>>(
          (acc, mission) => {
            acc[mission.id] = mission;
            return acc;
          },
          {},
        );
        const mergedMissions: MissionEntry[] = data.missionStubs.map((stub) => {
          const full = fullMissions.get(stub.id);
          if (full) {
            return {
              ...stub,
              blocks: full.blocks,
              generatedAt: new Date().toISOString(),
              contentStatus: 'ready',
            };
          }
          return {
            ...stub,
            contentStatus: 'missing',
          };
        });
        const next: RitualRecord = {
          ...record,
          ritualId: resolvedRitualId,
          status: 'ready',
          updatedAt: new Date().toISOString(),
          pathTitle: data.path.pathTitle,
          pathSummary: data.path.pathSummary,
          pathDescription: data.path.pathDescription,
          feasibilityNote: data.path.feasibilityNote,
          previewStubs: data.missionStubs.slice(0, 4).map((stub) => ({
            title: stub.title,
            summary: stub.summary,
            effortType: stub.effortType,
            estimatedMinutes: stub.estimatedMinutes,
            dayIndex: stub.dayIndex,
          })),
          imageStyleId: style.id,
          imageStyleVersion: style.version,
          imageStylePrompt: style.prompt,
          pathSource: data.path,
          missionStubsSource: data.missionStubs,
          missionsByIdSource,
          debugMeta: data.debugMeta,
          path: pathState,
          missions: mergedMissions,
        };
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(
              buildRitualStorageKey(resolvedRitualId),
              JSON.stringify(next),
            );
            if (resolvedRitualId !== ritualId) {
              const map = getRitualIdMap();
              map[ritualId] = resolvedRitualId;
              setRitualIdMap(map);
              window.localStorage.removeItem(buildRitualStorageKey(ritualId));
              window.localStorage.removeItem(buildRitualLockKey(ritualId));
            }
          } catch {
            // ignore write errors
          }
        }
        if (active) {
          if (resolvedRitualId !== ritualId) {
            setRecord(next);
            setRitualIndex((prev) => {
              const filtered = prev.filter((item) => item.ritualId !== ritualId);
              const withoutDuplicate = filtered.filter(
                (item) => item.ritualId !== resolvedRitualId,
              );
              return [toIndexItem(next), ...withoutDuplicate];
            });
          } else {
            updateRecord(next);
          }
          router.replace(`/ritual/${resolvedRitualId}`);
        }
        try {
          const planKey = await buildPlanImageKey(record.intention.trim());
          if (process.env.NODE_ENV !== 'production') {
            console.log('[IMAGE_STYLE]', style.id, style.version);
          }
          await requestMissionImage(
            planKey,
            `${record.intention.trim()}. ${data.path.pathTitle}`,
            '340x190',
            style.id,
            {
              title: data.path.pathTitle,
              summary: data.path.pathSummary,
            },
          );
        } catch {
          // ignore prefetch errors
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[client] generate failed', error);
        }
        let debugMeta: RitualRecord['debugMeta'];
        let errorDebug: RitualRecord['errorDebug'];
        if (error instanceof Error) {
          try {
            const parsed = JSON.parse(error.message) as {
              message?: string;
              debugMeta?: unknown;
            };
            debugMeta = parsed.debugMeta as RitualRecord['debugMeta'];
            errorDebug = parsed;
          } catch {
            debugMeta = undefined;
            errorDebug = error instanceof Error ? error.message : undefined;
          }
        }
        const next: RitualRecord = {
          ...record,
          status: 'error',
          updatedAt: new Date().toISOString(),
          error: 'generation_failed',
          debugMeta,
          errorDebug,
        };
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(buildRitualStorageKey(ritualId), JSON.stringify(next));
          } catch {
            // ignore write errors
          }
        }
        if (active) {
          updateRecord(next);
        }
      } finally {
        inflightRef.current = false;
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem(buildRitualLockKey(ritualId));
          } catch {
            // ignore write errors
          }
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [locale, record, ritualId, updateRecord]);

  useEffect(() => {
    if (!record || record.status !== 'generating') {
      return;
    }
    const timer = window.setTimeout(() => {
      if (!record) {
        return;
      }
      const fallbackId = record.ritualId;
      if (fallbackId) {
        router.replace(`/ritual/${fallbackId}`);
        return;
      }
      try {
        const rawIndex = window.localStorage.getItem(RITUAL_INDEX_KEY);
        const list = rawIndex ? (JSON.parse(rawIndex) as RitualIndexItem[]) : [];
        const recent = list
          .filter((item) => item?.ritualId)
          .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))[0];
        if (recent?.ritualId) {
          router.replace(`/ritual/${recent.ritualId}`);
        }
      } catch {
        // ignore fallback errors
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [record, router]);

  const pathTitle = record?.pathTitle ?? '';
  const pathSummary = record?.pathSummary ?? '';
  const cleanSummary = (value: string) =>
    value.replace('[[WM_PLAN_V1]]', '').replace(/\s+/g, ' ').trim();
  const missionCount = Array.isArray(record?.missions) ? record?.missions.length : 0;
  const rhythm =
    record?.days && record.days <= 14 ? t.rhythmWeekly3 : t.rhythmWeekly2;

  const handleStart = () => {
    if (!record || record.status !== 'ready') {
      return;
    }
    const path = record.path as LearningPathState | undefined;
    const missions = (record.missions ?? []) as MissionEntry[];
    if (!path) {
      return;
    }
    const snapshot: RitualSnapshot = {
      ritualId: record.ritualId,
      intention: record.intention,
      days: record.days,
      proposal: null,
      createdAt: record.createdAt,
      lastActiveAt: new Date().toISOString(),
    };
    setCurrentRitual(snapshot);
    setMissionData({
      ritualId: record.ritualId,
      ritualKey: `${record.intention}::${record.days}`,
      generatedAt: new Date().toISOString(),
      path,
      missions,
      sourcePath: record.pathSource as LearningPath | undefined,
      sourceMissionStubs: record.missionStubsSource as MissionStub[] | undefined,
      sourceMissionsById: record.missionsByIdSource as Record<string, MissionFull> | undefined,
    });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('loe.ritual', JSON.stringify(snapshot));
        window.localStorage.setItem(
          'loe.missionData',
          JSON.stringify({
            ritualId: record.ritualId,
            ritualKey: `${record.intention}::${record.days}`,
            generatedAt: new Date().toISOString(),
            path,
            missions,
          }),
        );
      } catch {
        // ignore write errors
      }
    }
    router.push('/mission?start=1&ready=1');
  };

  const handleRetry = () => {
    if (!record) {
      return;
    }
    const next: RitualRecord = {
      ...record,
      status: 'generating',
      updatedAt: new Date().toISOString(),
      error: undefined,
      path: undefined,
      missions: undefined,
    };
    updateRecord(next);
  };

  const handleRegenerate = () => {
    if (!record) {
      return;
    }
    const parsedDays = Number(adjustDays);
    const safeDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : record.days;
    const next: RitualRecord = {
      ...record,
      intention: adjustGoal.trim() || record.intention,
      days: safeDays,
      status: 'generating',
      updatedAt: new Date().toISOString(),
      error: undefined,
      path: undefined,
      missions: undefined,
    };
    setShowAdjust(false);
    updateRecord(next);
  };

  const handleCopyDebug = () => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const payload = JSON.stringify(record?.errorDebug ?? {}, null, 2);
      void navigator.clipboard.writeText(payload);
    } catch {
      // ignore clipboard errors
    }
  };

  if (!record) {
    return null;
  }

  return (
    <section className="creating-shell">
      {showDebug && record?.debugMeta && (
        <div className="creating-preview-card">
          <small>
            domain={record.debugMeta.domainId} v=
            {record.debugMeta.domainPlaybookVersion} · validation=
            {record.debugMeta.validationMode} · stubs=
            {record.debugMeta.stubsCount} · full=
            {record.debugMeta.fullCount} · plan=
            {record.debugMeta.promptPlan?.promptVersion} (
            {record.debugMeta.promptPlan?.promptHash?.slice(0, 8)}) · planMs=
            {record.debugMeta.promptPlan?.latencyMs} · next=
            {record.debugMeta.promptFull?.promptVersion} (
            {record.debugMeta.promptFull?.promptHash?.slice(0, 8)}) · nextMs=
            {record.debugMeta.promptFull?.latencyMs}
            {record.debugMeta.qualityWarnings?.length
              ? ` · warnings=${record.debugMeta.qualityWarnings.join(',')}`
              : ''}
            {record.debugMeta.axisMapped?.length
              ? ` · axisMapped=${record.debugMeta.axisMapped.length} (${record.debugMeta.axisMapped
                  .slice(0, 3)
                  .map((entry) => `${entry.from}→${entry.to}`)
                  .join(', ')})`
              : ''}
            {record.debugMeta.zodIssues
              ? ` · zodIssues=${JSON.stringify(record.debugMeta.zodIssues).slice(0, 120)}…`
              : ''}
          </small>
          {record.debugMeta.axisMapped?.length ? (
            <div style={{ marginTop: 6 }}>
              <span className="chip chip-pill">
                axis mapped: {record.debugMeta.axisMapped.length}
              </span>
            </div>
          ) : null}
        </div>
      )}
      <div className="creating-hero">
        <span className="creating-kicker">{t.ritualKicker}</span>
        <h1>{record.status === 'ready' ? t.ritualTitleReady : t.ritualTitle}</h1>
        <p>{record.status === 'ready' ? t.ritualSubtitleReady : t.ritualSubtitle}</p>
      </div>

      {record.status === 'error' && (
        <div className="creating-preview-card">
          <h2 className="creating-preview-title">{t.ritualErrorTitle}</h2>
          <p className="creating-preview-summary">{t.ritualErrorBody}</p>
          {showDebug && record.errorDebug ? (
            <div style={{ marginTop: 12 }}>
              <pre className="creating-preview-summary">
                {JSON.stringify(record.errorDebug, null, 2).slice(0, 1200)}
              </pre>
              <button className="secondary-button" type="button" onClick={handleCopyDebug}>
                Copy debug
              </button>
            </div>
          ) : null}
          <div className="creating-actions">
            <button className="primary-button" type="button" onClick={handleRetry}>
              {t.ritualRetry}
            </button>
            <button className="secondary-button" type="button" onClick={() => setShowAdjust(true)}>
              {t.ritualAdjust}
            </button>
          </div>
        </div>
      )}

      {record.status !== 'error' && (
        <div className="creating-grid">
          <div className="creating-steps">
            {steps.map((step, index) => {
              const isVisible = index < visibleSteps;
              return (
                <div
                  key={step}
                  className={`creating-step-card ${isVisible ? 'is-visible' : ''}`}
                >
                  <div className="creating-step-header">
                    <span className="creating-step-index">{index + 1}</span>
                    <div className="creating-step-title">{step}</div>
                  </div>
                  <div className="creating-step-body">
                    <div className="creating-step-skeleton skeleton-line" />
                    <div className="creating-step-skeleton skeleton-line skeleton-line-short" />
                  </div>
                  <div className="creating-step-status">
                    {record.status === 'ready' ? t.creatingStatusDone : t.creatingStatusLoading}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="creating-preview">
            <div className="creating-preview-card">
              <div className="creating-preview-header">{t.ritualPreviewTitle}</div>
              <div className="creating-preview-body">
                {record.status === 'ready' && revealStage >= 1 ? (
                  <h2 className="creating-preview-title">{pathTitle}</h2>
                ) : (
                  <div className="skeleton-line skeleton-line-title" />
                )}
                {record.status === 'ready' && revealStage >= 2 ? (
                  <p className="creating-preview-summary">{cleanSummary(pathSummary)}</p>
                ) : (
                  <div className="skeleton-line skeleton-line-wide" />
                )}
                {record.status === 'ready' && revealStage >= 3 ? (
                  <div className="creating-preview-stats">
                    <div className="creating-stat">
                      <span className="stat-label">{t.homeReviewDays}</span>
                      <span className="stat-value">{record.days}</span>
                    </div>
                    <div className="creating-stat">
                      <span className="stat-label">{t.homeReviewMissions}</span>
                      <span className="stat-value">{missionCount || '—'}</span>
                    </div>
                    <div className="creating-stat">
                      <span className="stat-label">{t.homeReviewRhythm}</span>
                      <span className="stat-value">{rhythm || '—'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="skeleton-line skeleton-line-wide" />
                )}
              </div>
            </div>

            {record.status === 'ready' && (
              <div className="creating-preview-card">
                <div className="creating-preview-header">{t.ritualMissionPreviewTitle}</div>
                <div className="creating-preview-body">
                  {(record.missions as MissionEntry[] | undefined)?.slice(0, 3).map((mission) => (
                    <div key={mission.id} className="ritual-mission-row">
                      <span className="ritual-mission-dot" aria-hidden="true" />
                      <div>
                        <div className="ritual-mission-title">{mission.title}</div>
                        {mission.summary && (
                          <div className="ritual-mission-summary">{mission.summary}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="creating-actions">
              <button
                className="primary-button"
                type="button"
                onClick={handleStart}
                disabled={record.status !== 'ready'}
              >
                {t.ritualStartNow}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAdjust(true)}
              >
                {t.ritualAdjust}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdjust && (
        <div className="ritual-adjust-panel">
          <div className="ritual-adjust-card">
            <h3>{t.ritualAdjustTitle}</h3>
            <p>{t.ritualAdjustPrompt}</p>
            <label className="input-label" htmlFor="ritual-adjust-goal">
              {t.ritualAdjustGoalLabel}
            </label>
            <textarea
              id="ritual-adjust-goal"
              rows={3}
              value={adjustGoal}
              onChange={(event) => setAdjustGoal(event.target.value)}
            />
            <label className="input-label" htmlFor="ritual-adjust-days">
              {t.ritualAdjustDaysLabel}
            </label>
            <input
              id="ritual-adjust-days"
              type="number"
              min={1}
              value={adjustDays}
              onChange={(event) => setAdjustDays(event.target.value)}
            />
            <div className="creating-actions">
              <button className="primary-button" type="button" onClick={handleRegenerate}>
                {t.ritualAdjustConfirm}
              </button>
              <button className="secondary-button" type="button" onClick={() => setShowAdjust(false)}>
                {t.ritualAdjustCancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
