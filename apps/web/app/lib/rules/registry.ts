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

export type { RuleDoc, RuleGate, RuleOutcome } from './types';

export const RULES_REGISTRY: RuleDoc[] = [
  ruleActionabilityV2,
  ruleClassifier,
  ruleCategory,
  ruleRealism,
  ruleAmbition,
];
