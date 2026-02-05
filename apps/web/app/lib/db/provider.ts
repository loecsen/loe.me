/**
 * Single provider for DB stores. Dev-only: always file-based.
 * Later: switch by env var to PostgresDecisionStore / PostgresPromptStore.
 */

import type { DecisionStore } from './types';
import type { PromptStore } from './types';
import * as decisionFile from './decisionStore.file';
import * as promptFile from './promptStore.file';

export function getDecisionStore(): DecisionStore {
  return {
    getById: decisionFile.getById,
    getByUniqueKey: decisionFile.getByUniqueKey,
    upsert: decisionFile.upsert,
    search: decisionFile.search,
    list: decisionFile.list,
  };
}

export function getPromptStore(): PromptStore {
  return {
    getByNameVersion: promptFile.getByNameVersion,
    getById: promptFile.getById,
    upsert: promptFile.upsert,
    list: promptFile.list,
  };
}

export async function rebuildAllIndexes(): Promise<void> {
  await decisionFile.rebuildIndex();
  await promptFile.rebuildIndex();
}
