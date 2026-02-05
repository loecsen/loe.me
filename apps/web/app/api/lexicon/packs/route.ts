import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';

function getPacksDir(): string {
  const cwd = process.cwd();
  const fromWeb = path.join(cwd, 'app', 'lib', 'lexicon', 'packs');
  const fromRoot = path.join(cwd, 'apps', 'web', 'app', 'lib', 'lexicon', 'packs');
  return fs.existsSync(fromWeb) ? fromWeb : fromRoot;
}

function getDraftPacksDir(): string {
  const cwd = process.cwd();
  const fromWeb = path.join(cwd, 'app', 'PourLaMaquette', 'lexicon-drafts');
  const fromRoot = path.join(cwd, 'apps', 'web', 'app', 'PourLaMaquette', 'lexicon-drafts');
  return fs.existsSync(fromWeb) ? fromWeb : fromRoot;
}

function listJsonLangs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

export async function GET() {
  const published = listJsonLangs(getPacksDir());
  const drafts = process.env.NODE_ENV === 'production' ? [] : listJsonLangs(getDraftPacksDir());
  return NextResponse.json({ published, drafts });
}
