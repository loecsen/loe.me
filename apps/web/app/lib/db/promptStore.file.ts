/**
 * File-based PromptStore. NDJSON table + JSON index. Dev-only.
 */

import type { PromptCatalogEntryV1 } from './types';
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

const TABLE_NAME = 'prompt_catalog';
const INDEX_NAME = 'prompt_catalog';

type PromptIndexEntry = { id: string; updated_at: string };
type PromptIndex = Record<string, PromptIndexEntry>;

function nameVersionKey(name: string, version: string): string {
  return `${name}@${version}`;
}

async function loadIndex(): Promise<PromptIndex> {
  const path = indexPath(INDEX_NAME);
  if (!(await fileExists(path))) return {};
  try {
    return await readJson<PromptIndex>(path);
  } catch {
    return {};
  }
}

async function saveIndex(index: PromptIndex): Promise<void> {
  await writeJsonAtomic(indexPath(INDEX_NAME), index);
}

export async function getByNameVersion(name: string, version: string): Promise<PromptCatalogEntryV1 | null> {
  const idx = await loadIndex();
  const entry = idx[nameVersionKey(name, version)];
  if (!entry) return null;
  return getById(entry.id);
}

export async function getById(id: string): Promise<PromptCatalogEntryV1 | null> {
  const rows = await readNdjson<PromptCatalogEntryV1>(tablePath(TABLE_NAME));
  return rows.find((r) => r.id === id) ?? null;
}

export async function upsert(entry: PromptCatalogEntryV1): Promise<void> {
  const tablePath_ = tablePath(TABLE_NAME);
  let rows = await readNdjson<PromptCatalogEntryV1>(tablePath_);
  const key = nameVersionKey(entry.name, entry.version);
  const existingIndex = await loadIndex();
  const existingId = existingIndex[key]?.id;
  if (existingId) {
    rows = rows.filter((r) => r.id !== existingId);
  }
  rows.push(entry);
  await writeNdjsonAtomic(tablePath_, rows);
  existingIndex[key] = { id: entry.id, updated_at: entry.updated_at };
  await saveIndex(existingIndex);
}

export async function list(limit?: number): Promise<PromptCatalogEntryV1[]> {
  const rows = await readNdjson<PromptCatalogEntryV1>(tablePath(TABLE_NAME));
  rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const n = limit ?? 100;
  return rows.slice(0, n);
}

function isValidPromptRow(r: unknown): r is PromptCatalogEntryV1 {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.version === 'string' &&
    typeof x.updated_at === 'string'
  );
}

export async function rebuildIndex(): Promise<void> {
  const rows = await readNdjson<PromptCatalogEntryV1>(tablePath(TABLE_NAME));
  const index: PromptIndex = {};
  for (const r of rows) {
    if (!isValidPromptRow(r)) continue;
    const key = nameVersionKey(r.name, r.version);
    if (!index[key] || new Date(r.updated_at) > new Date(index[key].updated_at)) {
      index[key] = { id: r.id, updated_at: r.updated_at };
    }
  }
  await withTableLock(INDEX_NAME, async () => saveIndex(index));
}
