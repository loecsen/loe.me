/**
 * Evaluation runner — runs one scenario through the decision pipeline (V2 only, no UI).
 * Order: audience_safety (DB-first via API) → decision engine V2. No missions/generate.
 */

import { runDecisionEngine } from '../decisionEngine/engine';
import { GateCopy } from '../gates/copy';
import { POLICY_VERSION } from '../db/constants';
import { decideUiOutcome } from '../decision/uiOutcome';
import { detectToneDeterministic } from '../actionability/tone';
import { resolveCopyVariant } from '../gates/copyVariant';
import { detectControllability } from '../actionability/controllability';
import type { EvalScenarioV1, EvalRunResultV1, EvalUiOutcome, EvalGateTraceEntry } from './types';

const ENGINE_VERSION = 'v2';

function now(): string {
  return new Date().toISOString();
}

/** Deterministic eval_run_id for idempotent upserts. */
export function evalRunId(scenarioId: string, policyVersion: string, engineVersion: string): string {
  const payload = [scenarioId, policyVersion, engineVersion].join('\n');
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    h = (h << 5) - h + payload.charCodeAt(i);
    h |= 0;
  }
  return `eval:${scenarioId}:${policyVersion}:${engineVersion}:${Math.abs(h).toString(36)}`;
}

export type RunEvalScenarioOptions = {
  scenario: EvalScenarioV1;
  /** Origin for fetch (e.g. request.url origin). Required for audience_safety assess. */
  baseUrl: string;
};

/**
 * Run one scenario through the pipeline. Always uses V2 (harness ignores FORCE_LEGACY).
 * Does NOT call missions/generate.
 */
