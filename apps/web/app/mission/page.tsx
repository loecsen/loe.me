'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildInitialProgress, recomputeStates } from '@loe/core';
import type { LearningPath, LearningPathBlueprintV2, MissionFull, MissionStub, TraceEvent } from '@loe/core';
import MissionDashboard from './MissionDashboard';
import PlanImage from '../components/PlanImage';
import DebugDecisionPanel from '../components/DebugDecisionPanel';
import { useI18n } from '../components/I18nProvider';
import { getImageStyle } from '../lib/images/styles';
import { getSelectedStyleId } from '../lib/images/styleSelection';
import {
  buildRitualStorageKey,
  RITUAL_INDEX_KEY,
  type RitualIndexItem,
  type RitualRecord,
} from '../lib/rituals/inProgress';

type ActiveRitualResponse = {
  ritualId: string;
  ritual: {
    intention?: string;
    path?: { pathTitle?: string; pathSummary?: string; pathDescription?: string };
    imageStyleId?: string;
    imageStyleVersion?: number;
    imageStylePrompt?: string;
  };
  currentStep?: {
    levelTitle?: string;
    stepTitle?: string;
    levelIndex?: number;
    stepIndex?: number;
  } | null;
  currentMissionStub?: { id: string; title: string; summary?: string } | null;
  imageUrl?: string;
};

type PendingRequest = {
  ritualId: string;
  intention: string;
  days: number;
  locale?: string;
  clarification?: RitualRecord['clarification'];
};

