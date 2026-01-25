import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const dataRoot = path.join(process.cwd(), 'data');
const ritualsDir = path.join(dataRoot, 'rituals');
const imagesDir = path.join(dataRoot, 'images');

const listFiles = async (dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
};

const readJson = async (filePath: string) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
};

const extractHashes = (value: unknown, hashes: Set<string>) => {
  if (typeof value === 'string') {
    const match = value.match(/hash=([a-f0-9]{64})/i);
    if (match?.[1]) {
      hashes.add(match[1]);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => extractHashes(entry, hashes));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'imageHash' && typeof entry === 'string') {
        hashes.add(entry);
      } else {
        extractHashes(entry, hashes);
      }
    }
  }
};

const shouldDeleteByAge = async (filePath: string, jsonCreatedAt: unknown, cutoff: number) => {
  if (!cutoff) {
    return false;
  }
  if (typeof jsonCreatedAt === 'string') {
    const createdAt = Date.parse(jsonCreatedAt);
    return Number.isFinite(createdAt) && createdAt < cutoff;
  }
  const stats = await fs.stat(filePath);
  return stats.mtimeMs < cutoff;
};

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'not_available' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = ['1', 'true', 'yes'].includes(
    String(searchParams.get('dryRun') ?? '').toLowerCase(),
  );
  const ttlDays = Number(process.env.DATA_TTL_DAYS ?? 14);
  const ttlMs = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays * 24 * 60 * 60 * 1000 : 0;
  const cutoff = ttlMs ? Date.now() - ttlMs : 0;

  const logs: string[] = [];
  logs.push(`[purge-data] Using TTL days: ${ttlDays}`);
  if (dryRun) {
    logs.push('[purge-data] DRY RUN (no deletions)');
  }

  const ritualFiles = (await listFiles(ritualsDir)).filter((file) =>
    path.basename(file).startsWith('ritual_'),
  );
  const remainingRituals: Record<string, unknown>[] = [];
  let removedRituals = 0;

  for (const filePath of ritualFiles) {
    try {
      const json = await readJson(filePath);
      const createdAt = (json?.updatedAt as string | undefined) ?? (json?.createdAt as string | undefined);
      const shouldDelete = await shouldDeleteByAge(filePath, createdAt, cutoff);
      if (shouldDelete) {
        if (!dryRun) {
          await fs.unlink(filePath);
        }
        removedRituals += 1;
      } else {
        remainingRituals.push(json);
      }
    } catch (error) {
      logs.push(`[purge-data] Skipped corrupt ritual: ${path.basename(filePath)}`);
    }
  }

  const referencedHashes = new Set<string>();
  remainingRituals.forEach((ritual) => extractHashes(ritual, referencedHashes));

  const imageFiles = (await listFiles(imagesDir)).filter((file) => file.endsWith('.png'));
  let removedImages = 0;
  for (const filePath of imageFiles) {
    const fileName = path.basename(filePath);
    const match = fileName.match(/^img_([a-f0-9]{64})__/i);
    const hash = match?.[1];
    const stats = await fs.stat(filePath);
    const isExpired = ttlMs ? stats.mtimeMs < cutoff : false;
    const hasReferences = hash ? referencedHashes.has(hash) : true;
    if (isExpired || (!hasReferences && referencedHashes.size > 0)) {
      if (!dryRun) {
        await fs.unlink(filePath);
      }
      removedImages += 1;
    }
  }

  logs.push(`[purge-data] Removed rituals: ${removedRituals}`);
  logs.push(`[purge-data] Removed images: ${removedImages}`);
  logs.push('[purge-data] Done');

  return NextResponse.json({
    ok: true,
    dryRun,
    ttlDays,
    removedRituals,
    removedImages,
    logs,
  });
}
