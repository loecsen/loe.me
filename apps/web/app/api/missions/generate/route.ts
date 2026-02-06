import { NextResponse } from 'next/server';
import nodePath from 'node:path';
import { randomUUID } from 'node:crypto';
import { getLocaleFromAcceptLanguage, normalizeLocale } from '../../../lib/i18n';
import type { LearningPath, MissionFull, MissionStub, TraceEvent } from '@loe/core';
import {
  LearningPathSchema,
  MissionStubSchema,
  runSafetyV2,
  pushTrace,
  validateLearningPath,
  validateMissionStub,
} from '@loe/core';
import {
  appendNdjson,
  writeJsonAtomic,
  getDataPath,
  getDataRoot,
  fileExists,
  readJson,
} from '../../../lib/storage/fsStore';
import { buildMissionFull, generateMissionBlocks } from '../../../lib/missions/generateMissionBlocks';
import { loadOverrides, resolvePlaybooks, validatePlaybooks } from '../../../lib/domains/resolver';
import { buildPlanPrompt, PLAN_PROMPT_VERSION } from '../../../lib/prompts/planPrompt';
import { sha256 } from '../../../lib/storage/fsStore';
import { enrichIntention, inferDomainContext } from '../../../lib/domains/infer';
import { runActionabilityV2 } from '../../../lib/actionability';
import { assessAudienceSafety } from '../../../lib/actionability/audienceSafety';
import type { AudienceSafetyLevel } from '../../../lib/actionability/audienceSafety';
import { runSafetyGate } from '../../../lib/safety/safetyGate';
import { getDecisionStore } from '../../../lib/db/provider';
import { buildDecisionUniqueKey } from '../../../lib/db/key';
import { isRecordFresh } from '../../../lib/db/freshness';
import { getLexiconGuard } from '../../../lib/safety/getLexiconGuard';
import { getLexiconForIntent } from '../../../lib/lexicon/registry';
import { runRealismGate } from '../../../lib/realism/realismGate';
import { categoryRequiresFeasibility } from '../../../lib/category';
import { getSiteLlmClientForTier } from '../../../lib/llm/router';
import { normalizeRitualPlan } from '../../../lib/rituals/normalizeRitualPlan';
import {
  acquireRitualLock,
  releaseRitualLock,
  writeRitualStatus,
  getRitualPath,
} from '../../../lib/rituals/statusStore';

export const runtime = 'nodejs';

type RawPayload = {
  path?: LearningPath & {
    domainId?: string;
    domainProfile?: string;
    domainPlaybookVersion?: string;
  };
  missionStubs?: Array<
    MissionStub & {
      stepId?: string;
      effortType?: string;
      estimatedMinutes?: number;
      dayIndex?: number;
      order?: number;
      levelIndex?: number;
      stepIndex?: number;
      resources?: Array<{ provider?: string; title?: string; url?: string; reason?: string }>;
      uniqueAngle?: string;
      actionVerb?: string;
    }
  >;
};

type GoalClarification = {
  context: 'restaurant_classic' | 'bar_cafe' | 'takeaway';
  comfort: 'essential' | 'comfortable' | 'fluent';
  deadline_days: 7 | 14 | 30;
  notes?: string;
};

const PLAN_WATERMARK = '[[WM_PLAN_V1]]';
const FIRST_MISSION_WATERMARK = '[[WM_M1_V1]]';

const safeText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const isSummaryValid = (value: string) => {
  const lower = value.toLowerCase();
  if (!value || value.includes('"') || value.includes('“') || value.includes('”')) {
    return false;
  }
  if (lower.includes('rituel doux') || lower.includes('gentle ritual')) {
    return false;
  }
  if (lower.includes('to move forward') || lower.includes('avancer vers')) {
    return false;
  }
  return true;
};

const sentenceCount = (value: string) =>
  value
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean).length;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/["“”]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeGoalClarification = (input: unknown): GoalClarification | null => {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  const context =
    obj.context === 'restaurant_classic' || obj.context === 'bar_cafe' || obj.context === 'takeaway'
      ? obj.context
      : null;
  const comfort =
    obj.comfort === 'essential' || obj.comfort === 'comfortable' || obj.comfort === 'fluent'
      ? obj.comfort
      : null;
  const deadline_days = obj.deadline_days === 7 || obj.deadline_days === 14 || obj.deadline_days === 30 ? obj.deadline_days : null;
  if (!context || !comfort || !deadline_days) return null;
  const notesRaw = typeof obj.notes === 'string' ? obj.notes : '';
  const notes = notesRaw.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return {
    context,
    comfort,
    deadline_days,
    ...(notes ? { notes } : {}),
  };
};

const DUPLICATION_ERRORS = new Set([
  'duplicate_summary',
  'duplicate_stub_summary',
  'duplicate_stub_sentence',
]);

const axisFromEffort = (value: string) => {
  const lower = value.toLowerCase();
  if (['read', 'listen', 'vocabulary', 'grammar'].some((key) => lower.includes(key))) {
    return 'understand';
  }
  if (['speak', 'practice', 'drill', 'quiz', 'write'].some((key) => lower.includes(key))) {
    return 'do';
  }
  if (['reflect', 'journal', 'mindfulness', 'breath'].some((key) => lower.includes(key))) {
    return 'perceive';
  }
  if (['review', 'revise', 'spaced', 'recap'].some((key) => lower.includes(key))) {
    return 'consolidate';
  }
  return 'understand';
};

