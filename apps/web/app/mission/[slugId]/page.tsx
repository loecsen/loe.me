'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { buildInitialProgress, recomputeStates } from '@loe/core';
import type { LearningPath, LearningPathBlueprintV2, MissionFull, MissionStub, TraceEvent } from '@loe/core';
import MissionDashboard from '../MissionDashboard';
import { useI18n } from '../../components/I18nProvider';
import { getImageStyle } from '../../lib/images/styles';
import { getSelectedStyleId } from '../../lib/images/styleSelection';
import {
  buildRitualStorageKey,
  getRitualIdByShortId,
  RITUAL_INDEX_KEY,
  setRitualIdMapEntry,
  type RitualIndexItem,
  type RitualRecord,
} from '../../lib/rituals/inProgress';
import styles from './page.module.css';
import { buildShortId } from '../../lib/slugify';

type PendingRequest = {
  ritualId: string;
  intention: string;
  days: number;
  locale?: string;
  category?: string;
  clarification?: RitualRecord['clarification'];
  goalClarification?: unknown;
  realismAck?: boolean;
};

type MissionsResponse = {
  ritualId?: string;
  needsClarification?: boolean;
  clarification?: { mode?: string; reason_code?: string; question?: string; type?: string };
  reason_code?: string;
  category?: string;
  audience_safety_level?: 'all_ages' | 'adult_only' | 'blocked';
  debugTrace?: TraceEvent[];
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
  debugMeta?: RitualIndexItem['debugMeta'];
};

const PENDING_REQUEST_KEY = 'loe.pending_ritual_request';
const PLACEHOLDER_TITLE = 'Mission en création…';
const safeJson = async <T,>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

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

const buildPlaceholderPath = (intention: string, days: number): LearningPath => {
  const stepsPerLevel = 7;
  const totalSteps = Math.max(1, Math.floor(days));
  const levels: LearningPath['levels'] = [];
  const levelCount = Math.ceil(totalSteps / stepsPerLevel);
  let stepIndex = 0;
  for (let levelIndex = 0; levelIndex < levelCount; levelIndex += 1) {
    const steps = [];
    for (let i = 0; i < stepsPerLevel && stepIndex < totalSteps; i += 1) {
      const stepId = `step-${levelIndex + 1}-${i + 1}`;
      const missionId = `mission-${levelIndex + 1}-${i + 1}`;
      steps.push({
        id: stepId,
        title: PLACEHOLDER_TITLE,
        competencyId: 'comp-1',
        axis: 'understand',
        effortType: 'practice',
        durationMin: 5,
        required: true,
        missionId,
      });
      stepIndex += 1;
    }
    levels.push({
      id: `level-${levelIndex + 1}`,
      title: `Semaine ${levelIndex + 1}`,
      steps,
    });
  }
  return {
    id: 'path-pending',
    pathTitle: intention ? intention.charAt(0).toUpperCase() + intention.slice(1) : 'Ta routine',
    pathSummary: '',
    pathDescription: '',
    feasibilityNote: '',
    ritualMode: 'progression',
    validationMode: 'automatic',
    gatingMode: 'soft',
    competencies: [{ id: 'comp-1', title: 'Compétence', description: 'Compétence en préparation' }],
    resourcePolicy: { mode: 'prefer_cached', allowEnglishFallback: true, maxExternalLinksPerMission: 3 },
    budgetHints: { maxTokensPerMission: 420, maxSearchCallsPerMission: 1, imageGenerationMode: 'top_k', topKImages: 4 },
    levels,
  };
};