export async function runEvalScenario(options: RunEvalScenarioOptions): Promise<EvalRunResultV1> {
  const { scenario, baseUrl } = options;
  const gateTrace: EvalGateTraceEntry[] = [];
  const created = now();

  // 1) Audience safety (DB-first via API)
  let audienceSafetyLevel: 'all_ages' | 'adult_only' | 'blocked' = 'all_ages';
  let audienceSafetyFromCache: boolean | undefined;
  try {
    const res = await fetch(`${baseUrl}/api/audience-safety/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: scenario.intent,
        days: scenario.timeframe_days,
        ui_locale: scenario.ui_locale,
        intent_lang: scenario.intent_lang,
      }),
    });
    const data = (await res.json()) as { level?: string; from_cache?: boolean };
    audienceSafetyLevel = (data.level as 'all_ages' | 'adult_only' | 'blocked') ?? 'all_ages';
    audienceSafetyFromCache = data.from_cache;
    gateTrace.push({
      gate: 'audience_safety',
      outcome: audienceSafetyLevel,
      at: now(),
    });
  } catch (e) {
    gateTrace.push({ gate: 'audience_safety', outcome: 'error', at: now() });
  }

  if (audienceSafetyLevel === 'blocked') {
    const evalRunId_ = evalRunId(scenario.id, POLICY_VERSION, ENGINE_VERSION);
    return {
      eval_run_id: evalRunId_,
      scenario_id: scenario.id,
      scenario,
      policy_version: POLICY_VERSION,
      engine_version: ENGINE_VERSION,
      ui_outcome: 'blocked',
      gate_trace: gateTrace,
      audience_safety_level: 'blocked',
      audience_safety_from_cache: audienceSafetyFromCache,
      copy_variant: null,
      copy_debug_why: null,
      created_at: created,
      updated_at: now(),
    };
  }

  // 2) Tone gate (deterministic; same order as engine)
  const toneGate = detectToneDeterministic(scenario.intent, scenario.intent_lang);
  let toneResult: string | null = null;
  if (toneGate) {
    toneResult = toneGate.tone;
    gateTrace.push({ gate: 'tone', outcome: toneGate.tone, reason_code: toneGate.reason_code, confidence: toneGate.confidence, at: now() });
    if ((toneGate.tone === 'playful' || toneGate.tone === 'nonsense' || toneGate.tone === 'unclear') && toneGate.confidence >= 0.85) {
      const copyPlayful = resolveCopyVariant({
        audience_safety_level: audienceSafetyLevel ?? null,
        tone: toneGate.tone,
        ui_outcome: 'playful_nonsense',
        controllability_reason_code: null,
        classify_reason_code: null,
      });
      const evalRunId_ = evalRunId(scenario.id, POLICY_VERSION, ENGINE_VERSION);
      return {
        eval_run_id: evalRunId_,
        scenario_id: scenario.id,
        scenario,
        policy_version: POLICY_VERSION,
        engine_version: ENGINE_VERSION,
        ui_outcome: 'playful_nonsense',
        gate_trace: gateTrace,
        decision_outcome: 'PLAYFUL_OR_NONSENSE',
        decision_payload: { message_key: 'humor_response', tone: toneGate.tone, reason_code: toneGate.reason_code },
        decision_debug: { branch: 'tone_playful_nonsense' },
        audience_safety_level: audienceSafetyLevel,
        audience_safety_from_cache: audienceSafetyFromCache,
        tone: toneGate.tone,
        copy_variant: copyPlayful.variant,
        copy_debug_why: copyPlayful.debug_why,
        created_at: created,
        updated_at: now(),
      };
    }
  }

  // 3) Decision engine V2 (always; harness ignores env FORCE_LEGACY)
  const gateCopy = {
    controllabilitySupportTitle: GateCopy.controllabilitySupportTitle,
    controllabilitySupportBody: GateCopy.controllabilitySupportBody,
    safetyBlockedMessage: GateCopy.safetyBlockedMessage,
  };
  const decisionInput = {
    intent: scenario.intent,
    days: scenario.timeframe_days,
    ui_locale: scenario.ui_locale,
  };
  const decisionResult = await runDecisionEngine(decisionInput, gateCopy);

  gateTrace.push({
    gate: 'decision_engine',
    outcome: decisionResult.outcome,
    from_cache: decisionResult.debug?.from_cache,
    at: now(),
  });

  const resolved = decideUiOutcome({
    decisionOutcome: decisionResult.outcome,
    decisionPayload: decisionResult.payload as Record<string, unknown>,
    decisionDebug: decisionResult.debug ?? undefined,
    audienceSafetyLevel: audienceSafetyLevel ?? null,
    tone: toneResult ?? undefined,
  });

  const payload = decisionResult.payload as Record<string, unknown>;
  const debug = decisionResult.debug ?? {};
  let realismResult: 'realistic' | 'unrealistic' | null = null;
  let realismWhyShort: string | null = null;
  if (decisionResult.outcome === 'REALISM_ADJUST' && payload) {
    realismResult = 'unrealistic';
    realismWhyShort = (payload.why_short as string) ?? null;
  } else if (resolved.category) {
    realismResult = 'realistic';
  }

  const controllabilityReasonCode =
    resolved.ui_outcome === 'show_angles'
      ? detectControllability(scenario.intent, scenario.ui_locale, (resolved.category ?? undefined) as import('../taxonomy/categories').CategoryId | undefined).reason_code ?? null
      : null;
  const copyResult = resolveCopyVariant({
    audience_safety_level: audienceSafetyLevel ?? null,
    tone: resolved.tone ?? null,
    ui_outcome: resolved.ui_outcome,
    controllability_reason_code: controllabilityReasonCode,
    classify_reason_code: null,
  });

  const evalRunId_ = evalRunId(scenario.id, POLICY_VERSION, ENGINE_VERSION);
  return {
    eval_run_id: evalRunId_,
    scenario_id: scenario.id,
    scenario,
    policy_version: POLICY_VERSION,
    engine_version: ENGINE_VERSION,
    ui_outcome: resolved.ui_outcome as EvalUiOutcome,
    gate_trace: gateTrace,
    decision_outcome: decisionResult.outcome,
    decision_payload: payload,
    decision_debug: debug,
    category: resolved.category ?? undefined,
    sub_category: resolved.subcategory ?? undefined,
    audience_safety_level: audienceSafetyLevel,
    audience_safety_from_cache: audienceSafetyFromCache,
    controllability_level: undefined,
    controllability_reason_code: controllabilityReasonCode ?? undefined,
    controllability_from_cache: undefined,
    realism_result: realismResult,
    realism_why_short: realismWhyShort,
    tone: resolved.tone ?? undefined,
    suggestions: resolved.suggestions,
    classification: null,
    copy_variant: copyResult.variant,
    copy_debug_why: copyResult.debug_why,
    created_at: created,
    updated_at: now(),
  };
}