type MissionsResponse = {
  ritualId?: string;
  needsClarification?: boolean;
  clarification?: { mode?: string; reason_code?: string };
  reason_code?: string;
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
const PENDING_RESULT_KEY = 'loe.pending_ritual_result';

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

const formatTitle = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Ton rituel';

export default function MissionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const [active, setActive] = useState<ActiveRitualResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [creatingErrorReason, setCreatingErrorReason] = useState<string | null>(null);
  const [creatingStatus, setCreatingStatus] = useState<'idle' | 'generating' | 'error'>('idle');
  const [debugTrace, setDebugTrace] = useState<TraceEvent[] | null>(null);
  const inflightRef = useRef(false);

  const isCreating = searchParams.get('creating') === '1';
  const ritualIdParam = searchParams.get('ritualId') ?? '';

  useEffect(() => {
    if (isCreating) {
      return;
    }
    let mounted = true;
    const run = async () => {
      try {
        let ritualId = '';
        if (typeof window !== 'undefined') {
          ritualId = sessionStorage.getItem('loe.active_ritual_id') ?? '';
          if (!ritualId) {
            const raw = window.localStorage.getItem('loe.ritual');
            if (raw) {
              ritualId = (JSON.parse(raw) as { ritualId?: string })?.ritualId ?? '';
            }
          }
        }
        const url = ritualId
          ? `/api/rituals/active?ritualId=${encodeURIComponent(ritualId)}`
          : '/api/rituals/active';
        const response = await fetch(url);
        if (!response.ok) {
          setActive(null);
          return;
        }
        const payload = (await response.json()) as ActiveRitualResponse;
        if (mounted) {
          setActive(payload);
        }
      } catch {
        setActive(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [isCreating]);

  useEffect(() => {
    if (!isCreating || typeof window === 'undefined') return;
    if (pendingRequest) return;
    try {
      const resultRaw = window.sessionStorage.getItem(PENDING_RESULT_KEY);
      if (resultRaw) {
        const data = JSON.parse(resultRaw) as MissionsResponse;
        const requestRaw = window.sessionStorage.getItem(PENDING_REQUEST_KEY);
        if (!requestRaw) {
          window.sessionStorage.removeItem(PENDING_RESULT_KEY);
          router.replace('/');
          return;
        }
        const pending = JSON.parse(requestRaw) as PendingRequest;
        const ritualId = data.ritualId ?? pending.ritualId;
        if (!ritualId || !data.path || !Array.isArray(data.missionStubs)) {
          window.sessionStorage.removeItem(PENDING_RESULT_KEY);
          window.sessionStorage.removeItem(PENDING_REQUEST_KEY);
          router.replace('/');
          return;
        }
        const legacyBlueprint = toLegacyBlueprint(data.path);
        const pathState = recomputeStates({
          blueprint: legacyBlueprint,
          progress: buildInitialProgress(legacyBlueprint),
        });
        const fullMissions = new Map((data.missions ?? []).map((m: MissionFull) => [m.id, m]));
        const missionsByIdSource = (data.missions ?? []).reduce<Record<string, MissionFull>>(
          (acc, m: MissionFull) => {
            acc[m.id] = m;
            return acc;
          },
          {},
        );
        const mergedMissions = data.missionStubs.map((stub) => {
          const full = fullMissions.get(stub.id);
          if (full) {
            return {
              ...stub,
              blocks: full.blocks,
              generatedAt: new Date().toISOString(),
              contentStatus: 'ready',
            };
          }
          return { ...stub, contentStatus: 'missing' };
        });
        const styleId = getSelectedStyleId();
        const style = getImageStyle(styleId);
        const now = new Date().toISOString();
        const record: RitualRecord = {
          ritualId,
          intention: pending.intention.trim(),
          days: pending.days,
          status: 'ready',
          createdAt: now,
          updatedAt: now,
          clarification: pending.clarification,
          pathTitle: data.path.pathTitle,
          pathSummary: data.path.pathSummary,
          pathDescription: data.path.pathDescription,
          feasibilityNote: data.path.feasibilityNote,
          previewStubs: data.missionStubs.slice(0, 4).map((stub) => {
            const stubWithMeta = stub as MissionStub & {
              dayIndex?: number;
              effortType?: string;
              estimatedMinutes?: number;
            };
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
        window.sessionStorage.removeItem(PENDING_RESULT_KEY);
        router.replace('/mission?start=1&ready=1');
        return;
      }
      const raw = window.sessionStorage.getItem(PENDING_REQUEST_KEY);
      if (!raw) {
        router.replace('/');
        return;
      }
      const pending = JSON.parse(raw) as PendingRequest;
      if (!pending?.ritualId || (ritualIdParam && pending.ritualId !== ritualIdParam)) {
        router.replace('/');
        return;
      }
      setPendingRequest(pending);
      setCreatingStatus('generating');
    } catch {
      router.replace('/');
    }
  }, [isCreating, pendingRequest, ritualIdParam, router]);

  useEffect(() => {
    if (!isCreating || creatingStatus !== 'generating' || !pendingRequest) {
      return;
    }
    if (inflightRef.current) {
      return;
    }
    inflightRef.current = true;
    const run = async () => {
      try {
        setCreatingErrorReason(null);
        setDebugTrace(null);
        const response = await fetch('/api/missions/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ritualId: pendingRequest.ritualId,
            intention: pendingRequest.intention,
            days: pendingRequest.days,
            locale: pendingRequest.locale ?? locale,
            clarification: pendingRequest.clarification,
          }),
        });
        const payload = (await response.json()) as {
          data?: MissionsResponse;
          ritualId?: string;
          debugTrace?: TraceEvent[];
          blocked?: boolean;
          reason_code?: string;
        };
        if (payload?.debugTrace) {
          setDebugTrace(payload.debugTrace);
        }
        if (!response.ok) {
          if (payload && typeof payload === 'object' && 'error' in payload) {
            const errorPayload = payload as { error?: string; reason_code?: string };
            if (errorPayload.error === 'blocked') {
              setCreatingErrorReason(errorPayload.reason_code ?? 'other_blocked');
            }
          } else if (payload?.blocked) {
            setCreatingErrorReason(payload.reason_code ?? 'other');
          }
          setCreatingStatus('error');
          return;
        }
        if (payload?.debugTrace) {
          setDebugTrace(payload.debugTrace);
        }
        const clarifyPayload =
          payload?.data && typeof payload.data === 'object' && 'needsClarification' in payload.data
            ? (payload.data as { needsClarification?: boolean; clarification?: { mode?: string; reason_code?: string }; debugTrace?: TraceEvent[] })
            : payload && typeof payload === 'object' && 'needsClarification' in payload
              ? (payload as { needsClarification?: boolean; clarification?: { mode?: string; reason_code?: string }; debugTrace?: TraceEvent[] })
              : null;
        if (clarifyPayload && clarifyPayload.debugTrace) {
          setDebugTrace(clarifyPayload.debugTrace);
        }
        if (clarifyPayload?.needsClarification && clarifyPayload?.clarification?.mode === 'inline') {
          const reasonCode = clarifyPayload.clarification?.reason_code ?? 'not_actionable_inline';
          window.sessionStorage.removeItem(PENDING_REQUEST_KEY);
          inflightRef.current = false;
          router.replace(
            `/?inlineClarify=1&intention=${encodeURIComponent(pendingRequest.intention)}&reason_code=${encodeURIComponent(reasonCode)}`,
          );
          return;
        }
        const data = payload.data;
        const ritualId = data?.ritualId ?? payload.ritualId ?? pendingRequest.ritualId;
        if (!ritualId || !data?.path || !Array.isArray(data.missionStubs)) {
          setCreatingStatus('error');
          return;
        }
        const legacyBlueprint = toLegacyBlueprint(data.path);
        const pathState = recomputeStates({
          blueprint: legacyBlueprint,
          progress: buildInitialProgress(legacyBlueprint),
        });
        const fullMissions = new Map((data.missions ?? []).map((mission) => [mission.id, mission]));
        const missionsByIdSource = (data.missions ?? []).reduce<Record<string, MissionFull>>(
          (acc, mission) => {
            acc[mission.id] = mission;
            return acc;
          },
          {},
        );
        const mergedMissions = data.missionStubs.map((stub) => {
          const full = fullMissions.get(stub.id);
          if (full) {
            return {
              ...stub,
              blocks: full.blocks,
              generatedAt: new Date().toISOString(),
              contentStatus: 'ready',
            };
          }
          return { ...stub, contentStatus: 'missing' };
        });
        const styleId = getSelectedStyleId();
        const style = getImageStyle(styleId);
        const now = new Date().toISOString();
        const record: RitualRecord = {
          ritualId,
          intention: pendingRequest.intention.trim(),
          days: pendingRequest.days,
          status: 'ready',
          createdAt: now,
          updatedAt: now,
          clarification: pendingRequest.clarification,
          pathTitle: data.path.pathTitle,
          pathSummary: data.path.pathSummary,
          pathDescription: data.path.pathDescription,
          feasibilityNote: data.path.feasibilityNote,
          previewStubs: data.missionStubs.slice(0, 4).map((stub) => {
            const stubWithMeta = stub as MissionStub & {
              dayIndex?: number;
              effortType?: string;
              estimatedMinutes?: number;
            };
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
        const nextIndex = [indexItem, ...list.filter((i) => i.ritualId !== ritualId)];
        window.localStorage.setItem(buildRitualStorageKey(ritualId), JSON.stringify(record));
        window.localStorage.setItem(RITUAL_INDEX_KEY, JSON.stringify(nextIndex));
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
        router.replace('/mission?start=1&ready=1');
      } catch {
        setCreatingStatus('error');
      } finally {
        inflightRef.current = false;
      }
    };
    run();
  }, [creatingStatus, isCreating, locale, pendingRequest, router]);

  const creationIntro = useMemo(() => {
    if (!pendingRequest) return null;
    return (
      <div className="creating-preview-card">
        <div className="creating-preview-header">Titre proposé</div>
        <h2 className="creating-preview-title">{formatTitle(pendingRequest.intention)}</h2>
        <p className="creating-preview-summary">Résumé : {pendingRequest.intention}</p>
      </div>
    );
  }, [pendingRequest]);

  if (isCreating) {
    return (
      <section className="creating-shell">
        <div className="creating-hero">
          <span className="creating-kicker">{t.ritualKicker}</span>
          <h1>Ton rituel prend forme</h1>
          <p>Tu peux rester ici, on s’occupe du reste.</p>
        </div>
        {creatingStatus === 'generating' && !creatingErrorReason && creationIntro}
        {creatingStatus === 'error' && creatingErrorReason ? (
          <div className="creating-preview-card">
            <h2>{t.safetyGateBlockedTitle}</h2>
            <p>{t.safetyGateBlockedBody}</p>
            <div className="creating-actions">
              <button className="secondary-button" type="button" onClick={() => router.push('/')}>
                {t.safetyGateBack}
              </button>
            </div>
          </div>
        ) : creatingStatus === 'error' ? (
          <div className="creating-preview-card">
            <h2>{t.ritualErrorTitle}</h2>
            <p>{t.ritualErrorBody}</p>
          </div>
        ) : (
          <div className="creating-preview-card">
            <div className="ritual-loading-spinner" />
          </div>
        )}
        {debugTrace ? (
          <DebugDecisionPanel
            trace={debugTrace}
            status={creatingErrorReason ? 'BLOCKED' : 'OK'}
          />
        ) : null}
      </section>
    );
  }

  return (
    <>
      <section className="mission-shell">
        <div className="mission-header">
          <div>
            <h1 className="page-title">
              {active?.ritual?.path?.pathTitle ?? (loading ? 'Chargement…' : 'Rituel')}
            </h1>
            {active?.ritual?.path?.pathSummary && (
              <p className="mission-subtitle">
                {active.ritual.path.pathSummary.replace('[[WM_PLAN_V1]]', '').trim()}
              </p>
            )}
            {active?.ritual?.path?.pathDescription && (
              <p className="mission-subtitle">{active.ritual.path.pathDescription}</p>
            )}
            {active?.currentStep ? (
              <div className="mission-subtitle">
                Niveau {active.currentStep.levelIndex} · Étape {active.currentStep.stepIndex} —{' '}
                {active.currentStep.stepTitle}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mission-stats">
          {active?.imageUrl ? (
            <div className="plan-image">
              <img src={active.imageUrl} alt={active.ritual?.path?.pathTitle ?? 'Rituel'} />
            </div>
          ) : active?.ritual?.intention ? (
            <PlanImage
              ritualId={active.ritualId}
              intention={active.ritual.intention}
              title={active.ritual.path?.pathTitle}
              styleId={active.ritual.imageStyleId}
              styleVersion={active.ritual.imageStyleVersion}
              stylePrompt={active.ritual.imageStylePrompt}
            />
          ) : null}
        </div>
      </section>
      <MissionDashboard />
    </>
  );
}
