/**
 * File-based DecisionStore. NDJSON table + JSON index. Dev-only.
 */

import type { DecisionRecordV1 } from './types';
import { decisionIdFromUniqueKey } from './key';
import {
  tablePath,
  indexPath,
  readNdjson,
  writeNdjsonAtomic,
  readJson,
  writeJsonAtomic,
  fileExists,
  withTableLock,
} from './fileStore';

const TABLE_NAME = 'decision_records';
const INDEX_NAME = 'decision_records';

type DecisionIndexEntry = { id: string; updated_at: string };
type DecisionIndex = Record<string, DecisionIndexEntry>;

async function loadIndex(): Promise<DecisionIndex> {
  const path = indexPath(INDEX_NAME);
  if (!(await fileExists(path))) return {};
  try {
    return await readJson<DecisionIndex>(path);
  } catch {
    return {};
  }
}

async function saveIndex(index: DecisionIndex): Promise<void> {
  await writeJsonAtomic(indexPath(INDEX_NAME), index);
}

function indexKey(unique_key: string, context_hash: string): string {
  return `${unique_key}:${context_hash}`;
}

/** Days bucket: must match lib/db/key and preprocess. */
function daysBucketFromDays(days: number): string {
  if (days <= 14) return '<=14';
  if (days <= 30) return '<=30';
  if (days <= 90) return '<=90';
  return '>90';
}

export async function getById(id: string): Promise<DecisionRecordV1 | null> {
  const rows = await readNdjson<DecisionRecordV1>(tablePath(TABLE_NAME));
  return rows.find((r) => r.id === id) ?? null;
}

export async function getByUniqueKey(uniqueKey: string, contextHash: string): Promise<DecisionRecordV1 | null> {
  const idx = await loadIndex();
  const entry = idx[indexKey(uniqueKey, contextHash)];
  if (!entry) return null;
  return getById(entry.id);
}

export async function upsert(record: DecisionRecordV1): Promise<void> {
  await withTableLock(TABLE_NAME, async () => {
    const tablePath_ = tablePath(TABLE_NAME);
    let rows = await readNdjson<DecisionRecordV1>(tablePath_);
    const key = indexKey(record.unique_key, record.context_hash);
    const existingIndex = await loadIndex();
    const existingId = existingIndex[key]?.id;
    if (existingId) {
      rows = rows.filter((r) => r.id !== existingId);
    }
    rows.push(record);
    await writeNdjsonAtomic(tablePath_, rows);
    existingIndex[key] = { id: record.id, updated_at: record.updated_at };
    await saveIndex(existingIndex);
  });
}

export async function search(params: {
  intent_substring?: string;
  category?: string;
  intent_lang?: string;
  gate?: string;
  intent_fingerprint?: string;
  days_bucket?: string;
  policy_version?: string;
  limit?: number;
}): Promise<DecisionRecordV1[]> {
  let rows = await readNdjson<DecisionRecordV1>(tablePath(TABLE_NAME));
  if (params.intent_substring?.trim()) {
    const q = params.intent_substring.toLowerCase();
    rows = rows.filter((r) => r.intent_raw.toLowerCase().includes(q));
  }
  if (params.category) {
    rows = rows.filter((r) => r.category === params.category);
  }
  if (params.intent_lang) {
    rows = rows.filter((r) => r.intent_lang === params.intent_lang);
  }
  if (params.gate) {
    rows = rows.filter((r) => r.gate === params.gate);
  }
  if (params.intent_fingerprint) {
    rows = rows.filter((r) => r.intent_fingerprint === params.intent_fingerprint);
  }
  if (params.days_bucket) {
    rows = rows.filter((r) => daysBucketFromDays(r.days) === params.days_bucket);
  }
  if (params.policy_version) {
    rows = rows.filter((r) => r.policy_version === params.policy_version);
  }
  rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const limit = params.limit ?? 100;
  return rows.slice(0, limit);
}

export async function list(limit: number): Promise<DecisionRecordV1[]> {
  const rows = await readNdjson<DecisionRecordV1>(tablePath(TABLE_NAME));
  rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return rows.slice(0, limit);
}

/** Idempotent: only index rows with required keys (ignores partial/crashed records). */
function isValidDecisionRow(r: unknown): r is DecisionRecordV1 {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.unique_key === 'string' &&
    typeof x.context_hash === 'string' &&
    typeof x.updated_at === 'string'
  );
}

export async function rebuildIndex(): Promise<void> {
  const rows = await readNdjson<DecisionRecordV1>(tablePath(TABLE_NAME));
  const index: DecisionIndex = {};
  for (const r of rows) {
    if (!isValidDecisionRow(r)) continue;
    const key = indexKey(r.unique_key, r.context_hash);
    if (!index[key] || new Date(r.updated_at) > new Date(index[key].updated_at)) {
      index[key] = { id: r.id, updated_at: r.updated_at };
    }
  }
  await withTableLock(INDEX_NAME, async () => saveIndex(index));
}
