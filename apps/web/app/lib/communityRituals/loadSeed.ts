/**
 * Load community rituals seed by ui_locale. Dev-only; file under PourLaMaquette/community-rituals.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CommunityRitualV1, IdeaRoutineCategory } from '../db/types';
import { getCommunityRitualsDir } from '../db/paths';

const SEED_FILENAME = 'community_rituals_v1.ndjson';

export async function loadCommunityRitualsByLocale(
  ui_locale: string,
): Promise<CommunityRitualV1[]> {
  const dir = getCommunityRitualsDir();
  const filePath = path.join(dir, SEED_FILENAME);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const all = lines.map((line) => JSON.parse(line) as CommunityRitualV1);
    const locale = (ui_locale || 'en').toLowerCase().split('-')[0];
    return all.filter((r) => (r.ui_locale || '').toLowerCase().split('-')[0] === locale);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : '';
    if (code === 'ENOENT') return [];
    throw err;
  }
}

/** Group by category (order: LEARN, CREATE, PERFORM, WELLBEING, SOCIAL, CHALLENGE). */
const CATEGORY_ORDER: IdeaRoutineCategory[] = [
  'LEARN',
  'CREATE',
  'PERFORM',
  'WELLBEING',
  'SOCIAL',
  'CHALLENGE',
];

export function groupByCategory(
  rituals: CommunityRitualV1[],
): Map<IdeaRoutineCategory, CommunityRitualV1[]> {
  const map = new Map<IdeaRoutineCategory, CommunityRitualV1[]>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }
  for (const r of rituals) {
    const cat = r.category as IdeaRoutineCategory;
    if (CATEGORY_ORDER.includes(cat)) {
      map.get(cat)!.push(r);
    }
  }
  return map;
}
