/**
 * Generic NDJSON table + JSON index manager. Atomic writes (write temp -> rename).
 * In-process mutex per table so overlapping route handlers don't corrupt writes.
 * Dev-only; all files under PourLaMaquette/db.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDbTablesPath, getDbIndexesPath } from './paths';

const tableLocks = new Map<string, Promise<void>>();

/** Serialize writes per table (table + index name). */
export async function withTableLock<T>(tableOrIndexName: string, fn: () => Promise<T>): Promise<T> {
  const prev = tableLocks.get(tableOrIndexName) ?? Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((r) => {
    release = r;
  });
  tableLocks.set(tableOrIndexName, next);
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readNdjson<T = Record<string, unknown>>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => JSON.parse(line) as T);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : '';
    if (code === 'ENOENT') return [];
    throw err;
  }
}

export async function writeNdjsonAtomic(filePath: string, rows: Record<string, unknown>[]): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const payload = rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, payload, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const payload = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, payload, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function tablePath(tableName: string): string {
  return path.join(getDbTablesPath(), `${tableName}.ndjson`);
}

export function indexPath(indexName: string): string {
  return path.join(getDbIndexesPath(), `${indexName}.index.json`);
}