const normalizeParsedPayload = (payload: RawPayload) => {
  const axisMappings: Array<{ from: string; to: string }> = [];
  if (payload.path && 'pathId' in payload.path && !payload.path.id) {
    payload.path.id = (payload.path as { pathId?: string }).pathId ?? payload.path.id;
  }
  if (payload.path?.levels) {
    payload.path.levels = payload.path.levels.map((level, levelIndex) => ({
      ...level,
      steps: level.steps.map((step, stepIndex) => ({
        ...step,
        axis: (() => {
          const axisValue = String(step.axis ?? '');
          if (['understand', 'do', 'perceive', 'consolidate'].includes(axisValue)) {
            return step.axis;
          }
          const mapped = axisFromEffort(String(step.axis ?? step.effortType ?? ''));
          if (axisValue) {
            axisMappings.push({ from: axisValue, to: mapped });
          }
          return mapped;
        })(),
        durationMin: typeof step.durationMin === 'number' ? step.durationMin : 10,
        levelIndex: typeof (step as { levelIndex?: number }).levelIndex === 'number'
          ? (step as { levelIndex?: number }).levelIndex
          : levelIndex + 1,
        stepIndex: typeof (step as { stepIndex?: number }).stepIndex === 'number'
          ? (step as { stepIndex?: number }).stepIndex
          : stepIndex + 1,
      })),
    }));
  }
  if (payload.missionStubs) {
    payload.missionStubs = payload.missionStubs.map((stub, index) => ({
      ...stub,
      axis:
        ['understand', 'do', 'perceive', 'consolidate'].includes(String(stub.axis))
          ? stub.axis
          : axisFromEffort(String(stub.axis ?? stub.effortType ?? '')),
      durationMin:
        typeof stub.durationMin === 'number'
          ? stub.durationMin
          : typeof stub.estimatedMinutes === 'number'
            ? stub.estimatedMinutes
            : 10,
      estimatedMinutes:
        typeof stub.estimatedMinutes === 'number' ? stub.estimatedMinutes : 10,
      dayIndex: typeof stub.dayIndex === 'number' ? stub.dayIndex : index + 1,
      order: typeof stub.order === 'number' ? stub.order : index + 1,
      levelIndex: typeof stub.levelIndex === 'number' ? stub.levelIndex : 1,
      stepIndex: typeof stub.stepIndex === 'number' ? stub.stepIndex : index + 1,
    }));
  }
  return { payload, axisMappings };
};

const normalizeMissionStubsToTotal = (
  missionStubs: RawPayload['missionStubs'],
  totalSteps: number,
  stepsPerLevel: number,
  locale: string,
  competencyFallback: string,
) => {
  const stubs = Array.isArray(missionStubs) ? [...missionStubs] : [];
  if (stubs.length === 0) {
    return { stubs, autofillCount: 0, truncatedCount: 0 };
  }
  const safeTotalSteps = Math.max(1, Math.floor(totalSteps));
  if (stubs.length > safeTotalSteps) {
    return { stubs: stubs.slice(0, safeTotalSteps), autofillCount: 0, truncatedCount: stubs.length - safeTotalSteps };
  }
  const autofillCount = safeTotalSteps - stubs.length;
  const isFr = locale.startsWith('fr');
  const actionVerb = isFr ? 'Pratiquer' : 'Practice';
  const titlePrefix = isFr ? 'Jour' : 'Day';
  for (let i = stubs.length; i < safeTotalSteps; i += 1) {
    const levelIndex = Math.floor(i / stepsPerLevel) + 1;
    const stepIndex = (i % stepsPerLevel) + 1;
    stubs.push({
      id: `autofill-${i + 1}`,
      title: `${titlePrefix} ${i + 1}`,
      summary: `Auto-filled mission for day ${i + 1}.`,
      uniqueAngle: 'Auto-filled mission',
      actionVerb,
      competencyId: competencyFallback,
      axis: 'understand',
      effortType: 'practice',
      durationMin: 5,
      dayIndex: i + 1,
      order: i + 1,
      levelIndex,
      stepIndex,
      is_autofill: true,
    });
  }
  return { stubs, autofillCount, truncatedCount: 0 };
};

const buildIssueReport = (
  issues: Array<{ path?: Array<string | number>; expected?: string; received?: string; message?: string }>,
  payload: RawPayload,
  prefix?: Array<string | number>,
  fallbackExcerpt?: unknown,
) =>
  issues.map((issue) => {
    const fullPath = prefix ? [...prefix, ...(issue.path ?? [])] : issue.path ?? [];
    const path = issue.path ?? [];
    const excerpt = (() => {
      if (prefix?.[0] === 'missionStubs' && typeof prefix?.[1] === 'number') {
        return payload.missionStubs?.[Number(prefix[1])] ?? fallbackExcerpt ?? null;
      }
      if (path[0] === 'levels' && typeof path[1] === 'number') {
        const level = payload.path?.levels?.[path[1]];
        if (path[2] === 'steps' && typeof path[3] === 'number') {
          return level?.steps?.[path[3]] ?? null;
        }
        return level ?? null;
      }
      return fallbackExcerpt ?? payload.path ?? null;
    })();
    return {
      path: fullPath,
      expected: issue.expected,
      received: issue.received,
      message: issue.message,
      excerpt,
    };
  });

