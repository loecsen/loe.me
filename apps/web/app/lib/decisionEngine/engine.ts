/**
 * Decision Engine V2 — orchestrator.
 * DB-first: exact cache → similarity (equivalence) → safety (hard + LLM) → category → tone → category_analysis → controllability → realism → proceed.
 */

import { buildDecisionUniqueKey, decisionIdFromUniqueKey, normalizeIntentForKey } from '../db/key';
import { getDecisionStore } from '../db/provider';
import { isRecordFresh } from '../db/freshness';
import type { DecisionRecordV1 } from '../db/types';
import { hardBlock } from '../safety/hardBlock';
import { inferCategoryFromIntent } from '../actionability';
import { needsAmbitionConfirmation } from '../actionability/ambitionConfirmation';
import { detectControllability } from '../actionability/controllability';
import { detectToneDeterministic } from '../actionability/tone';
import { getDefaultControllableAngles } from '../taxonomy/angles';
import type { CategoryId } from '../taxonomy/categories';
import { CATEGORY_IDS, CATEGORY_DOCS } from '../taxonomy/categories';
import { categoryRequiresFeasibility } from '../category';
import { preprocess } from './preprocess';
import { trigramJaccard, isInEquivalenceBand, SIMILARITY_MIN_INTENT_LENGTH } from './similarity';
import { computeIntentFingerprint } from '../intent/fingerprint';
import { runEquivalenceJudge } from './judges/equivalence';
import { runSafetyJudge } from './judges/safety';
import { runIntentReformulation } from './judges/intentReformulation';
import { runCategoryRouter } from './judges/category';
import { runCategoryAnalysisJudge } from './judges/categoryAnalysis';
import { runRealismJudge } from './judges/realism';
import { runObjectivesPreview } from './judges/objectivesPreview';
import type {
  DecisionEngineInput,
  DecisionEngineOutput,
  DecisionOutcome,
  PayloadAngles,
  PayloadProceed,
  PayloadBlocked,
  PayloadClarify,
  PayloadConfirmAmbition,
  PayloadChooseCategory,
  PayloadRealismAdjust,
  PayloadPlayfulOrNonsense,
  PromptTraceEntry,
} from './types';
/** Gate copy for localized messages; passed from caller to avoid importing React/i18n. */
export type GateCopyLike = {
  controllabilitySupportTitle: () => string;
  controllabilitySupportBody: () => string;
  safetyBlockedMessage: () => string;
};

function withPromptTrace<T extends DecisionEngineOutput>(out: T, trace: PromptTraceEntry[] | undefined): T {
  if (trace?.length) return { ...out, prompt_trace: trace } as T;
  return out;
}

