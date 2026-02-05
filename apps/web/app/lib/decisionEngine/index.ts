/**
 * Decision Engine V2 — public API.
 */

export type {
  DecisionEngineInput,
  DecisionEngineOutput,
  DecisionOutcome,
  DecisionPayload,
  PreprocessedInput,
  DecisionAngle,
  PayloadProceed,
  PayloadAngles,
  PayloadClarify,
  PayloadConfirmAmbition,
  PayloadChooseCategory,
  PayloadBlocked,
} from './types';
export { preprocess, daysBucket } from './preprocess';
export { trigramJaccard, trigrams, isInEquivalenceBand, SIMILARITY_MIN_INTENT_LENGTH, SIMILARITY_LOW, SIMILARITY_HIGH } from './similarity';
export { runDecisionEngine, type GateCopyLike } from './engine';
