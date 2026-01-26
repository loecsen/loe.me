'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildInitialProgress, recomputeStates } from '@loe/core';
import type { LearningPath, LearningPathBlueprintV2, MissionFull, MissionStub } from '@loe/core';
import MissionDashboard from './MissionDashboard';
import PlanImage from '../components/PlanImage';
import { useI18n } from '../components/I18nProvider';
import { buildClarificationSuggestions } from '../lib/domains/clarify';
import { SAFETY_REASON_COPY, SAFETY_CHOICE_LABELS } from '../lib/safety/safetyCopy';
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
  reason_code?: string;
  choices?: Array<{
    id?: string;
    label_key?: string;
    labelKey?: string;
    label?: string;
    intention: string;
  }>;
  suggestions?: Array<{
    id: string;
    title: string;
    subtitle: string;
    intention: string;
    domainHint: string;
  }>;
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
  const [clarifySuggestions, setClarifySuggestions] = useState<
    ReturnType<typeof buildClarificationSuggestions> | null
  >(null);
  const [customClarification, setCustomClarification] = useState('');
  const [clarifyReason, setClarifyReason] = useState<string | null>(null);
  const [creatingErrorReason, setCreatingErrorReason] = useState<string | null>(null);
  const [creatingStatus, setCreatingStatus] = useState<'idle' | 'clarify' | 'generating' | 'error'>(
    'idle',
  );
  const inflightRef = useRef(false);

  const getCopy = (key: string) => (t as unknown as Record<string, string>)[key] ?? key;

  const getClarifyCopy = (reason: string | null) => {
    const entry =
      (reason && (SAFETY_REASON_COPY as Record<string, { titleKey: string; bodyKey: string }>)[
        reason
      ]) ||
      SAFETY_REASON_COPY.default;
    return {
      title: getCopy(entry.titleKey),
      body: getCopy(entry.bodyKey),
    };
  };

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
    if (!isCreating || typeof window === 'undefined') {
      return;
    }
    if (pendingRequest || clarifySuggestions) {
      return;
    }
    try {
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
  }, [clarifySuggestions, isCreating, pendingRequest, ritualIdParam, router]);

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
        const payload = (await response.json()) as { data?: MissionsResponse; ritualId?: string };
        if (!response.ok) {
          if (payload && typeof payload === 'object' && 'error' in payload) {
            const errorPayload = payload as { error?: string; reason_code?: string };
            if (errorPayload.error === 'blocked') {
              setCreatingErrorReason(errorPayload.reason_code ?? 'other_blocked');
            }
          }
          setCreatingStatus('error');
          return;
        }
        const clarifyPayload = payload.data?.needsClarification
          ? payload.data
          : (payload as { needsClarification?: boolean })?.needsClarification
            ? payload
            : null;
        if (clarifyPayload?.needsClarification) {
          const choices = (clarifyPayload as {
            choices?: Array<{
              id?: string;
              label_key?: string;
              labelKey?: string;
              label?: string;
              intention: string;
            }>;
          }).choices;
          if (choices && choices.length > 0) {
            setClarifySuggestions(
              choices.map((choice, index) => {
                const labelKey =
                  choice.label_key ||
                  choice.labelKey ||
                  (choice.id &&
                    (SAFETY_CHOICE_LABELS as Record<string, string | undefined>)[choice.id]) ||
                  '';
                const label =
                  (labelKey && getCopy(labelKey)) ||
                  choice.label ||
                  choice.intention ||
                  '';
                return {
                  id: choice.id ?? `choice-${index + 1}`,
                  title: label,
                  subtitle: '',
                  intention: choice.intention || label,
                  domainHint: 'personal_productivity',
                };
              }),
            );
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[safety] choices missing, falling back to suggestions');
            }
            setClarifySuggestions(
              (clarifyPayload as { suggestions?: ReturnType<typeof buildClarificationSuggestions> })
                .suggestions && (clarifyPayload as { suggestions?: ReturnType<typeof buildClarificationSuggestions> })
                .suggestions!.length > 0
                ? ((clarifyPayload as { suggestions?: ReturnType<typeof buildClarificationSuggestions> })
                    .suggestions as ReturnType<typeof buildClarificationSuggestions>)
                : buildClarificationSuggestions(pendingRequest.intention),
            );
          }
          setClarifyReason(
            (clarifyPayload as { reason_code?: string }).reason_code ?? 'vague',
          );
          setCreatingStatus('clarify');
          inflightRef.current = false;
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

  const handleClarificationSelect = (
    nextIntention: string,
    chosenLabel: string,
    chosenDomainId: string,
  ) => {
    if (!pendingRequest || typeof window === 'undefined') return;
    const nextPayload: PendingRequest = {
      ...pendingRequest,
      clarification: {
        originalIntention: pendingRequest.intention,
        chosenLabel,
        chosenDomainId,
        chosenIntention: nextIntention,
        createdAt: new Date().toISOString(),
      },
    };
    window.sessionStorage.setItem(PENDING_REQUEST_KEY, JSON.stringify(nextPayload));
    setPendingRequest(nextPayload);
    setClarifySuggestions(null);
    setClarifyReason(null);
    setCreatingStatus('generating');
  };

  const handleClarificationCustom = () => {
    if (!pendingRequest) return;
    const trimmed = customClarification.trim();
    if (!trimmed) return;
    const next = `${pendingRequest.intention} → ${trimmed}`;
    handleClarificationSelect(next, 'Autre (je précise en 1 phrase)', 'personal_productivity');
  };

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
        {creatingStatus === 'clarify' && clarifySuggestions ? (
          <div className="clarify-panel">
            <h2>{getClarifyCopy(clarifyReason).title}</h2>
            <p>{getClarifyCopy(clarifyReason).body}</p>
            <div className="clarify-grid">
              {clarifySuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="clarify-card"
                  onClick={() =>
                    handleClarificationSelect(
                      suggestion.intention,
                      suggestion.title,
                      suggestion.domainHint,
                    )
                  }
                >
                  <strong>{suggestion.title}</strong>
                  <span>{suggestion.subtitle}</span>
                </button>
              ))}
            </div>
            <div className="clarify-other">
              <label className="input-label" htmlFor="clarify-other-input">
                {t.clarifyOtherLabel}
              </label>
              <input
                id="clarify-other-input"
                type="text"
                value={customClarification}
                onChange={(event) => setCustomClarification(event.target.value)}
                placeholder={t.clarifyOtherPlaceholder}
              />
              <button
                className="secondary-button"
                type="button"
                disabled={!customClarification.trim()}
                onClick={handleClarificationCustom}
              >
                {t.clarifyOtherCta}
              </button>
            </div>
          </div>
        ) : creatingStatus === 'error' && creatingErrorReason ? (
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
              ritualId={active.ritual.ritualId}
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
