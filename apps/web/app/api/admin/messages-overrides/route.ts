/**
 * GET/POST overrides for i18n messages (FR). Dev-only.
 * Writes to data/i18n-overrides.json (gitignored).
 */

import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OVERRIDES_FILENAME = 'i18n-overrides.json';

function getOverridesPath(): string {
  const cwd = process.cwd();
  return path.join(cwd, 'data', OVERRIDES_FILENAME);
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ fr: {} });
  }
  try {
    const filePath = getOverridesPath();
    const raw = await readFile(filePath, 'utf8');
    const data = JSON.parse(raw) as { fr?: Record<string, string> };
    return NextResponse.json({ fr: data.fr ?? {} });
  } catch {
    return NextResponse.json({ fr: {} });
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { fr?: Record<string, string> };
    const fr = body.fr ?? {};
    const filePath = getOverridesPath();
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, JSON.stringify({ fr }, null, 2), 'utf8');
    return NextResponse.json({ ok: true, fr });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