const validatePayload = (payload: RawPayload) => {
  const pathPayload = payload.path;
  if (!pathPayload) {
    return { ok: false, errors: ['missing_path'] };
  }
  if (!pathPayload.pathSummary || !isSummaryValid(pathPayload.pathSummary)) {
    return { ok: false, errors: ['invalid_path_summary'] };
  }
  if (!pathPayload.pathSummary.includes(PLAN_WATERMARK)) {
    return { ok: false, errors: ['missing_summary_watermark'] };
  }
  const descriptionCount = pathPayload.pathDescription
    ? sentenceCount(pathPayload.pathDescription)
    : 0;
  if (descriptionCount < 2 || descriptionCount > 4) {
    return { ok: false, errors: ['invalid_path_description'] };
  }
  const feasibilityCount = pathPayload.feasibilityNote
    ? sentenceCount(pathPayload.feasibilityNote)
    : 0;
  if (feasibilityCount !== 2) {
    return { ok: false, errors: ['invalid_feasibility_note'] };
  }
  const missionStubs = payload.missionStubs ?? [];
  if (missionStubs.length === 0) {
    return { ok: false, errors: ['missing_mission_stubs'] };
  }
  const normalizedPathSummary = normalizeText(pathPayload.pathSummary ?? '');
  const summarySet = new Set<string>();
  const sentenceSet = new Set<string>();
  const warnings: string[] = [];
  for (const [index, stub] of missionStubs.entries()) {
    if (!stub.summary || normalizeText(stub.summary) === normalizedPathSummary) {
      warnings.push('duplicate_summary');
    }
    if (!stub.actionVerb || !stub.actionVerb.trim()) {
      return { ok: false, errors: ['missing_action_verb'] };
    }
    const normalized = normalizeText(stub.summary ?? '');
    if (summarySet.has(normalized)) {
      warnings.push('duplicate_stub_summary');
    }
    summarySet.add(normalized);
    const angleNormalized = normalizeText(stub.uniqueAngle ?? '');
    if (!angleNormalized) {
      return { ok: false, errors: ['missing_unique_angle'] };
    }
    if (sentenceSet.has(angleNormalized) || sentenceSet.has(normalized)) {
      warnings.push('duplicate_stub_sentence');
    }
    sentenceSet.add(angleNormalized);
    sentenceSet.add(normalized);
  }
  const pathSchemaResult = LearningPathSchema.safeParse(pathPayload);
  if (!pathSchemaResult.success) {
    return {
      ok: false,
      errors: pathSchemaResult.error.issues.map((issue) => issue.message),
      zodIssues: buildIssueReport(
        pathSchemaResult.error.issues.map((issue) => ({
          path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
          expected: (issue as { expected?: string }).expected,
          received: (issue as { received?: string }).received,
          message: issue.message,
        })),
        payload,
      ),
    };
  }
  const pathResult = validateLearningPath(pathPayload);
  if (!pathResult.ok) {
    return { ok: false, errors: pathResult.errors };
  }
  const stubErrors: string[] = [];
  const normalizedStubs: MissionStub[] = [];
  const normalizeResources = (
    resources: Array<{ provider?: string; title?: string; url?: string; reason?: string }> = [],
  ) =>
    resources.map((resource, index) => ({
      id: `res-${index + 1}`,
      type: resource.provider === 'userProvided' ? 'user' : resource.provider ?? 'user',
      title: safeText(resource.title, 'Resource'),
      url: safeText(resource.url, ''),
      whyThis: safeText(resource.reason, 'User provided resource'),
    }));
  for (const [index, stub] of missionStubs.entries()) {
    if (
      stub.resources?.some((resource) => {
        const provider = (resource as { provider?: string }).provider;
        return provider && !['loecsen', 'userProvided'].includes(provider);
      })
    ) {
      return { ok: false, errors: ['invalid_resource_provider'] };
    }
    const schemaResult = MissionStubSchema.safeParse({
      ...stub,
      resources: normalizeResources(stub.resources ?? []),
    });
    if (!schemaResult.success) {
      stubErrors.push(...schemaResult.error.issues.map((issue) => issue.message));
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[missions.generate] stub_validation_failed', {
          index,
          issuePaths: schemaResult.error.issues.map((issue) => issue.path),
        });
      }
      return {
        ok: false,
        errors: stubErrors,
        zodIssues: buildIssueReport(
          schemaResult.error.issues.map((issue) => ({
            path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
            expected: (issue as { expected?: string }).expected,
            received: (issue as { received?: string }).received,
            message: issue.message,
          })),
          payload,
          ['missionStubs', index],
          stub,
        ),
      };
    } else {
      const result = validateMissionStub({
        ...stub,
        resources: normalizeResources(stub.resources ?? []),
      });
      if (!result.ok) {
        stubErrors.push(...result.errors);
      } else {
        normalizedStubs.push(result.value);
      }
    }
  }
  if (stubErrors.length > 0) {
    return { ok: false, errors: stubErrors };
  }
  const filteredWarnings = warnings.filter((entry) => DUPLICATION_ERRORS.has(entry));
  return {
    ok: true,
    value: { path: pathResult.value, missionStubs: normalizedStubs },
    warnings: filteredWarnings.length > 0 ? filteredWarnings : undefined,
  };
};

