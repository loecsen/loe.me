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
} from '../../../lib/storage/fsStore';
import { buildMissionFull, generateMissionBlocks } from '../../../lib/missions/generateMissionBlocks';
import { loadOverrides, resolvePlaybooks, validatePlaybooks } from '../../../lib/domains/resolver';
import { buildPlanPrompt, PLAN_PROMPT_VERSION } from '../../../lib/prompts/planPrompt';
import { sha256 } from '../../../lib/storage/fsStore';
import { enrichIntention, inferDomainContext } from '../../../lib/domains/infer';
import { runActionabilityV2 } from '../../../lib/actionability';
import { runSafetyGate } from '../../../lib/safety/safetyGate';
import { getLexiconGuard } from '../../../lib/safety/getLexiconGuard';
import { runRealismGate } from '../../../lib/realism/realismGate';

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

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
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
  try {
    const { intention, days, locale, clarification, ritualId: requestedRitualId, normalized_intent } =
      (await request.json()) as {
      intention?: string;
      days?: number;
      locale?: string;
      ritualId?: string;
      normalized_intent?: string;
      clarification?: {
        originalIntention: string;
        chosenLabel: string;
        chosenDomainId: string;
        chosenIntention?: string;
        createdAt: string;
      };
    };

    const safeDays = typeof days === 'number' && Number.isFinite(days) ? Math.max(days, 7) : 21;
    const levelsCount = safeDays <= 14 ? 2 : safeDays <= 30 ? 3 : 4;
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

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const rawIntention =
      (typeof normalized_intent === 'string' ? normalized_intent.trim() : null) ||
      (typeof intention === 'string' ? intention.trim() : '');
    console.log('[missions.generate] incoming', {
      intention: rawIntention,
      days: safeDays,
      locale: resolvedLocale,
    });
    if (rawIntention.length > 350) {
      return NextResponse.json({
        needsClarification: true,
        clarification: { mode: 'inline', reason_code: 'too_long' },
        debug: {},
      });
    }

    const debugEnabled = process.env.DEBUG === '1' || process.env.NODE_ENV !== 'production';
    const trace: TraceEvent[] | undefined = debugEnabled ? [] : undefined;

    const actionabilityResult = runActionabilityV2(rawIntention, safeDays);
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
    }
    if (actionabilityResult.action !== 'actionable') {
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

    const safeIntention = safeText(gate.cleanIntention ?? rawIntention, 'Apprendre avec constance');

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

    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[missions.generate] missing_api_key');
        return NextResponse.json(
          { error: 'missing_api_key', details: 'OPENAI_API_KEY is not set.' },
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
      apiKey,
      model,
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
        llm: { apiKey, model },
        hints: intentionHints,
      });
    })();
    if (process.env.NODE_ENV !== 'production') {
      console.log('[missions.generate] intention_hints', intentionHints);
    }

  const fetchAttempt = async (attempt: number, stepsPerLevel: number) => {
    const systemHint =
      attempt === 1
        ? `Your last output was rejected because it did not match the schema. RETURN JSON ONLY. Fix JSON shape and required fields. Respond in ${languageName}.`
        : `You are a guide who designs realistic learning missions. Respond in ${languageName}.`;
    const resolvedDomainContext = await domainContext;
    const { system, user } = buildPlanPrompt({
      userGoal: clarifiedIntention,
      originalGoal: clarification?.originalIntention,
      days: safeDays,
      userLang: languageName,
      playbooks,
      domainLock: resolvedDomainContext,
      goalHint: intentionHints.goalHint,
      contextHint: intentionHints.contextHint,
      validationPreference: intentionHints.validationPreference,
    });
    const systemPrompt = system.replace(
      '4 to 5 steps per level.',
      `${stepsPerLevel} to ${stepsPerLevel} steps per level.`,
    );
    const userPrompt = user;
    const promptHash = sha256(`${systemPrompt}\n\n${userPrompt}`);
    const startedAt = Date.now();
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
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
      }),
    });
    if (!response.ok) {
      return null;
    }
    const latencyMs = Date.now() - startedAt;
    const payload = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? '{}';
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
      return {
        value: validated.value,
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
  const attempts = [
    { attempt: 0, stepsPerLevel: 4 },
    { attempt: 1, stepsPerLevel: 4 },
  ];

  for (const { attempt, stepsPerLevel } of attempts) {
    const result = await fetchAttempt(attempt, stepsPerLevel);
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

  const ritualId =
    typeof requestedRitualId === 'string' && requestedRitualId.trim().length > 0
      ? requestedRitualId.trim()
      : randomUUID();
  const createdAt = new Date().toISOString();
  const ritualRecord = {
    schemaVersion: 1,
    ritualId,
    intention: safeIntention,
    days: safeDays,
    locale: resolvedLocale,
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
  const ritualPath = getDataPath('rituals', `ritual_${ritualId}.json`);
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
  return NextResponse.json({
    data: {
      ritualId,
      ritualPath: process.env.NODE_ENV !== 'production' ? ritualPath : undefined,
      path,
      missionStubs: missionStubsWithSteps,
      missions: [firstMissionFull],
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
    if (process.env.NODE_ENV !== 'production') {
      console.error('[missions.generate] server_error', details);
      return NextResponse.json({ error: 'server_error', details }, { status: 500 });
    }
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
