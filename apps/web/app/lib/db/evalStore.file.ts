/**
 * File-based EvalRun store. NDJSON table + JSON index. Dev-only.
 */

import type { EvalRunResultV1 } from '../eval/types';
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

const TABLE_NAME = 'eval_runs';
const INDEX_NAME = 'eval_runs';

type EvalIndexEntry = { eval_run_id: string; updated_at: string };
type EvalIndex = Record<string, EvalIndexEntry>;

async function loadIndex(): Promise<EvalIndex> {
  const path = indexPath(INDEX_NAME);
  if (!(await fileExists(path))) return {};
  try {
    return await readJson<EvalIndex>(path);
  } catch {
    return {};
  }
}

async function saveIndex(index: EvalIndex): Promise<void> {
  await writeJsonAtomic(indexPath(INDEX_NAME), index);
}

export async function getById(eval_run_id: string): Promise<EvalRunResultV1 | null> {
  const rows = await readNdjson<EvalRunResultV1>(tablePath(TABLE_NAME));
  return rows.find((r) => r.eval_run_id === eval_run_id) ?? null;
}

export async function upsertEvalRun(result: EvalRunResultV1): Promise<void> {
  await withTableLock(TABLE_NAME, async () => {
    const tablePath_ = tablePath(TABLE_NAME);
    let rows = await readNdjson<EvalRunResultV1>(tablePath_);
    rows = rows.filter((r) => r.eval_run_id !== result.eval_run_id);
    rows.push(result);
    await writeNdjsonAtomic(tablePath_, rows);
    const idx = await loadIndex();
    idx[result.eval_run_id] = { eval_run_id: result.eval_run_id, updated_at: result.updated_at };
    await saveIndex(idx);
  });
}

export async function listEvalRuns(
  limit: number,
  filters?: {
    category?: string;
    sub_category?: string;
    ui_outcome?: string;
    audience_safety_level?: string;
    intent_lang?: string;
    tag?: string;
  },
): Promise<EvalRunResultV1[]> {
  let rows = await readNdjson<EvalRunResultV1>(tablePath(TABLE_NAME));
  if (filters?.category) {
    rows = rows.filter((r) => r.category === filters.category);
  }
  if (filters?.sub_category) {
    rows = rows.filter((r) => r.sub_category === filters.sub_category);
  }
  if (filters?.ui_outcome) {
    rows = rows.filter((r) => r.ui_outcome === filters.ui_outcome);
  }
  if (filters?.audience_safety_level) {
    rows = rows.filter((r) => r.audience_safety_level === filters.audience_safety_level);
  }
  if (filters?.intent_lang) {
    rows = rows.filter((r) => r.scenario?.intent_lang === filters.intent_lang);
  }
  if (filters?.tag) {
    rows = rows.filter((r) => r.scenario?.tags?.includes(filters.tag!));
  }
  rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return rows.slice(0, limit);
}

export async function searchEvalRuns(query: string, limit: number): Promise<EvalRunResultV1[]> {
  if (!query?.trim()) {
    return listEvalRuns(limit);
  }
  const q = query.toLowerCase().trim();
  const rows = await readNdjson<EvalRunResultV1>(tablePath(TABLE_NAME));
  const filtered = rows.filter((r) => {
    const intent = (r.scenario?.intent ?? '').toLowerCase();
    const title = (r.scenario?.title_en ?? '').toLowerCase();
    const id = (r.scenario_id ?? '').toLowerCase();
    return intent.includes(q) || title.includes(q) || id.includes(q);
  });
  filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return filtered.slice(0, limit);
}

function isValidEvalRow(r: unknown): r is EvalRunResultV1 {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  return (
    typeof x.eval_run_id === 'string' &&
    typeof x.scenario_id === 'string' &&
    typeof x.updated_at === 'string'
  );
}

export async function rebuildEvalIndex(): Promise<void> {
  const rows = await readNdjson<EvalRunResultV1>(tablePath(TABLE_NAME));
  const index: EvalIndex = {};
  for (const r of rows) {
    if (!isValidEvalRow(r)) continue;
    index[r.eval_run_id] = { eval_run_id: r.eval_run_id, updated_at: r.updated_at };
  }
  await withTableLock(INDEX_NAME, async () => saveIndex(index));
}
