import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export function getDataRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, '..', '..', '..', 'data');
}

export function getDataPath(...segments: string[]): string {
  return path.join(getDataRoot(), ...segments);
}

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, payload, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeJsonAtomic(filePath, data);
}

export async function appendNdjson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const payload = `${JSON.stringify(data)}\n`;
  await fs.appendFile(filePath, payload, 'utf-8');
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function writePngFromBase64(dataUrl: string, filePath: string): Promise<void> {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] ?? '' : dataUrl;
  if (!base64) {
    throw new Error('invalid_base64');
  }
  const buffer = Buffer.from(base64, 'base64');
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, new Uint8Array(buffer));
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}
