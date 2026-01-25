import { NextResponse } from 'next/server';
import type { LearningPath, MissionFull, MissionStub, ProgressEvent as CoreProgressEvent } from '@loe/core';
import { computeNextStep } from '@loe/core';
import {
  readJson,
  writeJsonAtomic,
  getDataPath,
  getDataRoot,
  fileExists,
} from '../../../lib/storage/fsStore';
import { loadOverrides, resolvePlaybooks, validatePlaybooks } from '../../../lib/domains/resolver';
import { buildMissionFull, generateMissionBlocks } from '../../../lib/missions/generateMissionBlocks';
import type { ProgressEvent as ProgressEventRecord, ProgressEventInput } from '../../../lib/missions/progressTypes';
import { recordProgressEvent } from '../../../lib/missions/progressStore';

type Payload = {
  ritualId?: string;
  stepId?: string;
  mode?: 'auto' | 'manual';
  requestedStepId?: string;
  userContext?: { userLang?: string };
  lastEvents?: CoreProgressEvent[];
  progressEventId?: string;
  progressEvent?: Omit<ProgressEventInput, 'ritualId'>;
  ritualSnapshot?: {
    ritualId?: string;
    intention?: string;
    days?: number;
    locale?: string;
    createdAt?: string;
    path?: LearningPath;
    missionStubs?: MissionStub[];
    missionsById?: Record<string, MissionFull>;
  };
};

type RitualFile = {
  schemaVersion?: number;
  ritualId: string;
  intention: string;
  days: number;
  locale?: string;
  createdAt: string;
  updatedAt?: string;
  path: LearningPath;
  missionStubs: MissionStub[];
  missionsById?: Record<string, MissionFull>;
  progress?: ProgressEventRecord[];
  lastProgressByMissionId?: Record<string, ProgressEventRecord>;
};

const findStepById = (pathData: LearningPath, stepId: string) => {
  for (const level of pathData.levels) {
    const step = level.steps.find((entry) => entry.id === stepId);
    if (step) {
      return step;
    }
  }
  return null;
};

const clampMinutes = (value: number | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 10;
  }
  return Math.min(Math.max(value, 5), 10);
};

const ensureValidationBlocks = (
  blocks: Array<{ type: string }>,
  validationMode: string,
): Array<{ type: string }> => {
  const hasQuiz = blocks.some((block) => block.type === 'quiz');
  const hasChecklist = blocks.some((block) => block.type === 'checklist');
  if (validationMode === 'automatic' && !hasQuiz) {
    return [
      ...blocks,
      {
        type: 'quiz',
        question: 'Question rapide',
        choices: ['Oui', 'Non'],
        correctIndex: 0,
      },
    ] as Array<{ type: string }>;
  }
  if (validationMode === 'self_report' && !hasChecklist) {
    return [
      ...blocks,
      {
        type: 'checklist',
        items: ['Action réalisée', 'Auto-évaluation rapide'],
      },
    ] as Array<{ type: string }>;
  }
  if (validationMode === 'presence' && hasQuiz) {
    return blocks.filter((block) => block.type !== 'quiz');
  }
  return blocks;
};

