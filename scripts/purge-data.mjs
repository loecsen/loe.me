import { promises as fs } from 'node:fs';
import path from 'node:path';

const resolveRepoRoot = () => process.cwd();
const dataRoot = path.join(resolveRepoRoot(), 'apps', 'web', 'data');
const ritualsDir = path.join(dataRoot, 'rituals');
const imagesDir = path.join(dataRoot, 'images');
const indexDir = path.join(dataRoot, 'index');

const ttlDays = Number(process.env.DATA_TTL_DAYS ?? 14);
const ttlMs = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays * 24 * 60 * 60 * 1000 : 0;
const cutoff = Date.now() - ttlMs;
const dryRun = ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN ?? '').toLowerCase());

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
};

const listFiles = async (dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
};

const extractHashes = (value, hashes) => {
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

const shouldDeleteByAge = async (filePath, jsonCreatedAt) => {
  if (!ttlMs) {
    return false;
  }
  if (jsonCreatedAt) {
    const createdAt = Date.parse(jsonCreatedAt);
    return Number.isFinite(createdAt) && createdAt < cutoff;
  }
  const stats = await fs.stat(filePath);
  return stats.mtimeMs < cutoff;
};

const purge = async () => {
  console.log(`[purge-data] Using TTL days: ${ttlDays}`);
  if (dryRun) {
    console.log('[purge-data] DRY RUN (no deletions)');
  }
  const ritualFiles = (await listFiles(ritualsDir)).filter((file) =>
    path.basename(file).startsWith('ritual_'),
  );
  const remainingRituals = [];
  let removedRituals = 0;

  for (const filePath of ritualFiles) {
    try {
      const json = await readJson(filePath);
      const createdAt = json?.updatedAt ?? json?.createdAt;
      const shouldDelete = await shouldDeleteByAge(filePath, createdAt);
      if (shouldDelete) {
        if (!dryRun) {
          await fs.unlink(filePath);
        }
        removedRituals += 1;
      } else {
        remainingRituals.push(json);
      }
    } catch {
      // ignore corrupt files
    }
  }

  const referencedHashes = new Set();
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

  console.log(`[purge-data] Removed rituals: ${removedRituals}`);
  console.log(`[purge-data] Removed images: ${removedImages}`);
  console.log(`[purge-data] Done`);
};

try {
  await fs.mkdir(indexDir, { recursive: true });
  await purge();
} catch (error) {
  console.error('[purge-data] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