export async function POST(request: Request) {
  let lockHeld = false;
  let lockedRitualId = '';
  try {
    const { intention, days, locale, clarification, ritualId: requestedRitualId, normalized_intent, category: requestCategory, realism_acknowledged, goal_clarification, skip_gates } =
      (await request.json()) as {
      intention?: string;
      days?: number;
      locale?: string;
      ritualId?: string;
      normalized_intent?: string;
      category?: string;
      realism_acknowledged?: boolean;
      goal_clarification?: GoalClarification;
      skip_gates?: boolean;
      clarification?: {
        originalIntention: string;
        chosenLabel: string;
        chosenDomainId: string;
        chosenIntention?: string;
        createdAt: string;
      };
    };

    const category =
      typeof requestCategory === 'string' && ['LEARN', 'CREATE', 'PERFORM', 'WELLBEING', 'SOCIAL', 'CHALLENGE'].includes(requestCategory)
        ? requestCategory
        : undefined;

    const ritualId =
      typeof requestedRitualId === 'string' && requestedRitualId.trim().length > 0
        ? requestedRitualId.trim()
        : randomUUID();
    lockedRitualId = ritualId;
    const ritualPath = getRitualPath(ritualId);
    if (await fileExists(ritualPath)) {
      const ritual = await readJson<{
        ritualId: string;
        path?: RawPayload['path'];
        missionStubs?: RawPayload['missionStubs'];
        missionsById?: Record<string, MissionFull>;
        category?: string;
        audience_safety_level?: AudienceSafetyLevel;
        debugMeta?: Record<string, unknown>;
      }>(ritualPath);
      return NextResponse.json({
        data: {
          ritualId: ritual.ritualId ?? ritualId,
          path: ritual.path,
          missionStubs: ritual.missionStubs,
          missions: ritual.missionsById ? Object.values(ritual.missionsById) : [],
          category: ritual.category ?? undefined,
          audience_safety_level: ritual.audience_safety_level,
          debugMeta: ritual.debugMeta,
        },
      });
    }


    const safeDays =
      typeof days === 'number' && Number.isFinite(days) ? Math.max(Math.floor(days), 7) : 21;
    const totalSteps = safeDays;
    const stepsPerLevel = 7;
    const headerLocale = getLocaleFromAcceptLanguage(request.headers.get('accept-language'));
    const resolvedLocale = normalizeLocale(locale ?? headerLocale);
    const rawLocale = locale ?? request.headers.get('accept-language') ?? resolvedLocale;
    const languageTag = rawLocale.split(',')[0]?.trim().split('-')[0] || resolvedLocale;
    const languageName = (() => {
      try {
        const display = new Intl.DisplayNames(['en'], { type: 'language' });
        const name = display.of(languageTag);
        return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'English';
      } catch {
        return 'English';
      }
    })();

    const rawIntention =
      (typeof normalized_intent === 'string' ? normalized_intent.trim() : null) ||
      (typeof intention === 'string' ? intention.trim() : '');
    console.log('[missions.generate] incoming', {
      intention: rawIntention,
      days: safeDays,
      locale: resolvedLocale,
    });
    const skipGates =
      skip_gates === true || request.headers.get('x-loe-source') === 'mission';
    if (process.env.NODE_ENV !== 'production') {
      console.log('[missions.generate] skip_gates', { ritualId, skip_gates, skipGates });
    }
    if (rawIntention.length > 350 && !skipGates) {
      return NextResponse.json({
        needsClarification: true,
        clarification: { mode: 'inline', reason_code: 'too_long' },
        debug: {},
      });
    }

    const debugEnabled = process.env.DEBUG === '1' || process.env.NODE_ENV !== 'production';
    const trace: TraceEvent[] | undefined = debugEnabled ? [] : undefined;
    const goalClarification = normalizeGoalClarification(goal_clarification);
    if (debugEnabled && goalClarification) {
      const hasNotes = Boolean(goalClarification.notes);
      console.log('[missions.generate] goal_clarification', {
        context: goalClarification.context,
        comfort: goalClarification.comfort,
        deadline_days: goalClarification.deadline_days,
        has_notes: hasNotes,
      });
      if (trace) {
        pushTrace(trace, {
          gate: 'goal_clarification',
          outcome: 'applied',
          meta: {
            context: goalClarification.context,
            comfort: goalClarification.comfort,
            deadline_days: goalClarification.deadline_days,
            has_notes: hasNotes,
          },
        });
      }
    }

    const { pack: lexiconPack, source: lexiconPackSource, packLang } = await getLexiconForIntent(rawIntention, resolvedLocale, {
      allowDraft: process.env.NODE_ENV !== 'production',
    });
    const lexiconTokens = lexiconPack?.tokens ?? null;

    const actionabilityResult = runActionabilityV2(rawIntention, safeDays, lexiconTokens);
    const resolvedCategory = category ?? actionabilityResult.category;

    if (debugEnabled && trace) {
      pushTrace(trace, {
        gate: 'lexicon_pack',
        outcome: lexiconPackSource,
        meta: { lang: packLang },
      });
    }
    if (debugEnabled && trace) {
      const status =
        actionabilityResult.action === 'actionable'
          ? 'ACTIONABLE'
          : actionabilityResult.action === 'not_actionable_inline'
            ? 'NOT_ACTIONABLE_INLINE'
            : 'BORDERLINE';
      pushTrace(trace, {
        gate: 'actionability_v2',
        outcome: status,
        reason_code: actionabilityResult.reason_code,
        meta: { actionability_v2: actionabilityResult.debug },
      });
      if (resolvedCategory) {
        pushTrace(trace, {
          gate: 'category_gate',
          outcome: 'ok',
          reason_code: undefined,
          meta: { category: resolvedCategory },
        });
      }
    }
    if (!skipGates && actionabilityResult.action !== 'actionable') {
      return NextResponse.json({
        data: {
          needsClarification: true,
          clarification: {
            mode: 'inline',
            reason_code:
              actionabilityResult.action === 'not_actionable_inline'
                ? actionabilityResult.reason_code
                : 'borderline_actionable',
          },
          debug: { actionability_v2: actionabilityResult },
        },
        ...(debugEnabled ? { debugTrace: trace } : {}),
      });
    }

    let safeIntention = safeText(rawIntention, 'Apprendre avec constance');
    if (!skipGates) {
      const { guard: lexiconGuard } = await getLexiconGuard();
      const safetyVerdict = await runSafetyV2({
        text: rawIntention,
        locale: resolvedLocale,
        lexiconGuard,
        trace,
      });
      if (safetyVerdict.status === 'blocked') {
        if (debugEnabled) {
          console.warn('[safety] blocked', {
            reason_code: safetyVerdict.reason_code,
            intentionExcerpt: rawIntention.slice(0, 120),
          });
        }
        return NextResponse.json({
          blocked: true,
          block_reason: safetyVerdict.reason_code,
          clarification: { mode: 'inline', type: 'safety' },
          debug: { safety: { reason_code: safetyVerdict.reason_code } },
          ...(debugEnabled ? { debugTrace: trace } : {}),
        });
      }

      const gate = runSafetyGate(rawIntention, resolvedLocale);
      if (gate.status === 'needs_clarification') {
        pushTrace(trace, {
          gate: 'safety_gate',
          outcome: 'needs_clarification',
          reason_code: gate.reasonCode,
          meta: { source: 'safety_gate' },
        });
        return NextResponse.json({
          data: {
            needsClarification: true,
            clarification: { mode: 'inline', reason_code: gate.reasonCode },
            debug: {},
          },
          ...(debugEnabled ? { debugTrace: trace } : {}),
        });
      }
      safeIntention = safeText(gate.cleanIntention ?? rawIntention, 'Apprendre avec constance');
    }

    // Audience safety: DB lookup first, else classify + upsert. Blocked => no generation.
    let audienceSafetyLevel: AudienceSafetyLevel = 'all_ages';
    if (!skipGates) {
      try {
        const store = getDecisionStore();
        const { unique_key, context_hash } = buildDecisionUniqueKey({
          intent: rawIntention,
          intent_lang: resolvedLocale,
          category: null,
          days: safeDays,
          gate: 'audience_safety',
          context_flags: { requires_feasibility: false },
        });
        const record = await store.getByUniqueKey(unique_key, context_hash);
        if (record && isRecordFresh(record.updated_at, 'audience_safety', record.verdict)) {
          audienceSafetyLevel = (record.gates?.audience_safety as AudienceSafetyLevel) ?? 'all_ages';
        } else {
          const baseUrl = typeof request.url === 'string' ? new URL(request.url).origin : '';
          const result = await assessAudienceSafety(rawIntention, resolvedLocale, resolvedLocale, baseUrl
            ? async (body) => {
                const res = await fetch(`${baseUrl}/api/audience-safety/classify`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });
                return res.json() as Promise<{ level: AudienceSafetyLevel; reason_code?: string; confidence?: number; notes_short?: string }>;
              }
            : undefined);
          audienceSafetyLevel = result.level;
          if (baseUrl && result) {
            try {
              await fetch(`${baseUrl}/api/db/decision/upsert-from-audience-safety`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  intent: rawIntention,
                  intent_lang: resolvedLocale,
                  ui_locale: resolvedLocale,
                  days: safeDays,
                  level: result.level,
                  reason_code: result.reason_code,
                  confidence: result.confidence,
                  notes_short: result.notes_short,
                }),
              });
            } catch {
              /* best-effort */
            }
          }
        }
        if (audienceSafetyLevel === 'blocked') {
          if (debugEnabled) {
            console.warn('[audience_safety] blocked', { intentionExcerpt: rawIntention.slice(0, 80) });
          }
          return NextResponse.json({
            blocked: true,
            block_reason: 'audience_safety',
            clarification: { mode: 'inline', type: 'safety' },
            debug: { audience_safety: 'blocked' },
            ...(debugEnabled ? { debugTrace: trace } : {}),
          });
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
          console.warn('[audience_safety]', err.message);
        }
        audienceSafetyLevel = 'all_ages';
      }
    }

    const runRealismForCategory = resolvedCategory != null ? categoryRequiresFeasibility(resolvedCategory as import('../../../lib/category').Category) : true;
    if (!skipGates && runRealismForCategory && !realism_acknowledged) {
      const realismGate = runRealismGate(
        safeIntention,
        typeof days === 'number' && Number.isFinite(days) ? days : undefined,
        resolvedLocale,
      );
      if (realismGate.status === 'needs_reformulation') {
        pushTrace(trace, {
          gate: 'realism_gate',
          outcome: 'needs_clarification',
          reason_code: 'unrealistic',
          meta: { choices: realismGate.choices.map((choice) => choice.label_key) },
        });
        return NextResponse.json({
          data: {
            needsClarification: true,
            clarification: { mode: 'inline', reason_code: 'unrealistic' },
            debug: {},
          },
          ...(debugEnabled ? { debugTrace: trace } : {}),
        });
      }
      pushTrace(trace, {
        gate: 'realism_gate',
        outcome: 'ok',
      });
    } else if (!skipGates && runRealismForCategory && realism_acknowledged && debugEnabled && trace) {
      pushTrace(trace, {
        gate: 'realism_gate_v2_soft',
        outcome: 'acknowledged',
        reason_code: undefined,
        meta: { category: resolvedCategory },
      });
    }

    let siteClient: Awaited<ReturnType<typeof getSiteLlmClientForTier>>;
    try {
      siteClient = await getSiteLlmClientForTier('reasoning');
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[missions.generate] missing_api_key', err instanceof Error ? err.message : err);
        return NextResponse.json(
          { error: 'missing_api_key', details: 'LLM API key is not set.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: 'missing_api_key' }, { status: 500 });
    }

    const overrides = await loadOverrides();
    const { resolved } = resolvePlaybooks(overrides);
    const validation = validatePlaybooks(resolved);
    const playbooks = validation.ok ? resolved : resolvePlaybooks({ playbooks: [] }).resolved;
    if (!validation.ok && process.env.NODE_ENV !== 'production') {
      console.warn('[domains] invalid overrides, fallback registry', validation.errors);
    }
    const intentionForEnrichment = clarification?.originalIntention ?? safeIntention;
    const clarifiedIntention = clarification?.chosenIntention ?? safeIntention;
    const intentionHints = await enrichIntention(intentionForEnrichment, resolvedLocale, {
      client: siteClient.client,
      model: siteClient.model,
    });
    const domainContext = (() => {
      if (clarification?.chosenDomainId) {
        const chosenPlaybook =
          playbooks.find((entry) => entry.id === clarification.chosenDomainId) ?? playbooks[0];
        return {
          domainId: chosenPlaybook.id,
          domainProfile: chosenPlaybook.profile.label,
          domainPlaybookVersion: String(chosenPlaybook.version),
          source: 'clarification' as const,
        };
      }
      return inferDomainContext(intentionForEnrichment, resolvedLocale, {
        playbooks,
        llm: { client: siteClient.client, model: siteClient.model },
        hints: intentionHints,
      });
    })();
    if (process.env.NODE_ENV !== 'production') {
      console.log('[missions.generate] intention_hints', intentionHints);
    }

  const fetchAttempt = async (attempt: number) => {
    const systemHint =
      attempt === 1
        ? `Your last output was rejected because it did not match the schema. RETURN JSON ONLY. Fix JSON shape and required fields. Respond in ${languageName}.`
        : `You are a guide who designs realistic learning missions. Respond in ${languageName}.`;
    const resolvedDomainContext = await domainContext;
    const clarificationHint = goalClarification
      ? [
          `context=${goalClarification.context}`,
          `comfort=${goalClarification.comfort}`,
          `deadline_days=${goalClarification.deadline_days}`,
          goalClarification.notes ? `notes=${goalClarification.notes}` : null,
        ]
          .filter(Boolean)
          .join(', ')
      : null;
    const combinedContextHint = [intentionHints.contextHint, clarificationHint]
      .filter(Boolean)
      .join(' | ');
    const { system, user } = buildPlanPrompt({
      userGoal: clarifiedIntention,
      originalGoal: clarification?.originalIntention,
      days: safeDays,
      userLang: languageName,
      playbooks,
      domainLock: resolvedDomainContext,
      goalHint: intentionHints.goalHint,
      contextHint: combinedContextHint || undefined,
      validationPreference: intentionHints.validationPreference,
    });
    const systemPrompt = system.replace(
      '4 to 5 steps per level.',
      [
        `- Generate exactly ${totalSteps} steps in total.`,
        `- Group them into levels of ${stepsPerLevel} steps each; the last level may have fewer steps if needed.`,
        '- Each step represents exactly one day.',
      ].join('\n'),
    );
    const userPrompt = user;
    const promptHash = sha256(`${systemPrompt}\n\n${userPrompt}`);
    const startedAt = Date.now();
    const response = await siteClient.client.chat.completions.create({
      model: siteClient.model,
      temperature: 0.6,
      response_format:
        attempt === 0
          ? {
              type: 'json_schema',
              json_schema: {
                name: 'plan_response',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    path: { type: 'object' },
                    missionStubs: { type: 'array' },
                  },
                  required: ['path', 'missionStubs'],
                  additionalProperties: true,
                },
              },
            }
          : { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${systemHint}\n\n${systemPrompt}`,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });
    const latencyMs = Date.now() - startedAt;
    const content = response.choices?.[0]?.message?.content ?? '{}';
    const llmTextExcerpt = content.slice(0, 700);
    const parseJson = () => {
      try {
        return JSON.parse(content) as RawPayload;
      } catch {
        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        if (start !== -1 && end > start) {
          try {
            return JSON.parse(content.slice(start, end + 1)) as RawPayload;
          } catch {
            return null;
          }
        }
        return null;
      }
    };
    try {
      const parsedRaw = parseJson();
      const normalized = parsedRaw ? normalizeParsedPayload(parsedRaw) : null;
      const parsed = normalized?.payload ?? null;
      const axisMappings = normalized?.axisMappings ?? [];
      if (process.env.NODE_ENV !== 'production') {
        axisMappings.forEach((mapping) => {
          console.warn('[plan.normalize] axis_mapped', mapping);
        });
      }
      if (!parsed) {
        return {
          error: 'json_parse_failed',
          llmTextExcerpt,
          meta: { promptHash, promptVersion: PLAN_PROMPT_VERSION, latencyMs },
        };
      }
      const planNormalization = parsed?.path
        ? normalizeRitualPlan(parsed.path, totalSteps, { stepsPerLevel, locale: resolvedLocale })
        : null;
      if (planNormalization) {
        parsed.path = planNormalization.plan as RawPayload['path'];
        if (planNormalization.meta.autofillCount > 0 && process.env.NODE_ENV !== 'production') {
          console.warn(
            `[missions.generate] autofilled ${planNormalization.meta.autofillCount}/${totalSteps}`,
            {
              reason: 'missing_steps',
              truncatedCount: planNormalization.meta.truncatedCount,
            },
          );
        }
      }
      if (parsed?.missionStubs) {
        const competencyFallback =
          planNormalization?.plan?.competencies?.find((entry) => entry?.id)?.id ??
          parsed.missionStubs[0]?.competencyId ??
          'comp-1';
        const normalizedStubs = normalizeMissionStubsToTotal(
          parsed.missionStubs,
          totalSteps,
          stepsPerLevel,
          resolvedLocale,
          competencyFallback,
        );
        if (normalizedStubs.autofillCount > 0 && process.env.NODE_ENV !== 'production') {
          console.warn(
            `[missions.generate] autofilled ${normalizedStubs.autofillCount}/${totalSteps}`,
            {
              reason: 'missing_stubs',
              truncatedCount: normalizedStubs.truncatedCount,
            },
          );
        }
        parsed.missionStubs = normalizedStubs.stubs;
      }

      const validated = validatePayload(parsed);
      if (!validated.ok) {
        return {
          error: 'validation_failed',
          validationErrors: validated.errors,
          zodIssues: validated.zodIssues,
          llmTextExcerpt,
          meta: { promptHash, promptVersion: PLAN_PROMPT_VERSION, latencyMs },
        };
      }
      const normalizedValue = validated.value;
      if (planNormalization?.meta.autofillStepIds?.length) {
        normalizedValue.path = {
          ...normalizedValue.path,
          levels: normalizedValue.path.levels.map((level) => ({
            ...level,
            steps: level.steps.map((step) =>
              planNormalization.meta.autofillStepIds.includes(step.id)
                ? { ...step, is_autofill: true, description: 'Auto-filled step' }
                : step,
            ),
          })),
        };
      }
      normalizedValue.path = {
        ...normalizedValue.path,
        generationSchemaVersion: 2,
        totalSteps,
        stepsPerLevel,
        levelsCount: Math.ceil(totalSteps / stepsPerLevel),
      };
      return {
        value: normalizedValue,
        meta: { promptHash, promptVersion: PLAN_PROMPT_VERSION, latencyMs },
        warnings: validated.warnings,
        axisMappings,
      };
    } catch {
      return {
        error: 'json_parse_failed',
        llmTextExcerpt,
        meta: { promptHash, promptVersion: PLAN_PROMPT_VERSION, latencyMs },
      };
    }
  };

    const lockAcquired = await acquireRitualLock(ritualId);
    if (!lockAcquired) {
      return NextResponse.json({ error: 'generation_in_progress' }, { status: 409 });
    }
    lockHeld = true;
    await writeRitualStatus(ritualId, 'pending');

    const totalStart = Date.now();
  let parsed: { path: LearningPath; missionStubs: MissionStub[] } | null = null;
  let planMeta: { promptHash: string; promptVersion: string; latencyMs: number } | null = null;
  let planWarnings: string[] | undefined;
  let axisMappings: Array<{ from: string; to: string }> = [];
  let zodIssues: unknown;
  const attemptInfo: Array<{
    attempt: number;
    latencyMs?: number;
    error?: string;
    validationErrors?: string[];
    zodIssues?: unknown;
  }> = [];
  let lastExcerpt: string | undefined;
  const attempts = [{ attempt: 0 }, { attempt: 1 }];

  for (const { attempt } of attempts) {
    const result = await fetchAttempt(attempt);
    if (result?.value) {
      parsed = result.value;
      planMeta = result.meta;
      planWarnings = result.warnings;
      axisMappings = result.axisMappings ?? [];
      break;
    }
    if (result?.meta?.latencyMs) {
      attemptInfo.push({
        attempt: attempt + 1,
        latencyMs: result.meta.latencyMs,
        error: result.error,
        validationErrors: result.validationErrors,
        zodIssues: result.zodIssues,
      });
    }
    if (result?.zodIssues) {
      zodIssues = result.zodIssues;
    }
    if (result?.llmTextExcerpt) {
      lastExcerpt = result.llmTextExcerpt;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[missions.generate] retry', { attempt: attempt + 1 });
    }
  }

  if (!parsed) {
    const reason = attemptInfo.at(-1)?.error ?? 'invalid_response';
    const responseBody = {
      error: 'invalid_response',
      reason,
      validationErrors: attemptInfo.at(-1)?.validationErrors,
      zodIssues,
      llmTextExcerpt: lastExcerpt,
      attempts: attemptInfo.length,
      model,
      latencyMs: attemptInfo.at(-1)?.latencyMs,
    };
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[missions.generate] invalid_response', responseBody);
      return NextResponse.json(responseBody, { status: 400 });
    }
    return NextResponse.json({ error: 'invalid_response' }, { status: 400 });
  }

  const pathData = parsed.path;
  const pathDomain = pathData as LearningPath & {
    domainId?: string;
    domainProfile?: string;
    domainPlaybookVersion?: string;
  };
  const resolvedDomainContext = await domainContext;
  const domainId = resolvedDomainContext.domainId;
  const domainProfile = resolvedDomainContext.domainProfile;
  const domainPlaybookVersion = resolvedDomainContext.domainPlaybookVersion;
  const domainAutofilled =
    pathDomain.domainId !== domainId ||
    pathDomain.domainProfile !== domainProfile ||
    pathDomain.domainPlaybookVersion !== domainPlaybookVersion;
  if (domainAutofilled && process.env.NODE_ENV !== 'production') {
    console.warn('[missions.generate] domain_autofilled', {
      from: {
        domainId: pathDomain.domainId,
        domainProfile: pathDomain.domainProfile,
        domainPlaybookVersion: pathDomain.domainPlaybookVersion,
      },
      to: {
        domainId,
        domainProfile,
        domainPlaybookVersion,
      },
      source: resolvedDomainContext.source,
    });
  }
  const pathId = slugify(pathData.pathTitle ?? `rituel-${safeIntention}`) || 'loe-path-ai';
  const normalizedLevels = pathData.levels.map((level, levelIndex) => ({
    ...level,
    id: `level-${levelIndex + 1}`,
    steps: level.steps.map((step, stepIndex) => ({
      ...step,
      id: `step-${levelIndex + 1}-${stepIndex + 1}`,
      missionId: `mission-${levelIndex + 1}-${stepIndex + 1}`,
    })),
  }));
  const missionIds = normalizedLevels.flatMap((level) =>
    level.steps.map((step) => step.missionId ?? ''),
  );
  if (parsed.missionStubs.length !== missionIds.length) {
    return NextResponse.json({ error: 'invalid_mission_stubs' }, { status: 400 });
  }
  const missionStubs: MissionStub[] = parsed.missionStubs.map((stub, index) => ({
    ...stub,
    id: missionIds[index],
  }));
  const competencyIds = new Set(pathData.competencies.map((entry) => entry.id));
  if (missionStubs.some((stub) => !competencyIds.has(stub.competencyId))) {
    return NextResponse.json({ error: 'invalid_competency' }, { status: 400 });
  }
  const flatSteps = normalizedLevels.flatMap((level) => level.steps);
  const rawStubs = parsed.missionStubs as Array<
    MissionStub & {
      stepId?: string;
      effortType?: string;
      estimatedMinutes?: number;
      dayIndex?: number;
      order?: number;
      levelIndex?: number;
      stepIndex?: number;
      resources?: Array<{ provider?: string; title?: string; url?: string; reason?: string }>;
      uniqueAngle?: string;
      actionVerb?: string;
    }
  >;
  const missionStubsWithSteps = missionStubs.map((stub, index) => {
    const {
      durationMin,
      missionType,
      ...rest
    } = stub;
    return {
      ...rest,
      title: safeText(stub.title, 'Mission'),
      summary: safeText(stub.summary, 'Mission'),
      stepId: flatSteps[index]?.id ?? '',
      effortType:
        rawStubs[index]?.effortType ??
        missionType ??
        flatSteps[index]?.effortType ??
        'practice',
      estimatedMinutes: rawStubs[index]?.estimatedMinutes ?? durationMin ?? 10,
      resources: rawStubs[index]?.resources ?? [],
      uniqueAngle: rawStubs[index]?.uniqueAngle ?? '',
      actionVerb: rawStubs[index]?.actionVerb ?? '',
      dayIndex: rawStubs[index]?.dayIndex ?? index + 1,
      order: rawStubs[index]?.order ?? index + 1,
      levelIndex: rawStubs[index]?.levelIndex ?? 1,
      stepIndex: rawStubs[index]?.stepIndex ?? index + 1,
    };
  });
  const path: LearningPath & {
    domainId?: string;
    domainProfile?: string;
    domainPlaybookVersion?: string;
  } = {
    ...pathData,
    id: pathId,
    pathTitle: safeText(pathData.pathTitle, `Rituel ${safeIntention}`),
    pathSummary: safeText(pathData.pathSummary, 'Parcours personnalisé.'),
    domainId: safeText(domainId, 'general'),
    domainProfile: safeText(domainProfile, 'default'),
    domainPlaybookVersion: safeText(domainPlaybookVersion, 'v1'),
    levels: normalizedLevels,
  };

  const playbook = playbooks.find((entry) => entry.id === domainId) ?? playbooks[0];

  const firstStub = {
    ...missionStubsWithSteps[0],
    durationMin: missionStubsWithSteps[0]?.estimatedMinutes ?? 10,
  } as unknown as MissionStub;
  const { blocks, meta: fullMeta } = await generateMissionBlocks({
    request,
    goal: safeIntention,
    pathTitle: path.pathTitle,
    mission: firstStub,
    locale,
    maxTokens: path.budgetHints.maxTokensPerMission,
    context: {
      playbook,
      validationMode: path.validationMode,
      ritualMode: path.ritualMode,
      days: safeDays,
    },
  });
  const firstMissionFull = buildMissionFull(firstStub, blocks);
  const missionsById: Record<string, MissionFull> = {
    [firstMissionFull.id]: firstMissionFull,
  };

  const createdAt = new Date().toISOString();
  const ritualRecord = {
    schemaVersion: 1,
    ritualId,
    intention: safeIntention,
    days: safeDays,
    locale: resolvedLocale,
    audience_safety_level: audienceSafetyLevel,
    createdAt,
    updatedAt: createdAt,
    clarification,
    path,
    missionStubs: missionStubsWithSteps,
    missionsById,
    debugMeta: {
      domainId,
      domainPlaybookVersion,
      validationMode: path.validationMode,
      promptPlan: planMeta,
      promptFull: fullMeta,
      stubsCount: missionStubsWithSteps.length,
      fullCount: 1,
      qualityWarnings: planWarnings,
      zodIssues,
      axisMapped: axisMappings,
    },
  };
  await writeJsonAtomic(ritualPath, ritualRecord);
  const existsAfterWrite = await fileExists(ritualPath);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[missions.generate] data_root', {
      cwd: process.cwd(),
      dataRoot: getDataRoot(),
    });
    console.log('[missions.generate] write', {
      ritualPath,
      existsAfterWrite,
    });
    console.log('[missions.generate]', { ritualId, ritualPath });
  }
  await appendNdjson(getDataPath('index', 'rituals.ndjson'), {
    ritualId,
    intention: safeIntention,
    days: safeDays,
    createdAt,
    updatedAt: createdAt,
    lastViewedAt: createdAt,
    status: 'ready',
    createdBy: null,
    pathTitle: path.pathTitle,
    pathSummary: path.pathSummary,
  });

  const totalMs = Date.now() - totalStart;
  console.log('[PLAN_TIMING]', {
    total_ms: totalMs,
    missions_count: missionStubsWithSteps.length,
  });
  console.log('[PLAN_FIELDS]', {
    pathTitle: path.pathTitle,
    pathSummary: path.pathSummary,
    firstMissionTitle: firstMissionFull?.title,
  });
  if (process.env.NODE_ENV !== 'production') {
    console.log('[missions.generate]', {
      ritualId,
      stubsCount: missionStubsWithSteps.length,
      firstFullId: firstMissionFull.id,
    });
  }
  await writeRitualStatus(ritualId, 'ready');
  return NextResponse.json({
    data: {
      ritualId,
      ritualPath: process.env.NODE_ENV !== 'production' ? ritualPath : undefined,
      path,
      missionStubs: missionStubsWithSteps,
      missions: [firstMissionFull],
      category: resolvedCategory ?? undefined,
      audience_safety_level: audienceSafetyLevel,
      debugMeta: {
        domainId,
        domainPlaybookVersion,
        validationMode: path.validationMode,
        promptPlan: planMeta,
        promptFull: fullMeta,
        stubsCount: missionStubsWithSteps.length,
        fullCount: 1,
        qualityWarnings: planWarnings,
        zodIssues,
        axisMapped: axisMappings,
      },
    },
    ...(debugEnabled ? { debugTrace: trace } : {}),
  });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    if (lockedRitualId) {
      try {
        await writeRitualStatus(lockedRitualId, 'pending', details);
      } catch {
        // ignore
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error('[missions.generate] server_error', details);
      return NextResponse.json({ error: 'server_error', details }, { status: 500 });
    }
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  } finally {
    if (lockHeld && lockedRitualId) {
      await releaseRitualLock(lockedRitualId);
    }
  }
}
