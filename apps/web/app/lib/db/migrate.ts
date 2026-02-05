/**
 * Migration helpers for dev DB. Schema version at row level.
 * Runner script can detect older schema_version and migrate or export.
 * No actual migrations run here unless needed.
 */

import type { DecisionRecordV1, PromptCatalogEntryV1 } from './types';
import { DECISION_RECORD_SCHEMA_VERSION, PROMPT_CATALOG_SCHEMA_VERSION } from './types';

export function isDecisionRecordV1(row: unknown): row is DecisionRecordV1 {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return r.schema_version === DECISION_RECORD_SCHEMA_VERSION;
}

export function isPromptCatalogEntryV1(row: unknown): row is PromptCatalogEntryV1 {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return r.schema_version === PROMPT_CATALOG_SCHEMA_VERSION;
}
