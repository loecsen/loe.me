import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { fileExists, getDataPath, readJson } from '../../../lib/storage/fsStore';

export const runtime = 'nodejs';

type IndexEntry = {
  ritualId?: string;
  intention?: string;
  pathTitle?: string;
  createdAt?: string;
  updatedAt?: string;
  lastViewedAt?: string;
  lastOpenedAt?: string;
  status?: string;
  createdBy?: string | null;
  hidden?: boolean;
};

type RitualFile = {
  status?: string;
  intention?: string;
  path?: { pathTitle?: string; imageUrl?: string };
  missionsById?: Record<string, { id: string; imageUrl?: string }>;
};

type RitualCardItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  lastViewedAt: string | null;
  status: string;
  createdBy?: string | null;
};

type CursorPayload = { time: number; id: string };

const parseDate = (value?: string | null) => {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

const pickLastViewed = (entry: IndexEntry) =>
  entry.lastViewedAt ?? entry.lastOpenedAt ?? entry.updatedAt ?? entry.createdAt ?? null;

const encodeCursor = (payload: CursorPayload) =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

const decodeCursor = (raw: string | null): CursorPayload | null => {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf-8');
    const payload = JSON.parse(decoded) as CursorPayload;
    if (!payload?.id || typeof payload.time !== 'number') return null;
    return payload;
  } catch {
    return null;
  }
};

const readIndex = async () => {
  const indexPath = getDataPath('index', 'rituals.ndjson');
  const exists = await fileExists(indexPath);
  if (!exists) return [];
  const raw = await fs.readFile(indexPath, 'utf-8');
  const lines = raw.split('\n').filter(Boolean);
  const map = new Map<string, IndexEntry>();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as IndexEntry;
      const ritualId = entry.ritualId;
      if (!ritualId) continue;
      const prev = map.get(ritualId) ?? {};
      map.set(ritualId, { ...prev, ...entry, ritualId });
    } catch {
      // ignore malformed lines
    }
  }
  return [...map.values()];
};

const readRitualImage = async (ritualId: string) => {
  const ritualPath = getDataPath('rituals', `ritual_${ritualId}.json`);
  const exists = await fileExists(ritualPath);
  if (!exists) return null;
  const ritual = await readJson<RitualFile>(ritualPath);
  if (ritual.path?.imageUrl) return ritual.path.imageUrl;
  const missionImage = Object.values(ritual.missionsById ?? {}).find((mission) => mission.imageUrl)
    ?.imageUrl;
  return missionImage ?? null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') ?? 'in_progress';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 3), 1), 24);
  const cursor = decodeCursor(searchParams.get('cursor'));
  const currentUser =
    searchParams.get('userId') ?? request.headers.get('x-user-id') ?? null;

  if (tab === 'community') {
    return NextResponse.json({ items: [], nextCursor: null, total: 0 });
  }

  const entries = (await readIndex()).filter((entry) => !entry.hidden);
  const filtered = entries.filter((entry) => {
    if (tab === 'mine') {
      // TODO: brancher l'utilisateur authentifié quand dispo.
      return currentUser ? entry.createdBy === currentUser : entry.createdBy == null;
    }
    return entry.status !== 'completed';
  });

  const sorted = filtered
    .map((entry) => ({
      ...entry,
      ritualId: entry.ritualId ?? '',
      sortTime: parseDate(pickLastViewed(entry)),
    }))
    .filter((entry) => entry.ritualId)
    .sort((a, b) => {
      if (b.sortTime !== a.sortTime) return b.sortTime - a.sortTime;
      return b.ritualId.localeCompare(a.ritualId);
    });

  const afterCursor = cursor
    ? sorted.filter((entry) => {
        if (entry.sortTime < cursor.time) return true;
        if (entry.sortTime > cursor.time) return false;
        return entry.ritualId.localeCompare(cursor.id) < 0;
      })
    : sorted;

  const page = afterCursor.slice(0, limit);
  const nextCursor = afterCursor.length > limit
    ? encodeCursor({ time: page[page.length - 1].sortTime, id: page[page.length - 1].ritualId })
    : null;

  const items: RitualCardItem[] = await Promise.all(
    page.map(async (entry) => {
      const ritualId = entry.ritualId ?? '';
      const title = entry.pathTitle ?? entry.intention ?? 'Rituel';
      const imageUrl = ritualId ? await readRitualImage(ritualId) : null;
      return {
        id: ritualId,
        title,
        imageUrl,
        lastViewedAt: pickLastViewed(entry),
        status: entry.status ?? 'ready',
        createdBy: entry.createdBy ?? null,
      };
    }),
  );

  return NextResponse.json({
    items,
    nextCursor,
    total: sorted.length,
  });
}
