import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDir, fileExists, getDataPath, readJson, writeJsonAtomic } from '../storage/fsStore';

export type RitualStatus = 'pending' | 'ready' | 'error';

export type RitualStatusRecord = {
  status: RitualStatus;
  updatedAt: string;
  lastError?: string;
};

const inMemoryLocks = new Set<string>();

const buildRitualDir = () => getDataPath('rituals');

export const getRitualPath = (ritualId: string) =>
  getDataPath('rituals', `ritual_${ritualId}.json`);

export const getStatusPath = (ritualId: string) =>
  getDataPath('rituals', `ritual_${ritualId}.status.json`);

export const getLockPath = (ritualId: string) =>
  getDataPath('rituals', `ritual_${ritualId}.lock`);

export async function readRitualStatus(ritualId: string): Promise<RitualStatusRecord | null> {
  const statusPath = getStatusPath(ritualId);
  if (!(await fileExists(statusPath))) {
    return null;
  }
  try {
    return await readJson<RitualStatusRecord>(statusPath);
  } catch {
    return null;
  }
}

export async function writeRitualStatus(
  ritualId: string,
  status: RitualStatus,
  lastError?: string,
): Promise<void> {
  const payload: RitualStatusRecord = {
    status,
    updatedAt: new Date().toISOString(),
    ...(lastError ? { lastError } : {}),
  };
  await writeJsonAtomic(getStatusPath(ritualId), payload);
}

export async function acquireRitualLock(ritualId: string): Promise<boolean> {
  const lockPath = getLockPath(ritualId);
  try {
    await ensureDir(buildRitualDir());
    const handle = await fs.open(lockPath, 'wx');
    await handle.writeFile(`${Date.now()}`);
    await handle.close();
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'EEXIST') {
      return false;
    }
    if (inMemoryLocks.has(ritualId)) {
      return false;
    }
    inMemoryLocks.add(ritualId);
    return true;
  }
}

export async function releaseRitualLock(ritualId: string): Promise<void> {
  const lockPath = getLockPath(ritualId);
  inMemoryLocks.delete(ritualId);
  try {
    await fs.rm(lockPath, { force: true });
  } catch {
    // ignore
  }
}