const seedPendingRitual = (pending: PendingRequest) => {
  if (typeof window === 'undefined') return;
  try {
    const existing = window.localStorage.getItem(buildRitualStorageKey(pending.ritualId));
    if (existing) {
      const parsed = JSON.parse(existing) as RitualRecord;
      if (parsed?.status === 'ready') {
        return;
      }
    }
  } catch {
    // ignore
  }
  const path = buildPlaceholderPath(pending.intention, pending.days);
  const legacyBlueprint = toLegacyBlueprint(path);
  const pathState = recomputeStates({
    blueprint: legacyBlueprint,
    progress: buildInitialProgress(legacyBlueprint),
  });
  const missions = path.levels.flatMap((level) =>
    level.steps.map((step) => ({
      id: step.missionId ?? step.id,
      title: PLACEHOLDER_TITLE,
      summary: '',
      competencyId: step.competencyId,
      axis: step.axis,
      durationMin: step.durationMin,
      contentStatus: 'generating' as const,
    })),
  );
  const styleId = getSelectedStyleId();
  const style = getImageStyle(styleId);
  const now = new Date().toISOString();
  const record: RitualRecord = {
    ritualId: pending.ritualId,
    intention: pending.intention.trim(),
    days: pending.days,
    status: 'generating',
    category: pending.category,
    createdAt: now,
    updatedAt: now,
    clarification: pending.clarification,
    pathTitle: path.pathTitle,
    pathSummary: '',
    pathDescription: '',
    feasibilityNote: '',
    previewStubs: missions.slice(0, 4).map((mission, index) => ({
      title: mission.title,
      summary: mission.summary ?? '',
      effortType: 'practice',
      estimatedMinutes: 10,
      dayIndex: index + 1,
    })),
    imageStyleId: style.id,
    imageStyleVersion: style.version,
    imageStylePrompt: style.prompt,
    path: pathState,
    missions,
    pathSource: path,
    missionStubsSource: [],
    missionsByIdSource: {},
  };
  const rawIndex = window.localStorage.getItem(RITUAL_INDEX_KEY);
  const list = rawIndex ? (JSON.parse(rawIndex) as RitualIndexItem[]) : [];
  const indexItem: RitualIndexItem = {
    ritualId: record.ritualId,
    intention: record.intention,
    days: record.days,
    status: record.status,
    category: record.category,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    clarification: record.clarification,
    pathTitle: record.pathTitle,
    pathSummary: record.pathSummary,
    pathDescription: record.pathDescription,
    feasibilityNote: record.feasibilityNote,
    previewStubs: record.previewStubs,
    imageStyleId: record.imageStyleId,
    imageStyleVersion: record.imageStyleVersion,
    imageStylePrompt: record.imageStylePrompt,
  };
  const nextIndex = [indexItem, ...list.filter((i) => i.ritualId !== pending.ritualId)];
  window.localStorage.setItem(buildRitualStorageKey(pending.ritualId), JSON.stringify(record));
  window.localStorage.setItem(RITUAL_INDEX_KEY, JSON.stringify(nextIndex));
  window.localStorage.setItem(
    'loe.ritual',
    JSON.stringify({
      ritualId: record.ritualId,
      intention: record.intention,
      days: record.days,
      proposal: null,
      createdAt: record.createdAt,
      lastActiveAt: now,
    }),
  );
  window.localStorage.setItem(
    'loe.missionData',
    JSON.stringify({
      ritualId: record.ritualId,
      ritualKey: `${record.intention}::${record.days}`,
      generatedAt: now,
      path: pathState,
      missions,
      sourcePath: path,
      sourceMissionStubs: [],
      sourceMissionsById: {},
    }),
  );
  window.sessionStorage.setItem('loe.active_ritual_id', pending.ritualId);
};

