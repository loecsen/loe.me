'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  buildInitialProgress,
  createSampleMissions_basic,
  createSamplePath_3levels_3_4_3,
  getNextAvailableStep,
  markStepCompleted,
  markStepFailed,
  markStepStarted,
  recomputeStates,
} from '@loe/core';
import type {
  LearningPath,
  LearningPathBlueprintV2,
  LearningPathState,
  MissionFull,
  MissionStub,
} from '@loe/core';

import MissionPlayer from './MissionPlayer';
import NotificationsModal from './NotificationsModal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useI18n } from '../components/I18nProvider';
import { getMissionIndex } from '../lib/images/missionIndex';
import { purgeStaleMissionContent } from '../lib/storage/purge';

const nowISO = () => new Date().toISOString();

type StepRef = { levelId: string; stepId: string } | null;

type MissionView = {
  stepTitle: string;
  levelLabel: string;
  mission?: MissionEntry;
  missionId?: string | null;
  status?: MissionStatus;
  debugMeta?: MissionData['debugMeta'];
  requestedStepId?: string | null;
  mode?: 'auto' | 'manual';
  manualMismatch?: { requestedStepId: string; returnedStepId?: string };
  progressLabel?: string;
  progressRatio?: number;
};

type RitualSnapshot = {
  ritualId: string;
  intention: string;
  days: number;
  proposal: unknown;
  createdAt: string;
  lastActiveAt?: string;
  locale?: string;
};

type MissionData = {
  ritualId?: string;
  ritualKey: string;
  generatedAt: string;
  path: LearningPathState;
  missions: MissionEntry[];
  sourcePath?: LearningPath;
  sourceMissionStubs?: MissionStub[];
  sourceMissionsById?: Record<string, MissionFull>;
  sourceMissionsByStep?: Record<string, string[]>;
  sourceStepAttempts?: Record<string, number>;
  lastProgressByMissionId?: Record<string, { outcome: string }>;
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
    lastOutcome?: string;
    remediationApplied?: boolean;
    progressCount?: number;
    lastEffortTypes?: string[];
    attemptsCount?: number;
    attemptIndex?: number;
  };
};

type MissionEntry = MissionStub & {
  blocks?: MissionFull['blocks'];
  generatedAt?: string;
  contentStatus?: 'missing' | 'ready' | 'generating' | 'error';
  effortType?: string;
  estimatedMinutes?: number;
};

type MissionStatus = 'idle' | 'generating' | 'ready' | 'error';

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

