/**
 * File-based clarify-chips cache. NDJSON table + JSON index. Dev-only.
 */

import type { ClarifyChipsCacheEntry } from './types';
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

const TABLE_NAME = 'clarify_chips_cache';
const INDEX_NAME = 'clarify_chips_cache';

type CacheIndexEntry = { id: string; updated_at: string; expires_at: string };
type CacheIndex = Record<string, CacheIndexEntry>;

async function loadIndex(): Promise<CacheIndex> {
  const path = indexPath(INDEX_NAME);
  if (!(await fileExists(path))) return {};
  try {
    return await readJson<CacheIndex>(path);
  } catch {
    return {};
  }
}

async function saveIndex(index: CacheIndex): Promise<void> {
  await writeJsonAtomic(indexPath(INDEX_NAME), index);
}

function isExpired(expiresAt: string): boolean {
  const ms = new Date(expiresAt).getTime();
  return Number.isFinite(ms) ? Date.now() > ms : true;
}

export async function getByCacheKey(cacheKey: string): Promise<ClarifyChipsCacheEntry | null> {
  const idx = await loadIndex();
  const entry = idx[cacheKey];
  if (!entry) return null;
  if (isExpired(entry.expires_at)) return null;
  const rows = await readNdjson<ClarifyChipsCacheEntry>(tablePath(TABLE_NAME));
  return rows.find((r) => r.id === entry.id) ?? null;
}

export async function upsert(record: ClarifyChipsCacheEntry): Promise<void> {
  await withTableLock(TABLE_NAME, async () => {
    const tablePath_ = tablePath(TABLE_NAME);
    let rows = await readNdjson<ClarifyChipsCacheEntry>(tablePath_);
    const existingIndex = await loadIndex();
    const existingId = existingIndex[record.cache_key]?.id;
    if (existingId) {
      rows = rows.filter((r) => r.id !== existingId);
    }
    rows.push(record);
    await writeNdjsonAtomic(tablePath_, rows);
    existingIndex[record.cache_key] = {
      id: record.id,
      updated_at: record.created_at,
      expires_at: record.expires_at,
    };
    await saveIndex(existingIndex);
  });
}
