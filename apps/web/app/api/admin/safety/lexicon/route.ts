import { NextResponse } from 'next/server';
import { getDataPath, readJson, writeJson } from '../../../../lib/storage/fsStore';
import { validateLexicon, type Lexicon } from '@loe/core';
import { clearLexiconGuardCache } from '../../../../lib/safety/getLexiconGuard';

export const runtime = 'nodejs';

const LEXICON_PATH = getDataPath('safety', 'lexicon.v1.json');

function hasAccess(request: Request) {
  const { searchParams } = new URL(request.url);
  const isDev = process.env.NODE_ENV === 'development';
  const adminKey = process.env.ADMIN_TOKEN;
  const key = searchParams.get('key') ?? '';
  return isDev || (adminKey && key === adminKey);
}

export async function GET(request: Request) {
  if (!hasAccess(request)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const lexicon = await readJson<Lexicon>(LEXICON_PATH);
  const validation = validateLexicon(lexicon);
  return NextResponse.json({ lexicon, validation });
}

export async function POST(request: Request) {
  if (!hasAccess(request)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') ?? 'validate';
  const lexicon = (await request.json()) as Lexicon;
  const validation = validateLexicon(lexicon);
  if (!validation.ok) {
    return NextResponse.json({ error: 'invalid_lexicon', validation }, { status: 400 });
  }
  if (action === 'save') {
    await writeJson(LEXICON_PATH, lexicon);
    clearLexiconGuardCache();
  }
  return NextResponse.json({ lexicon, validation });
}
