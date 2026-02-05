/**
 * File-based Idea Routines store. NDJSON table + JSON index. Dev-only.
 */

import type { IdeaRoutineV1, IdeaRoutineCategory } from './types';
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

const TABLE_NAME = 'idea_routines';
const INDEX_NAME = 'idea_routines';

type IdeaRoutineIndexEntry = { id: string; category: IdeaRoutineCategory; updated_at: string };
type IdeaRoutineIndex = Record<string, IdeaRoutineIndexEntry>;

async function loadIndex(): Promise<IdeaRoutineIndex> {
  const path = indexPath(INDEX_NAME);
  if (!(await fileExists(path))) return {};
  try {
    return await readJson<IdeaRoutineIndex>(path);
  } catch {
    return {};
  }
}

async function saveIndex(index: IdeaRoutineIndex): Promise<void> {
  await writeJsonAtomic(indexPath(INDEX_NAME), index);
}

export async function list(params: {
  category?: IdeaRoutineCategory;
  q?: string;
  limit?: number;
  hasTranslationForLocale?: string;
}): Promise<IdeaRoutineV1[]> {
  const rows = await readNdjson<IdeaRoutineV1>(tablePath(TABLE_NAME));
  let out = rows;
  if (params.category) {
    out = out.filter((r) => r.category === params.category);
  }
  if (params.q && params.q.trim()) {
    const q = params.q.trim().toLowerCase();
    out = out.filter(
      (r) =>
        r.title_en.toLowerCase().includes(q) ||
        r.intent_en.toLowerCase().includes(q),
    );
  }
  if (params.hasTranslationForLocale) {
    const lang = params.hasTranslationForLocale.toLowerCase();
    out = out.filter((r) => r.translations && lang in r.translations);
  }
  const limit = Math.min(params.limit ?? 100, 500);
  return out.slice(0, limit);
}

export async function getById(id: string): Promise<IdeaRoutineV1 | null> {
  const rows = await readNdjson<IdeaRoutineV1>(tablePath(TABLE_NAME));
  return rows.find((r) => r.id === id) ?? null;
}

export async function upsert(record: IdeaRoutineV1): Promise<void> {
  await withTableLock(TABLE_NAME, async () => {
    const tablePath_ = tablePath(TABLE_NAME);
    let rows = await readNdjson<IdeaRoutineV1>(tablePath_);
    rows = rows.filter((r) => r.id !== record.id);
    rows.push(record);
    await writeNdjsonAtomic(tablePath_, rows);
    const idx = await loadIndex();
    idx[record.id] = { id: record.id, category: record.category, updated_at: record.updated_at };
    await saveIndex(idx);
  });
}

export async function rebuildIndex(): Promise<void> {
  await withTableLock(TABLE_NAME, async () => {
    const rows = await readNdjson<IdeaRoutineV1>(tablePath(TABLE_NAME));
    const idx: IdeaRoutineIndex = {};
    for (const r of rows) {
      idx[r.id] = { id: r.id, category: r.category, updated_at: r.updated_at };
    }
    await saveIndex(idx);
  });
}

/** Pick up to `count` random routines from the list, excluding given ids. */
export function pickRandom(
  routines: IdeaRoutineV1[],
  excludeIds: string[],
  count: number,
): IdeaRoutineV1[] {
  const set = new Set(excludeIds);
  const available = routines.filter((r) => !set.has(r.id));
  if (available.length <= count) return available;
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