export default function MissionDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const [path, setPath] = useState<LearningPathState>(() =>
    recomputeStates(createSamplePath_3levels_3_4_3()),
  );
  const [missions, setMissions] = useState<MissionEntry[]>(() =>
    createSampleMissions_basic().map((mission) => ({
      id: mission.id,
      title: mission.title,
      summary: mission.summary ?? '',
      competencyId: 'comp-1',
      axis: 'understand',
      durationMin: 8,
    })),
  );
  const [activeStep, setActiveStep] = useState<StepRef>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [remediationHint, setRemediationHint] = useState<string | null>(null);
  const [autoStarted, setAutoStarted] = useState(false);
  const [showReady, setShowReady] = useState(false);
  const [loadingMissions, setLoadingMissions] = useState(false);
  const [missionError, setMissionError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [missionStatus, setMissionStatus] = useState<Record<string, MissionStatus>>({});
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [manualMismatch, setManualMismatch] = useState<{
    requestedStepId: string;
    returnedStepId?: string;
  } | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const modeParam = searchParams.get('mode');
  const requestedStepParam = searchParams.get('stepId');
  const isManualMode = modeParam === 'manual';
  const [lastProgressByMissionId, setLastProgressByMissionId] = useState<
    Record<string, { outcome: string }>
  >({});

  const [ritual, setRitual] = useLocalStorage<RitualSnapshot | null>('loe.ritual', null);
  const [missionData, setMissionData] = useLocalStorage<MissionData | null>(
    'loe.missionData',
    null,
  );
  const missionIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    const blueprint = path?.blueprint;
    if (!blueprint) {
      return map;
    }
    for (const mission of missions) {
      const index = getMissionIndex(mission.id, blueprint);
      if (index) {
        map.set(mission.id, index);
      }
    }
    return map;
  }, [missions, path]);

  const stepOrder = useMemo(
    () =>
      path.blueprint.levels.flatMap((level) =>
        level.steps.map((step) => ({
          stepId: step.id,
          missionId: step.missionId ?? null,
        })),
      ),
    [path.blueprint.levels],
  );
  const missionOrder = useMemo(
    () => stepOrder.map((entry) => entry.missionId).filter(Boolean) as string[],
    [stepOrder],
  );
  const missionToStepId = useMemo(
    () => new Map(stepOrder.map((entry) => [entry.missionId, entry.stepId])),
    [stepOrder],
  );

  const nextAvailableStep = useMemo(() => getNextAvailableStep(path), [path]);

  const missionsById = useMemo(
    () => new Map(missions.map((mission) => [mission.id, mission])),
    [missions],
  );

  const attemptsByStep = useMemo(() => {
    if (missionData?.sourceMissionsByStep) {
      return missionData.sourceMissionsByStep;
    }
    const fallback: Record<string, string[]> = {};
    path.blueprint.levels.forEach((level) => {
      level.steps.forEach((step) => {
        if (step.id && step.missionId) {
          fallback[step.id] = [step.missionId];
        }
      });
    });
    return fallback;
  }, [missionData?.sourceMissionsByStep, path.blueprint.levels]);

  const stepAttempts = useMemo(
    () => missionData?.sourceStepAttempts ?? {},
    [missionData?.sourceStepAttempts],
  );

  useEffect(() => {
    const shouldStart = searchParams.get('start') === '1';
    const isReady = searchParams.get('ready') === '1';
    if (!shouldStart || autoStarted) {
      if (isReady) {
        setShowReady(true);
        router.replace('/mission');
      }
      return;
    }
    const shouldWaitForData = Boolean(ritual) && (!missionData || !isHydrated) && !missionError;
    if (shouldWaitForData) {
      return;
    }
    const next = getNextAvailableStep(path);
    if (next) {
      openStep(next.levelId, next.stepId);
      setAutoStarted(true);
      router.replace('/mission');
    }
  }, [autoStarted, isHydrated, missionData, missionError, path, ritual, router, searchParams]);

  useEffect(() => {
    if (!missionData || isHydrated) {
      return;
    }
    const purged = purgeStaleMissionContent(missionData, ritual?.lastActiveAt);
    if (purged && purged !== missionData) {
      setMissionData(purged);
    }
    setPath((purged ?? missionData).path);
    setMissions((purged ?? missionData).missions);
    setLastProgressByMissionId((purged ?? missionData).lastProgressByMissionId ?? {});
    const freshStatus: Record<string, MissionStatus> = {};
    for (const mission of (purged ?? missionData).missions) {
      freshStatus[mission.id] = mission.blocks?.length ? 'ready' : 'idle';
    }
    setMissionStatus(freshStatus);
    setActiveMissionId(null);
    setIsHydrated(true);
  }, [isHydrated, missionData, ritual?.lastActiveAt, setMissionData]);

  useEffect(() => {
    setMissionStatus((prev) => {
      const next = { ...prev };
      for (const mission of missions) {
        if (mission.blocks && mission.blocks.length > 0) {
          next[mission.id] = 'ready';
        } else if (!next[mission.id] || next[mission.id] === 'ready') {
          next[mission.id] = 'idle';
        }
      }
      return next;
    });
  }, [missions]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    setMissionData((prev) => {
      if (!prev) {
        return prev;
      }
      if (prev.path === path) {
        return prev;
      }
      return { ...prev, path };
    });
  }, [isHydrated, path, setMissionData]);

  useEffect(() => {
    if (!ritual) {
      return;
    }
    const ritualKey = `${ritual.intention}::${ritual.days}`;
    if (missionData?.ritualKey === ritualKey) {
      return;
    }

    const generate = async () => {
      setLoadingMissions(true);
      setMissionError(null);
      try {
        const response = await fetch('/api/missions/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intention: ritual.intention, days: ritual.days, locale }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? 'generation_failed');
        }
        const data = payload.data as {
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
          };
        };
        const legacyBlueprint = toLegacyBlueprint(data.path);
        const pathState = recomputeStates({
          blueprint: legacyBlueprint,
          progress: buildInitialProgress(legacyBlueprint),
        });
        const fullMissions = new Map((data.missions ?? []).map((mission) => [mission.id, mission]));
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
        const nextMissionData: MissionData = {
          ritualKey,
          generatedAt: new Date().toISOString(),
          path: pathState,
          missions: mergedMissions,
          debugMeta: data.debugMeta,
        };
        setMissionData(nextMissionData);
        setPath(pathState);
        setMissions(data.missions);
        setIsHydrated(true);
        if (ritual) {
          setRitual({ ...ritual, proposal: null });
        }
      } catch {
        setMissionError('error');
      } finally {
        setLoadingMissions(false);
      }
    };

    generate();
  }, [locale, missionData?.ritualKey, ritual, setMissionData, setRitual]);

  const getStepTitle = (levelId: string, stepId: string) => {
    const level = path.blueprint.levels.find((item) => item.id === levelId);
    const step = level?.steps.find((item) => item.id === stepId);
    return step?.title ?? '—';
  };

  const getCurrentLevelLabel = () => {
    if (!path.progress.current) {
      return '—';
    }
    const levelIndex = path.blueprint.levels.findIndex(
      (item) => item.id === path.progress.current?.levelId,
    );
    return levelIndex === -1 ? '—' : `${t.missionLevelPrefix} ${levelIndex + 1}`;
  };

  const getCurrentStepLabel = () => {
    if (!path.progress.current) {
      return '—';
    }
    return getStepTitle(path.progress.current.levelId, path.progress.current.stepId);
  };

  const getMissionIdForStep = (levelId: string, stepId: string) => {
    const attempts = attemptsByStep[stepId];
    if (attempts && attempts.length > 0) {
      return attempts[attempts.length - 1] ?? null;
    }
    const level = path.blueprint.levels.find((item) => item.id === levelId);
    const step = level?.steps.find((item) => item.id === stepId);
    return step?.missionId ?? null;
  };

  const getStepIdForMission = (missionId: string | null) => {
    if (!missionId) return null;
    return missionToStepId.get(missionId) ?? missionsById.get(missionId)?.stepId ?? null;
  };

  const getPreviousMissionSummary = (missionId: string) => {
    const index = missionOrder.findIndex((id) => id === missionId);
    if (index <= 0) {
      return undefined;
    }
    const previous = missionOrder[index - 1];
    const mission = missionsById.get(previous);
    return mission?.summary;
  };

  const getNextMissionIdAfter = (missionId: string | null) => {
    if (!missionId) {
      return null;
    }
    const index = missionOrder.findIndex((id) => id === missionId);
    if (index === -1 || index + 1 >= missionOrder.length) {
      return null;
    }
    return missionOrder[index + 1] ?? null;
  };

  const getNextStepIdAfter = (missionId: string | null) => {
    const nextMissionId = getNextMissionIdAfter(missionId);
    return getStepIdForMission(nextMissionId);
  };

  const updateMissionContent = (
    mission: MissionFull & { generatedAt?: string; contentStatus?: MissionStatus },
  ) => {
    setMissions((prev) => {
      const exists = prev.some((item) => item.id === mission.id);
      if (!exists) {
        return [
          ...prev,
          {
            ...(mission as MissionEntry),
            blocks: mission.blocks,
            generatedAt: mission.generatedAt ?? new Date().toISOString(),
            contentStatus: mission.contentStatus ?? 'ready',
          },
        ];
      }
      return prev.map((item) =>
        item.id === mission.id
          ? {
              ...item,
              ...mission,
              blocks: mission.blocks,
              generatedAt: mission.generatedAt ?? item.generatedAt,
              contentStatus: mission.contentStatus ?? 'ready',
            }
          : item,
      );
    });
    setMissionData((prev) => {
      if (!prev) {
        return prev;
      }
      const exists = prev.missions.some((item) => item.id === mission.id);
      return {
        ...prev,
        missions: exists
          ? prev.missions.map((item) =>
              item.id === mission.id
                ? {
                    ...item,
                    ...mission,
                    blocks: mission.blocks,
                    generatedAt: mission.generatedAt ?? item.generatedAt,
                    contentStatus: mission.contentStatus ?? 'ready',
                  }
                : item,
            )
          : [
              ...prev.missions,
              {
                ...(mission as MissionEntry),
                blocks: mission.blocks,
                generatedAt: mission.generatedAt ?? new Date().toISOString(),
                contentStatus: mission.contentStatus ?? 'ready',
              },
            ],
      };
    });
  };

  const ensureMissionReady = async (
    missionId: string | null,
    options?: { mode?: 'auto' | 'manual'; requestedStepId?: string },
  ) => {
    if (!missionId) {
      return null;
    }
    const stepId = options?.requestedStepId ?? getStepIdForMission(missionId);
    if (!stepId) {
      return null;
    }
    if (missionData) {
      const purged = purgeStaleMissionContent(missionData, ritual?.lastActiveAt);
      if (purged && purged !== missionData) {
        setMissionData(purged);
        setMissions(purged.missions);
      }
    }
    const mission = missionsById.get(missionId);
    if (!mission) {
      return null;
    }
    if (mission.blocks && mission.blocks.length > 0) {
      setMissionStatus((prev) => ({ ...prev, [missionId]: 'ready' }));
      return mission;
    }
    if (missionStatus[missionId] === 'generating') {
      return null;
    }
    setMissionStatus((prev) => ({ ...prev, [missionId]: 'generating' }));
    try {
      if (!ritual?.ritualId) {
        throw new Error('missing_ritual_id');
      }
      const ritualSnapshot =
        missionData?.sourcePath && missionData?.sourceMissionStubs
          ? {
              ritualId: ritual.ritualId,
              intention: ritual.intention,
              days: ritual.days,
              locale: ritual.locale,
              createdAt: ritual.createdAt,
              path: missionData.sourcePath,
              missionStubs: missionData.sourceMissionStubs,
              missionsById: missionData.sourceMissionsById,
            }
          : undefined;
      const ritualIdSent = missionData?.ritualId ?? ritual.ritualId;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[client] /next body ritualId', ritualIdSent);
        console.log('[client] /next ritualId sources', {
          ritual: ritual.ritualId,
          missionData: missionData?.ritualId,
        });
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[MissionDashboard] /next request', {
          ritualId: ritualIdSent,
          mode: options?.mode ?? 'auto',
          requestedStepId: options?.requestedStepId ?? stepId,
          stepId,
        });
      }
      const response = await fetch('/api/missions/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ritualId: ritualIdSent,
          stepId,
          requestedStepId: options?.requestedStepId ?? stepId,
          mode: options?.mode ?? 'auto',
          userContext: { userLang: locale },
          ritualSnapshot,
        }),
      });
      const rawText = await response.text();
      let payload: unknown = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = { rawText };
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[MissionDashboard] /next response', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
        });
        if (!response.ok || !payload || (payload as { error?: string })?.error) {
          console.log('[MissionDashboard] /next rawText', rawText.slice(0, 200));
        }
      }
      const returnedMission = (payload as { data?: { mission?: MissionFull } })?.data?.mission;
      if (response.ok && returnedMission) {
        const hasBlocks = Boolean(returnedMission.blocks?.length);
        setActiveMissionId(returnedMission.id);
        if (options?.mode === 'manual' && options?.requestedStepId) {
          if (returnedMission.stepId !== options.requestedStepId) {
            setManualMismatch({
              requestedStepId: options.requestedStepId,
              returnedStepId: returnedMission.stepId,
            });
          } else {
            setManualMismatch(null);
          }
        }
        updateMissionContent({
          ...returnedMission,
          generatedAt: new Date().toISOString(),
          contentStatus: hasBlocks ? 'ready' : 'generating',
        } as MissionFull);
        setMissionStatus((prev) => ({
          ...prev,
          [returnedMission.id]: hasBlocks ? 'ready' : 'generating',
        }));
        setMissionData((prev) => {
          if (!prev) {
            return prev;
          }
          const stepIdForMission =
            returnedMission?.stepId ?? getStepIdForMission(missionId);
          if (!stepIdForMission) {
            return prev;
          }
          const nextMap = { ...(prev.sourceMissionsByStep ?? {}) };
          const ids = nextMap[stepIdForMission] ?? [];
          if (!ids.includes(returnedMission.id)) {
            nextMap[stepIdForMission] = [...ids, returnedMission.id];
          }
          const nextAttempts = { ...(prev.sourceStepAttempts ?? {}) };
          const debugMeta = (payload as { data?: { debugMeta?: MissionData['debugMeta'] } })?.data
            ?.debugMeta;
          if (debugMeta?.attemptsCount) {
            nextAttempts[stepIdForMission] = debugMeta.attemptsCount;
          }
          return {
            ...prev,
            sourceMissionsByStep: nextMap,
            sourceStepAttempts: nextAttempts,
          };
        });
        const debugMeta = (payload as { data?: { debugMeta?: MissionData['debugMeta'] } })?.data
          ?.debugMeta;
        if (debugMeta) {
          setMissionData((prev) =>
            prev ? { ...prev, debugMeta: { ...prev.debugMeta, ...debugMeta } } : prev,
          );
        }
        return returnedMission as MissionFull;
      }
      if (response.ok && !returnedMission) {
        setMissionStatus((prev) => ({ ...prev, [missionId]: 'generating' }));
        return null;
      }
    } catch {
      // ignore
    }
    setMissionStatus((prev) => ({ ...prev, [missionId]: 'error' }));
    return null;
  };

  const openStep = (levelId: string, stepId: string) => {
    const selectedMissionId = getMissionIdForStep(levelId, stepId);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[MissionDashboard] click step', { stepId, missionIdSelected: selectedMissionId });
    }
    setRemediationHint(null);
    setPath((prev) => markStepStarted(prev, levelId, stepId, nowISO()));
    setActiveStep({ levelId, stepId });
    setPlayerOpen(true);
    setActiveMissionId(selectedMissionId);
    setManualMismatch(null);
    if (ritual) {
      setRitual({ ...ritual, lastActiveAt: nowISO() });
    }
    const missionId = selectedMissionId;
    if (ritual?.ritualId) {
      router.replace(`/mission?ritualId=${ritual.ritualId}&stepId=${stepId}&mode=manual`);
    }
    void ensureMissionReady(missionId, { mode: 'manual', requestedStepId: stepId });
  };

  const handleComplete = (result?: { score?: number }) => {
    if (!activeStep) {
      return;
    }
    setPath((prev) => {
      const nextPath = markStepCompleted(
        prev,
        activeStep.levelId,
        activeStep.stepId,
        nowISO(),
        result ?? {},
      );
      const nextStep = getNextAvailableStep(nextPath);
      if (nextStep) {
        void ensureMissionReady(getMissionIdForStep(nextStep.levelId, nextStep.stepId), {
          mode: 'auto',
          requestedStepId: nextStep.stepId,
        });
      }
      return nextPath;
    });
    if (ritual) {
      setRitual({ ...ritual, lastActiveAt: nowISO() });
    }
    setPlayerOpen(false);
    setActiveStep(null);
  };

  const handleFail = () => {
    if (!activeStep) {
      return;
    }
    setPath((prev) => markStepFailed(prev, activeStep.levelId, activeStep.stepId, nowISO()));
    setRemediationHint(t.remediationHint);
    if (ritual) {
      setRitual({ ...ritual, lastActiveAt: nowISO() });
    }
  };

  const handleOutcome = async (payload: {
    outcome: 'success' | 'fail' | 'partial' | 'skipped';
    score?: number;
    notes?: string;
    quiz?: { questionId?: string; selectedIndex?: number; correct?: boolean };
  }) => {
    if (!activeStep || !ritual) {
      return false;
    }
    setOutcomeError(null);
    const missionId = activeMissionId ?? getMissionIdForStep(activeStep.levelId, activeStep.stepId);
    if (!missionId) {
      return false;
    }
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[MissionDashboard] outcome submit', {
          outcome: payload.outcome,
          ritualId: ritual.ritualId,
          missionId,
          stepId: activeStep.stepId,
        });
      }
      const response = await fetch('/api/missions/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ritualId: ritual.ritualId,
          missionId,
          stepId: activeStep.stepId,
          outcome: payload.outcome,
          score: payload.score,
          notes: payload.notes,
          quiz: payload.quiz,
        }),
      });
      if (!response.ok) {
        setOutcomeError(`progress ${response.status}`);
        return false;
      }
      if (response.ok) {
        const body = (await response.json()) as { progressEvent?: { missionId: string; outcome: string } };
        if (body?.progressEvent?.missionId) {
          setLastProgressByMissionId((prev) => ({
            ...prev,
            [body.progressEvent!.missionId]: { outcome: body.progressEvent!.outcome },
          }));
          setMissionData((prev) =>
            prev
              ? {
                  ...prev,
                  lastProgressByMissionId: {
                    ...(prev.lastProgressByMissionId ?? {}),
                    [body.progressEvent!.missionId]: { outcome: body.progressEvent!.outcome },
                  },
                }
              : prev,
          );
        }
      }
    } catch {
      setOutcomeError('progress failed');
      return false;
    }

    let nextStep: { levelId: string; stepId: string } | null = null;
    if (payload.outcome === 'fail' || payload.outcome === 'partial') {
      setPath((prev) => {
        const updated = markStepFailed(prev, activeStep.levelId, activeStep.stepId, nowISO());
        nextStep = getNextAvailableStep(updated);
        return updated;
      });
      setRemediationHint(t.remediationHint);
      const mission = await ensureMissionReady(missionId, { mode: 'auto' });
      if (!mission) {
        setOutcomeError("Couldn't generate next attempt");
        return false;
      }
      setActiveMissionId(mission.id);
      return true;
    } else {
      setPath((prev) => {
        const updated = markStepCompleted(prev, activeStep.levelId, activeStep.stepId, nowISO(), {
          score: payload.score ? payload.score * 100 : undefined,
        });
        nextStep = getNextAvailableStep(updated);
        return updated;
      });
    }

    if (nextStep) {
      const nextMission = await ensureMissionReady(getMissionIdForStep(nextStep.levelId, nextStep.stepId), {
        mode: 'auto',
      });
      if (!nextMission) {
        setOutcomeError("Couldn't generate next attempt");
        return false;
      }
    }

    setPlayerOpen(false);
    setActiveStep(null);
    if (ritual) {
      setRitual({ ...ritual, lastActiveAt: nowISO() });
    }
    return true;
  };

  const missionView = useMemo<MissionView | null>(() => {
    if (!activeStep) {
      return null;
    }
    const levelIndex = path.blueprint.levels.findIndex((item) => item.id === activeStep.levelId);
    const level = path.blueprint.levels[levelIndex];
    const step = level?.steps.find((item) => item.id === activeStep.stepId);
    const missionId = activeMissionId ?? step?.missionId ?? null;
    const mission = missionId ? missionsById.get(missionId) : undefined;
    const status = missionId ? missionStatus[missionId] : undefined;
    const totalSteps = stepOrder.length;
    const currentIndex = activeStep
      ? stepOrder.findIndex((entry) => entry.stepId === activeStep.stepId)
      : -1;
    const progressRatio =
      totalSteps > 0 && currentIndex >= 0 ? (currentIndex + 1) / totalSteps : 0;
    const progressLabel =
      totalSteps > 0 && currentIndex >= 0
        ? `Step ${currentIndex + 1} of ${totalSteps}`
        : undefined;
    return {
      stepTitle: step?.title ?? t.missionTitle,
      levelLabel:
        levelIndex === -1
          ? t.missionLevelPrefix
          : `${t.missionLevelPrefix} ${levelIndex + 1} – ${t.missionStepPrefix} ${
              level.steps.findIndex((item) => item.id === activeStep.stepId) + 1
            }`,
      mission,
      missionId,
      status,
      debugMeta: missionData?.debugMeta,
      requestedStepId: activeStep.stepId,
      mode: isManualMode ? 'manual' : 'auto',
      manualMismatch: manualMismatch ?? undefined,
      progressLabel,
      progressRatio,
    };
  }, [
    activeMissionId,
    activeStep,
    stepOrder,
    missionStatus,
    missionsById,
    missionData?.debugMeta,
    manualMismatch,
    path.blueprint.levels,
    isManualMode,
    t.missionLevelPrefix,
    t.missionStepPrefix,
    t.missionTitle,
  ]);

  const shouldShowPlaceholder = Boolean(ritual && !missionData && !missionError);

  return (
    <section className="mission-shell">
      <div className="mission-header">
        <div>
          <h1 className="page-title">{t.missionTitle}</h1>
          <p className="mission-subtitle">{t.missionSubtitle}</p>
        </div>
        <div className="mission-header-actions">
          <button
            className="icon-button"
            onClick={() => setShowNotifications(true)}
            aria-label={t.missionNotifications}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 22a2.4 2.4 0 0 0 2.4-2.4h-4.8A2.4 2.4 0 0 0 12 22Zm6.7-6.6V10a6.7 6.7 0 1 0-13.4 0v5.4l-1.6 1.6a1 1 0 0 0 .7 1.7h15.2a1 1 0 0 0 .7-1.7l-1.6-1.6Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="mission-stats">
        {showReady && (
          <div className="ritual-ready">
            {t.missionReady}
          </div>
        )}
        {loadingMissions && (
          <div className="ritual-ready">{t.missionGenerating}</div>
        )}
        {missionError && <div className="ritual-ready">{t.missionGenerateError}</div>}
        <div>
          <span className="stat-label">{t.missionLevelCurrent}</span>
          <span className="stat-value">{getCurrentLevelLabel()}</span>
        </div>
        <div>
          <span className="stat-label">{t.missionStepCurrent}</span>
          <span className="stat-value">{getCurrentStepLabel()}</span>
        </div>
        <div>
          <span className="stat-label">{t.missionStreak}</span>
          <span className="stat-value">0 {t.missionDay}</span>
        </div>
      </div>

      {shouldShowPlaceholder ? (
        <div className="mission-placeholder">
          {t.missionPlaceholder}
        </div>
      ) : (
        <div className="mission-levels">
          {path.blueprint.levels.map((level, levelIndex) => {
            const progressLevel = path.progress.levels[levelIndex];
            return (
              <div key={level.id} className="level-card">
                <div className="level-header">
                  <div>
                  <span className="level-kicker">
                    {t.missionLevelPrefix} {levelIndex + 1}
                  </span>
                    <h2>{level.title}</h2>
                  </div>
                </div>
                <div className="level-steps">
                  <div className="level-spine" aria-hidden="true" />
                  {level.steps.map((step, stepIndex) => {
                    const progressStep = progressLevel.steps[stepIndex];
                    const isNextAvailable =
                      progressStep.state === 'available' &&
                      nextAvailableStep?.levelId === level.id &&
                      nextAvailableStep?.stepId === step.id;
                    const isClickable = true;
                    return (
                      <button
                        key={step.id}
                        className={`step-node step-${progressStep.state}`}
                        type="button"
                        disabled={!isClickable}
                        onClick={() => (isClickable ? openStep(level.id, step.id) : undefined)}
                      >
                        <span className="step-indicator">
                          {progressStep.state === 'completed' && '✓'}
                        </span>
                        <div className="step-text">
                          <span className="step-title">{step.title}</span>
                          {attemptsByStep[step.id]?.length ? (
                            <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                              {(() => {
                                const attempts = attemptsByStep[step.id] ?? [];
                                const outcomes = attempts
                                  .map((attemptId) => lastProgressByMissionId[attemptId]?.outcome)
                                  .filter(Boolean) as string[];
                                const hasSuccess = outcomes.includes('success');
                                const hasFailure = outcomes.some(
                                  (outcome) => outcome === 'fail' || outcome === 'partial',
                                );
                                const stepStatus = hasSuccess
                                  ? 'Validé'
                                  : hasFailure
                                    ? 'À retravailler'
                                    : 'En cours';
                                const failCount = outcomes.filter(
                                  (outcome) => outcome === 'fail' || outcome === 'partial',
                                ).length;
                                return (
                                  <>
                                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                                      Statut étape : {stepStatus}
                                    </div>
                                    {attempts.map((attemptId, index) => {
                                      const attemptMission = missionsById.get(attemptId);
                                      const outcome = lastProgressByMissionId[attemptId]?.outcome;
                                      const statusLabel =
                                        outcome === 'success'
                                          ? 'Terminé'
                                          : outcome === 'fail' || outcome === 'partial'
                                            ? 'Échoué'
                                            : outcome === 'skipped'
                                              ? 'Passé'
                                              : 'Disponible';
                                      return (
                                        <div key={attemptId} style={{ fontSize: 12, opacity: 0.8 }}>
                                          Tentative {index + 1}:{' '}
                                          {attemptMission?.title ?? attemptId} · {statusLabel}
                                        </div>
                                      );
                                    })}
                                    {failCount >= 3 && (
                                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                                        Suggestion : Ajuster (plus de temps / autre format)
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          ) : null}
                        <span
                          role="button"
                          tabIndex={0}
                          className="text-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openStep(level.id, step.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              openStep(level.id, step.id);
                            }
                          }}
                          style={{ marginTop: 6, display: 'inline-block' }}
                        >
                          Retravailler
                        </span>
                        <span className="step-meta">
                          {progressStep.state === 'locked' && t.stateLocked}
                          {progressStep.state === 'available' && t.stateAvailable}
                          {progressStep.state === 'in_progress' && t.stateInProgress}
                          {progressStep.state === 'completed' && t.stateCompleted}
                            {progressStep.state === 'failed' && t.stateFailed}
                        </span>
                        </div>
                        {progressStep.state === 'failed' && <span className="step-warning" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MissionPlayer
        open={playerOpen}
        missionView={missionView}
        remediationHint={remediationHint}
        outcomeError={outcomeError}
        onClose={() => {
          setPlayerOpen(false);
          setActiveStep(null);
          setRemediationHint(null);
        }}
        onComplete={handleComplete}
        onFail={handleFail}
        onOutcome={handleOutcome}
        onRetry={() => {
          void ensureMissionReady(missionView?.missionId ?? null, {
            mode: 'manual',
            requestedStepId: missionView?.requestedStepId ?? null,
          });
        }}
      />

      <NotificationsModal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </section>
  );
}
