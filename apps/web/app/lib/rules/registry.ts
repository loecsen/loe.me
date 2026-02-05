/**
 * Single source of truth for Admin rules page (static, no side effects).
 * Logic remains in actionability.ts, realism.ts, ambitionConfirmation.ts, classifier.
 */

import type { RuleDoc } from './types';
import { ruleActionabilityV2 } from './entries/actionabilityV2';
import { ruleClassifier } from './entries/classifier';
import { ruleCategory } from './entries/category';
import { ruleRealism } from './entries/realism';
import { ruleAmbition } from './entries/ambition';
import { ruleControllability } from './entries/controllability';
import { ruleLanguagePolicy } from './entries/languagePolicy';
import { ruleLexicon } from './entries/lexicon';
import { ruleDecisionDb } from './entries/decisionDb';
import { ruleDecisionEngineV2 } from './entries/decisionEngineV2';
import { ruleDecisionEngineSelection } from './entries/decisionEngineSelection';
import { ruleAudienceSafety } from './entries/audienceSafety';
import { ruleToneGate } from './entries/toneGate';
import { rulePromptPolicy } from './entries/promptPolicy';
import { ruleCopyVariant } from './entries/copyVariant';

export type { RuleDoc, RuleGate, RuleOutcome } from './types';

export const RULES_REGISTRY: RuleDoc[] = [
  ruleActionabilityV2,
  ruleClassifier,
  ruleCategory,
  ruleRealism,
  ruleAmbition,
  ruleControllability,
  ruleLanguagePolicy,
  ruleLexicon,
  ruleDecisionDb,
  ruleDecisionEngineV2,
  ruleDecisionEngineSelection,
  ruleAudienceSafety,
  ruleToneGate,
  ruleCopyVariant,
  rulePromptPolicy,
];
