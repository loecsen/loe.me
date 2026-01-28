import { NextResponse } from 'next/server';
import { getDataPath, readJson } from '../../../../lib/storage/fsStore';
import { findLexiconMatch, type Lexicon } from '@loe/core';

export const runtime = 'nodejs';

const LEXICON_PATH = getDataPath('safety', 'lexicon.v1.json');

function hasAccess(request: Request) {
  const { searchParams } = new URL(request.url);
  const isDev = process.env.NODE_ENV === 'development';
  const adminKey = process.env.ADMIN_TOKEN;
  const key = searchParams.get('key') ?? '';
  return isDev || (adminKey && key === adminKey);
}

export async function POST(request: Request) {
  if (!hasAccess(request)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const body = (await request.json()) as { text?: string; locale?: string };
  const lexicon = await readJson<Lexicon>(LEXICON_PATH);
  const match = body.text ? findLexiconMatch(lexicon, body.text, body.locale) : null;
  return NextResponse.json({ match });
}