export async function POST(request: Request) {
  const { ritualId, stepId, mode, requestedStepId, userContext, lastEvents, ritualSnapshot, progressEvent } =
    (await request.json()) as Payload;
  if (!ritualId) {
    return NextResponse.json({ error: 'missing_ritual_id' }, { status: 400 });
  }

  let ritualPath = getDataPath('rituals', `ritual_${ritualId}.json`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[missions.next] data_root', {
      cwd: process.cwd(),
      dataRoot: getDataRoot(),
    });
  }
  let ritual: RitualFile;
  try {
    ritual = await readJson<RitualFile>(ritualPath);
  } catch {
    if (ritualSnapshot?.path && ritualSnapshot.missionStubs?.length) {
      const createdAt = ritualSnapshot.createdAt ?? new Date().toISOString();
      ritual = {
        schemaVersion: 1,
        ritualId: ritualSnapshot.ritualId ?? ritualId,
        intention: ritualSnapshot.intention ?? 'unknown',
        days: ritualSnapshot.days ?? 14,
        locale: ritualSnapshot.locale,
        createdAt,
        updatedAt: createdAt,
        path: ritualSnapshot.path,
        missionStubs: ritualSnapshot.missionStubs,
        missionsById: ritualSnapshot.missionsById ?? {},
      };
      ritualPath = getDataPath('rituals', `ritual_${ritual.ritualId}.json`);
      await writeJsonAtomic(ritualPath, ritual);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[missions.next] rehydrated', {
          ritualId: ritual.ritualId,
          stubsCount: ritual.missionStubs.length,
        });
      }
    } else {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { error: 'ritual_not_found', ritualId, ritualPath },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: 'ritual_not_found' }, { status: 404 });
    }
  }

  if (progressEvent) {
    const normalizedOutcome =
      progressEvent.outcome === 'failed' || progressEvent.outcome === 'partly'
        ? 'fail'
        : progressEvent.outcome;
    if (normalizedOutcome !== 'fail') {
      const recorded = await recordProgressEvent({
        ritualId,
        missionId: progressEvent.missionId,
        stepId: progressEvent.stepId,
        outcome: normalizedOutcome as ProgressEventInput['outcome'],
        score: progressEvent.score,
        timeSpentMin: progressEvent.timeSpentMin,
        notes: progressEvent.notes,
        quiz: progressEvent.quiz,
        meta: progressEvent.meta,
      });
      if (recorded.ok) {
        ritual = {
          ...ritual,
          progress: recorded.ritual.progress,
          lastProgressByMissionId: recorded.ritual.lastProgressByMissionId,
          updatedAt: recorded.ritual.updatedAt,
        };
      }
    }
  }

  const baseStepId =
    requestedStepId ||
    stepId ||
    computeNextStep(ritual.path, lastEvents ?? []).nextStepId ||
    null;
  const targetStepId = baseStepId;
  if (!targetStepId) {
    return NextResponse.json({ error: 'no_next_step' }, { status: 400 });
  }

  const step = findStepById(ritual.path, targetStepId);
  if (!step?.missionId) {
    return NextResponse.json({ error: 'missing_mission' }, { status: 400 });
  }

  const missionId = step.missionId;
  const missionsById = ritual.missionsById ?? {};
  const stub = ritual.missionStubs.find((entry) => entry.id === missionId);
  if (!stub) {
    return NextResponse.json({ error: 'missing_stub' }, { status: 400 });
  }
  if (missionsById[missionId]) {
    return NextResponse.json({
      data: {
        mission: missionsById[missionId],
        debugMeta: {
          requestedStepId: targetStepId,
          returnedStepId: missionsById[missionId].stepId,
        },
      },
    });
  }

  const overrides = await loadOverrides();
  const { resolved } = resolvePlaybooks(overrides);
  const validation = validatePlaybooks(resolved);
  const playbooks = validation.ok ? resolved : resolvePlaybooks({ playbooks: [] }).resolved;
  const playbook =
    playbooks.find((entry) => entry.id === ritual.path.domainId) ?? playbooks[0];

  const { blocks, meta } = await generateMissionBlocks({
    request,
    goal: ritual.intention,
    pathTitle: ritual.path.pathTitle,
    mission: stub,
    previousMissionSummary: undefined,
    locale: userContext?.userLang ?? ritual.locale,
    maxTokens: ritual.path.budgetHints.maxTokensPerMission,
    context: {
      playbook,
      validationMode: ritual.path.validationMode,
      ritualMode: ritual.path.ritualMode,
      days: ritual.days,
      domainId: ritual.path.domainId,
      previousProgress: undefined,
      lastEffortTypes: undefined,
      remediationApplied: false,
      attemptIndex: 1,
    },
  });
  const normalizedEffortType = playbook.allowedEffortTypes.includes(
    (stub.effortType ?? '') as (typeof playbook.allowedEffortTypes)[number],
  )
    ? stub.effortType
    : playbook.allowedEffortTypes[0];
  const normalizedStub = {
    ...stub,
    effortType: normalizedEffortType,
    estimatedMinutes: clampMinutes(stub.estimatedMinutes),
  };
  const normalizedBlocks = ensureValidationBlocks(
    blocks as Array<{ type: string }>,
    ritual.path.validationMode,
  );
  const fullMission = buildMissionFull(normalizedStub, normalizedBlocks as MissionFull['blocks']);
  missionsById[normalizedStub.id] = fullMission;
  const updated = {
    ...ritual,
    missionsById,
    updatedAt: new Date().toISOString(),
    debugMeta: {
      ...(ritual as { debugMeta?: Record<string, unknown> }).debugMeta,
      promptFull: meta,
      fullCount: Object.keys(missionsById).length,
      requestedStepId: targetStepId,
      returnedStepId: fullMission.stepId,
    },
  };
  await writeJsonAtomic(ritualPath, updated);
  const existsAfterWrite = await fileExists(ritualPath);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[missions.next] write', { ritualPath, existsAfterWrite });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[missions.next]', {
      ritualId,
      stepId: targetStepId,
      generatedMissionId: normalizedStub.id,
    });
  }
  return NextResponse.json({
    data: {
      mission: fullMission,
      debugMeta: {
        promptFull: meta,
        fullCount: Object.keys(missionsById).length,
        requestedStepId: targetStepId,
        returnedStepId: fullMission.stepId,
      },
    },
  });
}