export default function MissionSlugPage() {
  const router = useRouter();
  const params = useParams();
  const { locale, t } = useI18n();
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [status, setStatus] = useState<'pending' | 'ready' | 'error'>('pending');
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [showPetals, setShowPetals] = useState(false);
  const inflightRef = useRef(false);
  const pollRef = useRef<number | null>(null);
  const readyHydratedRef = useRef(false);

  const slugIdParam = Array.isArray(params?.slugId) ? params?.slugId[0] : params?.slugId;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!slugIdParam || typeof slugIdParam !== 'string') {
      router.replace('/');
      return;
    }
    const shortId = slugIdParam.split('-').pop() ?? '';
    if (!shortId) {
      router.replace('/');
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(PENDING_REQUEST_KEY);
      if (raw) {
        const pending = JSON.parse(raw) as PendingRequest;
        if (pending?.ritualId && buildShortId(pending.ritualId) === shortId) {
          setRitualIdMapEntry(pending.ritualId);
          setPendingRequest(pending);
          seedPendingRitual(pending);
          return;
        }
      }
    } catch {
      // ignore
    }

    const mappedId = getRitualIdByShortId(shortId);
    const rawIndex = window.localStorage.getItem(RITUAL_INDEX_KEY);
    const list = rawIndex ? (JSON.parse(rawIndex) as RitualIndexItem[]) : [];
    const indexMatch = list.find((entry) => entry?.ritualId && buildShortId(entry.ritualId) === shortId);
    const ritualId = mappedId ?? indexMatch?.ritualId ?? '';

    if (!ritualId) {
      router.replace('/');
      return;
    }

    setRitualIdMapEntry(ritualId);

    let record: RitualRecord | null = null;
    try {
      const rawRecord = window.localStorage.getItem(buildRitualStorageKey(ritualId));
      if (rawRecord) {
        record = JSON.parse(rawRecord) as RitualRecord;
      }
    } catch {
      // ignore
    }

    const fallback: PendingRequest = {
      ritualId,
      intention: record?.intention ?? indexMatch?.intention ?? t.missionTitle,
      days: record?.days ?? indexMatch?.days ?? 21,
      locale,
      category: record?.category,
      clarification: record?.clarification,
    };

    if (record?.status === 'ready' && record.path && Array.isArray(record.missions)) {
      try {
        window.localStorage.setItem(
          'loe.ritual',
          JSON.stringify({
            ritualId,
            intention: record.intention,
            days: record.days,
            proposal: null,
            createdAt: record.createdAt,
            lastActiveAt: new Date().toISOString(),
          }),
        );
        window.localStorage.setItem(
          'loe.missionData',
          JSON.stringify({
            ritualId,
            ritualKey: `${record.intention}::${record.days}`,
            generatedAt: new Date().toISOString(),
            path: record.path,
            missions: record.missions,
            sourcePath: record.pathSource,
            sourceMissionStubs: record.missionStubsSource,
            sourceMissionsById: record.missionsByIdSource,
          }),
        );
        window.sessionStorage.setItem('loe.active_ritual_id', ritualId);
      } catch {
        // ignore
      }
      setStatus('ready');
      setPendingRequest(null);
      return;
    }

    setPendingRequest(fallback);
    seedPendingRitual(fallback);
  }, [locale, router, slugIdParam, t.missionTitle]);

  const hydrateFromGenerate = (data: MissionsResponse, pending: PendingRequest) => {
    const ritualId = data.ritualId ?? pending.ritualId;
    if (!ritualId || !data.path || !Array.isArray(data.missionStubs)) {
      setStatus('error');
      return;
    }
    const legacyBlueprint = toLegacyBlueprint(data.path);
    const pathState = recomputeStates({
      blueprint: legacyBlueprint,
      progress: buildInitialProgress(legacyBlueprint),
    });
    const fullMissions = new Map((data.missions ?? []).map((m: MissionFull) => [m.id, m]));
    const missionsByIdSource = (data.missions ?? []).reduce<Record<string, MissionFull>>((acc, m: MissionFull) => {
      acc[m.id] = m;
      return acc;
    }, {});
    const mergedMissions = data.missionStubs.map((stub) => {
      const full = fullMissions.get(stub.id);
      if (full) {
        return {
          ...stub,
          blocks: full.blocks,
          generatedAt: new Date().toISOString(),
          contentStatus: 'ready' as const,
        };
      }
      return { ...stub, contentStatus: 'missing' as const };
    });
    const styleId = getSelectedStyleId();
    const style = getImageStyle(styleId);
    const now = new Date().toISOString();
    const record: RitualRecord = {
      ritualId,
      intention: pending.intention.trim(),
      days: pending.days,
      status: 'ready',
      category: data.category ?? pending.category,
      audience_safety_level: data.audience_safety_level,
      createdAt: now,
      updatedAt: now,
      clarification: pending.clarification,
      pathTitle: data.path.pathTitle,
      pathSummary: data.path.pathSummary,
      pathDescription: data.path.pathDescription,
      feasibilityNote: data.path.feasibilityNote,
      previewStubs: data.missionStubs.slice(0, 4).map((stub) => {
        const stubWithMeta = stub as MissionStub & { dayIndex?: number; effortType?: string; estimatedMinutes?: number };
        return {
          title: stub.title,
          summary: stub.summary,
          effortType: stubWithMeta.effortType ?? 'practice',
          estimatedMinutes: stubWithMeta.estimatedMinutes ?? 10,
          dayIndex: stubWithMeta.dayIndex,
        };
      }),
      imageStyleId: style.id,
      imageStyleVersion: style.version,
      imageStylePrompt: style.prompt,
      path: pathState,
      missions: mergedMissions,
      pathSource: data.path,
      missionStubsSource: data.missionStubs,
      missionsByIdSource,
      debugMeta: data.debugMeta,
    };
    const rawIndex = window.localStorage.getItem(RITUAL_INDEX_KEY);
    const list = rawIndex ? (JSON.parse(rawIndex) as RitualIndexItem[]) : [];
    const indexItem: RitualIndexItem = {
      ritualId: record.ritualId,
      intention: record.intention,
      days: record.days,
      status: record.status,
      category: record.category,
      audience_safety_level: data.audience_safety_level ?? record.audience_safety_level,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      clarification: record.clarification,
      pathTitle: record.pathTitle,
      pathSummary: record.pathSummary,
      pathDescription: record.pathDescription,
      feasibilityNote: record.feasibilityNote,
      previewStubs: record.previewStubs,
      imageStyleId: record.imageStyleId,
      imageStyleVersion: record.imageStyleVersion,
      imageStylePrompt: record.imageStylePrompt,
      debugMeta: record.debugMeta,
    };
    const nextIndex = [indexItem, ...list.filter((i: RitualIndexItem) => i.ritualId !== ritualId)];
    window.localStorage.setItem(buildRitualStorageKey(ritualId), JSON.stringify(record));
    window.localStorage.setItem(RITUAL_INDEX_KEY, JSON.stringify(nextIndex));
    setRitualIdMapEntry(ritualId);
    window.localStorage.setItem(
      'loe.ritual',
      JSON.stringify({
        ritualId,
        intention: record.intention,
        days: record.days,
        proposal: null,
        createdAt: record.createdAt,
        lastActiveAt: now,
      }),
    );
    window.localStorage.setItem(
      'loe.missionData',
      JSON.stringify({
        ritualId,
        ritualKey: `${record.intention}::${record.days}`,
        generatedAt: now,
        path: pathState,
        missions: mergedMissions,
        sourcePath: data.path,
        sourceMissionStubs: data.missionStubs,
        sourceMissionsById: missionsByIdSource,
      }),
    );
    window.sessionStorage.setItem('loe.active_ritual_id', ritualId);
    window.sessionStorage.removeItem(PENDING_REQUEST_KEY);
    setStatus('ready');
    setShowPetals(true);
    setShowReadyModal(true);
    window.setTimeout(() => setShowPetals(false), 1800);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('loe:rituals:refresh'));
    }
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const runGenerate = async () => {
    if (!pendingRequest) return;
    const ritualId = pendingRequest.ritualId;
    if (inflightRef.current) return;
    inflightRef.current = true;
    const logWarn = (...args: unknown[]) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Mission]', ...args);
      }
    };
    try {
      const statusRes = await fetch(`/api/rituals/${ritualId}/status`);
      const statusPayload = await safeJson<{ status?: string; lastError?: string; locked?: boolean }>(statusRes);
      if (!statusPayload) {
        logWarn('Status payload manquant', { ritualId });
        setStatus('pending');
        return;
      }
      if (statusPayload.status === 'error') {
        logWarn('Status error', { ritualId, statusPayload });
        setStatus('error');
        return;
      }
      if (statusPayload.status === 'ready') {
        setStatus('ready');
        if (readyHydratedRef.current) {
          return;
        }
        readyHydratedRef.current = true;
        const readyRes = await fetch(`/api/rituals/${ritualId}`);
        const readyPayload = await safeJson<MissionsResponse>(readyRes);
        if (readyRes.ok && readyPayload?.path && readyPayload?.missionStubs) {
          hydrateFromGenerate(readyPayload, pendingRequest);
        } else {
          readyHydratedRef.current = false;
        }
        return;
      }
      if (statusPayload.locked) {
        logWarn('Génération verrouillée (pending)', { ritualId });
        setStatus('pending');
        return;
      }
      setStatus('pending');
      const res = await fetch('/api/missions/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-loe-source': 'mission',
        },
        body: JSON.stringify({
          ritualId,
          intention: pendingRequest.intention,
          days: pendingRequest.days,
          locale: pendingRequest.locale ?? locale,
          category: pendingRequest.category,
          clarification: pendingRequest.clarification,
          goal_clarification: pendingRequest.goalClarification,
          realism_acknowledged: pendingRequest.realismAck ?? false,
          skip_gates: true,
        }),
      });
      if (res.status === 409) {
        logWarn('Génération déjà en cours (409)', { ritualId });
        return;
      }
      const data = await safeJson<{ data?: MissionsResponse } & MissionsResponse>(res);
      if (!data) {
        logWarn('Réponse generate invalide', { ritualId, status: res.status });
        setStatus('pending');
        return;
      }
      const payload = data?.data ?? data;
      if (!res.ok) {
        logWarn('Réponse generate non OK', { ritualId, status: res.status, data });
        setStatus('pending');
        return;
      }
      if (data?.blocked || payload?.blocked) {
        logWarn('Génération bloquée (sécurité)', { ritualId, payload });
        setStatus('pending');
        return;
      }
      if (payload?.needsClarification) {
        logWarn('Génération nécessite clarification', { ritualId, payload });
        setStatus('pending');
        return;
      }
      if (payload?.path && payload?.missionStubs) {
        hydrateFromGenerate(payload as MissionsResponse, pendingRequest);
      } else {
        logWarn('Payload generate incomplet', { ritualId, payload });
      }
    } finally {
      inflightRef.current = false;
    }
  };

  useEffect(() => {
    if (!pendingRequest) return;
    runGenerate();
    pollRef.current = window.setInterval(runGenerate, 1500);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [locale, pendingRequest, router]);

  const showPreparing = status !== 'ready';

  return (
    <div className={styles.shell}>
      <MissionDashboard preparing={showPreparing} preparingStatus={status} />
      {showPetals && (
        <div className={styles.petalBurst} aria-hidden="true">
          {Array.from({ length: 24 }).map((_, index) => {
            const isLeft = index % 2 === 0;
            const delay = (index % 6) * 0.05;
            const duration = 1.2 + (index % 5) * 0.12;
            const translateX = isLeft ? 120 + (index % 4) * 40 : -120 - (index % 4) * 40;
            const translateY = -40 - (index % 6) * 18;
            const rotate = (index % 8) * 18;
            const color = index % 3 === 0 ? '#f7b27d' : '#ff9ab5';
            return (
              <span
                key={`${index}-${color}`}
                className={`${styles.petal} ${isLeft ? styles.petalLeft : styles.petalRight}`}
                style={
                  {
                    '--delay': `${delay}s`,
                    '--duration': `${duration}s`,
                    '--tx': `${translateX}px`,
                    '--ty': `${translateY}px`,
                    '--rot': `${rotate}deg`,
                    '--color': color,
                  } as CSSProperties
                }
              />
            );
          })}
        </div>
      )}
      {showReadyModal && (
        <div className={styles.readyOverlay} role="dialog" aria-modal="true">
          <div className={styles.readyModal}>
            <h2>Ta routine est en place 🌸</h2>
            <p>Tout est prêt. Tu peux commencer maintenant ou partager ta routine.</p>
            <div className={styles.readyActions}>
              <button className={styles.primaryBtn} type="button" onClick={() => setShowReadyModal(false)}>
                Démarrer
              </button>
              <button className={styles.secondaryBtn} type="button">
                Partager
              </button>
              <button className={styles.secondaryBtn} type="button">
                Inviter des amis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