/** Short guide-style title from rewritten intent: strip day suffix, capitalize. */
function deriveGuideTitle(rewrittenIntent: string): string {
  let t = (rewrittenIntent ?? '').trim();
  t = t.replace(/\s+en\s+\d+\s+jours?\s*$/i, '').replace(/\s+in\s+\d+\s+days?\s*$/i, '');
  t = t.replace(/\s+(?:en|in)\s+\d+\s+(?:jours?|days?)\s*$/i, '');
  t = t.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return (rewrittenIntent ?? '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Run Decision Engine: preprocess → exact cache → safety → minimal path (stub).
 * When cache miss: run deterministic safety; then infer category + controllability;
 * return SHOW_ANGLES if low controllability, else PROCEED_TO_GENERATE.
 */
export async function runDecisionEngine(
  input: DecisionEngineInput,
  gateCopy: GateCopyLike,
  options?: { collectPromptTrace?: boolean },
): Promise<DecisionEngineOutput> {
  const pre = preprocess(input);
  const forceProceed = input.force_proceed === true;
  const promptTrace: PromptTraceEntry[] | undefined = options?.collectPromptTrace ? [] : undefined;

  // 1) Exact cache lookup (gate = decision_engine, no category in key)
  const keyResult = buildDecisionUniqueKey({
    intent: pre.normalized_intent,
    intent_lang: pre.intent_lang,
    days: pre.days,
    gate: 'decision_engine',
  });
  const store = getDecisionStore();
  const cached = await store.getByUniqueKey(keyResult.unique_key, keyResult.context_hash);
  if (cached && cached.engine_outcome && cached.engine_payload) {
    const fresh = isRecordFresh(cached.updated_at, 'decision_engine');
    if (fresh) {
      const safety = hardBlock(input.intent);
      if (safety.blocked) {
        return withPromptTrace(
          {
            outcome: 'BLOCKED_SAFETY',
            payload: { reason_code: safety.reason_code } as PayloadBlocked,
            debug: { branch: 'cached_then_safety_block', from_cache: true },
          },
          promptTrace,
        );
      }
      return withPromptTrace(
      {
        outcome: cached.engine_outcome as DecisionOutcome,
        payload: cached.engine_payload as DecisionEngineOutput['payload'],
        debug: { branch: 'exact_cache', from_cache: true },
      },
      promptTrace,
    );
  }
  }

  // 1bis-a) Fingerprint similarity: same fp + days_bucket → reuse cached decision (no equivalence judge)
  const fpResult = computeIntentFingerprint(pre.normalized_intent, pre.intent_lang, null);
  if (fpResult.fp) {
    const fpCandidates = await store.search({
      intent_fingerprint: fpResult.fp,
      gate: 'decision_engine',
      intent_lang: pre.intent_lang,
      days_bucket: pre.days_bucket,
      policy_version: pre.policy_version,
      limit: 10,
    });
    for (const candidate of fpCandidates) {
      if (!candidate.engine_outcome || !candidate.engine_payload) continue;
      if (!isRecordFresh(candidate.updated_at, 'decision_engine')) continue;
      const safety = hardBlock(input.intent);
      if (safety.blocked) {
        return withPromptTrace(
          {
            outcome: 'BLOCKED_SAFETY',
            payload: { reason_code: safety.reason_code } as PayloadBlocked,
            debug: {
              branch: 'fingerprint_then_safety_block',
              from_cache: true,
              similarity_hit: true,
              matched_record_id: candidate.id,
              fingerprint: fpResult.fp,
            },
          },
          promptTrace,
        );
      }
      return withPromptTrace(
        {
          outcome: candidate.engine_outcome as DecisionOutcome,
          payload: candidate.engine_payload as DecisionEngineOutput['payload'],
          debug: {
            branch: 'fingerprint_cache',
            from_cache: true,
            similarity_hit: true,
            matched_record_id: candidate.id,
            fingerprint: fpResult.fp,
          },
        },
        promptTrace,
      );
    }
  }

  // 1bis-b) Trigram similarity (intent length > 20): candidates by intent_lang + gate, Jaccard in [0.70, 0.90] → equivalence judge
  if (pre.normalized_intent.length > SIMILARITY_MIN_INTENT_LENGTH) {
    const candidates = await store.search({
      intent_lang: pre.intent_lang,
      gate: 'decision_engine',
      limit: 50,
    });
    for (const candidate of candidates) {
      if (!candidate.engine_outcome || !candidate.engine_payload) continue;
      const candidateNorm = normalizeIntentForKey(candidate.intent_raw);
      const score = trigramJaccard(pre.normalized_intent, candidateNorm);
      if (!isInEquivalenceBand(score)) continue;
      const judgeResult = await runEquivalenceJudge(pre.normalized_intent, candidateNorm, promptTrace);
      if (judgeResult?.same_request && isRecordFresh(candidate.updated_at, 'decision_engine')) {
        const safety = hardBlock(input.intent);
        if (safety.blocked) {
          return withPromptTrace(
            {
              outcome: 'BLOCKED_SAFETY',
              payload: { reason_code: safety.reason_code } as PayloadBlocked,
              debug: { branch: 'similarity_then_safety_block', from_cache: true, equivalence_used: true },
            },
            promptTrace,
          );
        }
        return withPromptTrace(
          {
            outcome: candidate.engine_outcome as DecisionOutcome,
            payload: candidate.engine_payload as DecisionEngineOutput['payload'],
            debug: { branch: 'similarity_cache', from_cache: true, equivalence_used: true },
          },
          promptTrace,
        );
      }
    }
  }

  // 2) Safety gate: deterministic first, then LLM when not blocked
  const safety = hardBlock(input.intent);
  if (safety.blocked) {
    return {
      outcome: 'BLOCKED_SAFETY',
      payload: { reason_code: safety.reason_code } as PayloadBlocked,
      debug: { branch: 'safety_block' },
    };
  }
  const safetyJudge = await runSafetyJudge(input.intent, promptTrace);
  if (safetyJudge?.verdict === 'block') {
    return withPromptTrace(
      {
        outcome: 'BLOCKED_SAFETY',
        payload: { reason_code: safetyJudge.reason_code } as PayloadBlocked,
        debug: { branch: 'safety_judge_block' },
      },
      promptTrace,
    );
  }
  // uncertain => allow and continue (e.g. "récupérer mon ex" => category → controllability → angles)
  if (safetyJudge?.verdict === 'uncertain') {
    // fall through to category / controllability
  }

  // 2ter) Intent reformulation (method-style title, same language, with days) — between safety and category for pipeline trace
  const reformulationResult = await runIntentReformulation(
    input.intent,
    pre.intent_lang,
    input.days,
    promptTrace,
  );
  const reformulationFromStep: string | null =
    reformulationResult?.reformulated_intent?.trim() ?? null;

  // 2bis) Tone gate: playful/nonsense/unclear → PLAYFUL_OR_NONSENSE (humor_response; not controllability angles)
  const toneGate = detectToneDeterministic(input.intent, pre.intent_lang);
  if (toneGate && (toneGate.tone === 'playful' || toneGate.tone === 'nonsense' || toneGate.tone === 'unclear') && toneGate.confidence >= 0.85) {
    const payloadPlayful: PayloadPlayfulOrNonsense = {
      message_key: 'humor_response',
      tone: toneGate.tone,
      reason_code: toneGate.reason_code,
    };
    const outcome: DecisionEngineOutput = {
      outcome: 'PLAYFUL_OR_NONSENSE',
      payload: payloadPlayful,
      debug: { branch: 'tone_playful_nonsense', tone: toneGate.tone, reason_code: toneGate.reason_code },
    };
    await persistDecisionEngineResult(input, pre, outcome);
    return withPromptTrace(outcome, promptTrace);
  }

  // 3) Category: infer first (WELLBEING for romantic/wellbeing intents); router can override except when infer is WELLBEING
  const inferredCategory = inferCategoryFromIntent(input.intent) ?? undefined;
  let category: CategoryId = (inferredCategory ?? 'WELLBEING') as CategoryId;
  const categoryRouter = await runCategoryRouter(input.intent, promptTrace);
  if (categoryRouter) {
    const CATEGORY_CONFIDENCE_THRESHOLD = 0.6;
    // Keep WELLBEING when infer already says WELLBEING (e.g. "récupérer mon ex" → angles, not SOCIAL + ambition)
    if (inferredCategory !== 'WELLBEING') {
      category = categoryRouter.category;
    }
    if (categoryRouter.confidence < CATEGORY_CONFIDENCE_THRESHOLD) {
      const suggestions = CATEGORY_IDS.slice(0, 3).map((id) => {
        const doc = CATEGORY_DOCS.find((d) => d.id === id);
        return { category: id, label_key: doc?.label_key ?? `categoryLabel${id}` };
      });
      const payloadChoose: PayloadChooseCategory = { suggestions };
      const outcome: DecisionEngineOutput = {
        outcome: 'ASK_USER_CHOOSE_CATEGORY',
        payload: payloadChoose,
        debug: { branch: 'category_low_confidence', category },
      };
      await persistDecisionEngineResult(input, pre, outcome);
      return withPromptTrace(outcome, promptTrace);
    }
  }

  // 4) Ambition confirm: ONLY elite/superlative/life-goal (deterministic); skip for WELLBEING → go to angles
  if (needsAmbitionConfirmation(input.intent) && category !== 'WELLBEING') {
    const payloadConfirm: PayloadConfirmAmbition = {
      intent: input.intent,
      days: input.days,
    };
    const outcome: DecisionEngineOutput = {
      outcome: 'CONFIRM_AMBITION',
      payload: payloadConfirm,
      debug: { branch: 'ambition_confirm_elite', category },
    };
    await persistDecisionEngineResult(input, pre, outcome);
    return withPromptTrace(outcome, promptTrace);
  }

  // 5) Category analysis: needs_clarification => ASK_CLARIFICATION; actionable + angles => SHOW_ANGLES
  const analysis = await runCategoryAnalysisJudge(
    category,
    input.intent,
    input.ui_locale,
    pre.intent_lang,
    input.days,
    promptTrace,
  );
  if (analysis?.needs_clarification && analysis.clarify_question && !forceProceed) {
    const payloadClarify: PayloadClarify = {
      clarify_question: analysis.clarify_question,
      suggested_rewrites: analysis.suggested_rewrites ?? undefined,
    };
    const outcome: DecisionEngineOutput = {
      outcome: 'ASK_CLARIFICATION',
      payload: payloadClarify,
      debug: { branch: 'category_analysis_clarify', category },
    };
    await persistDecisionEngineResult(input, pre, outcome);
    return withPromptTrace(outcome, promptTrace);
  }
  // Quand la demande est claire (needs_clarification === false), ne pas afficher les angles : aller à l’étape confirmation (proceed).
  const intentClear = analysis?.actionable && analysis.needs_clarification === false;
  if (!intentClear && analysis?.actionable && analysis.angles && analysis.angles.length > 0 && !forceProceed) {
    const payloadAngles: PayloadAngles = {
      primary: gateCopy.controllabilitySupportTitle(),
      secondary: gateCopy.controllabilitySupportBody(),
      angles: analysis.angles.slice(0, 4),
      original_intent: input.intent,
      rewritten_intent: reformulationFromStep ?? (pre.normalized_intent || input.intent),
      reformulation_includes_days: reformulationFromStep != null,
    };
    const outcome: DecisionEngineOutput = {
      outcome: 'SHOW_ANGLES',
      payload: payloadAngles,
      debug: { branch: 'category_analysis_angles', gate_status: 'ACTIONABLE', category },
    };
    await persistDecisionEngineResult(input, pre, outcome);
    return withPromptTrace(outcome, promptTrace);
  }
  // Fallback: actionable but no angles from LLM => use default controllable angles (e.g. "récupérer mon ex" → supportive angles). Skip when intent already clear.
  if (!intentClear && analysis?.actionable && !forceProceed) {
    const angles = getDefaultControllableAngles(
      category,
      input.ui_locale,
      input.intent,
      input.days,
      pre.intent_lang,
    );
    const payloadAngles: PayloadAngles = {
      primary: gateCopy.controllabilitySupportTitle(),
      secondary: gateCopy.controllabilitySupportBody(),
      angles: angles.slice(0, 4).map((a) => ({
        label: a.label_key,
        next_intent: a.intent,
        ...(a.days != null && { days: a.days }),
      })),
      original_intent: input.intent,
      rewritten_intent: reformulationFromStep ?? (pre.normalized_intent || input.intent),
      reformulation_includes_days: reformulationFromStep != null,
    };
    const outcome: DecisionEngineOutput = {
      outcome: 'SHOW_ANGLES',
      payload: payloadAngles,
      debug: { branch: 'category_analysis_angles_fallback', gate_status: 'ACTIONABLE', category },
    };
    await persistDecisionEngineResult(input, pre, outcome);
    return withPromptTrace(outcome, promptTrace);
  }

  // 6) Controllability (existing heuristic): low => SHOW_ANGLES with default angles
  const ctrl = detectControllability(input.intent, input.ui_locale, category);
  const CONTROLLABILITY_THRESHOLD = 0.75;
  if (ctrl.level === 'low' && ctrl.confidence >= CONTROLLABILITY_THRESHOLD && !forceProceed) {
    const angles = getDefaultControllableAngles(
      category,
      input.ui_locale,
      input.intent,
      input.days,
      pre.intent_lang,
    );
    const payloadAngles: PayloadAngles = {
      primary: gateCopy.controllabilitySupportTitle(),
      secondary: gateCopy.controllabilitySupportBody(),
      angles: angles.slice(0, 4).map((a) => ({
        label: a.label_key,
        next_intent: a.intent,
        ...(a.days != null && { days: a.days }),
      })),
      original_intent: input.intent,
      rewritten_intent: reformulationFromStep ?? (pre.normalized_intent || input.intent),
      reformulation_includes_days: reformulationFromStep != null,
    };
    const outcome: DecisionEngineOutput = {
      outcome: 'SHOW_ANGLES',
      payload: payloadAngles,
      debug: { branch: 'controllability_support', gate_status: 'ACTIONABLE', category },
    };
    await persistDecisionEngineResult(input, pre, outcome);
    return withPromptTrace(outcome, promptTrace);
  }

  // 7) Realism: when category requires feasibility, unrealistic + adjustments => REALISM_ADJUST
  if (categoryRequiresFeasibility(category)) {
    const realismResult = await runRealismJudge(
      input.intent,
      input.days,
      input.ui_locale,
      category,
      promptTrace,
    );
    if (
      realismResult?.realism === 'unrealistic' &&
      realismResult.adjustments &&
      realismResult.adjustments.length > 0
    ) {
      const payloadRealism: PayloadRealismAdjust = {
        why_short: realismResult.why_short,
        adjustments: realismResult.adjustments,
        intentionToSend: input.intent,
        days: input.days,
        category,
      };
      const outcome: DecisionEngineOutput = {
        outcome: 'REALISM_ADJUST',
        payload: payloadRealism,
        debug: { branch: 'realism_adjust', category },
      };
      await persistDecisionEngineResult(input, pre, outcome);
      return withPromptTrace(outcome, promptTrace);
    }
  }

  // 8) Proceed — store rewritten_intent, guide_title, objectives for confirm step
  const rewrittenIntent = reformulationFromStep ?? (pre.normalized_intent || input.intent);
  const guide_title = deriveGuideTitle(rewrittenIntent);
  const objectivesResult = await runObjectivesPreview(
    input.intent,
    pre.intent_lang,
    input.days,
    promptTrace,
  );
  const payloadProceed: PayloadProceed = {
    rewritten_intent: rewrittenIntent,
    reformulation_includes_days: reformulationFromStep != null,
    guide_title: guide_title || undefined,
    objectives: objectivesResult?.objectives?.length ? objectivesResult.objectives : undefined,
    days: input.days,
    category,
  };
  const outcome: DecisionEngineOutput = {
    outcome: 'PROCEED_TO_GENERATE',
    payload: payloadProceed,
    debug: { branch: 'proceed', gate_status: 'ACTIONABLE', category },
  };
  await persistDecisionEngineResult(input, pre, outcome);
  return withPromptTrace(outcome, promptTrace);
}

async function persistDecisionEngineResult(
  input: DecisionEngineInput,
  pre: ReturnType<typeof preprocess>,
  output: DecisionEngineOutput,
): Promise<void> {
  try {
    const keyResult = buildDecisionUniqueKey({
      intent: pre.normalized_intent,
      intent_lang: pre.intent_lang,
      days: pre.days,
      gate: 'decision_engine',
    });
    const id = decisionIdFromUniqueKey(keyResult.unique_key);
    const now = new Date().toISOString();
    const category = (output.debug?.category as string) ?? undefined;
    const fp = computeIntentFingerprint(pre.normalized_intent, pre.intent_lang, category ?? null);
    const record: DecisionRecordV1 = {
      id,
      schema_version: 'decision-record-v1',
      created_at: now,
      updated_at: now,
      intent_raw: input.intent,
      intent_lang: pre.intent_lang,
      ui_locale: input.ui_locale,
      days: pre.days,
      category,
      gates: {},
      verdict: output.outcome === 'BLOCKED_SAFETY' ? 'BLOCKED' : 'ACTIONABLE',
      reason_code: (output.payload as PayloadBlocked).reason_code ?? undefined,
      suggestions: {
        rewritten_intent: (output.payload as PayloadProceed | PayloadAngles).rewritten_intent ?? undefined,
        angles: (output.payload as PayloadAngles).angles ?? undefined,
      },
      unique_key: keyResult.unique_key,
      context_hash: keyResult.context_hash,
      policy_version: pre.policy_version,
      gate: 'decision_engine',
      engine_outcome: output.outcome,
      engine_payload: output.payload as Record<string, unknown>,
      intent_fingerprint: fp.fp || undefined,
      intent_fingerprint_algo: fp.fp ? fp.algo : undefined,
    };
    const store = getDecisionStore();
    await store.upsert(record);
  } catch {
    /* best-effort persist */
  }
}
