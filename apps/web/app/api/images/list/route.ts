import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { getDataPath } from '../../../lib/storage/fsStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Extrait le hash du nom de fichier img_<hash>__*.png */
const HASH_REGEX = /^img_([a-f0-9]+)__/;

/**
 * Liste les URLs des images disponibles dans data/images/ (pour Mock UI : cartes avec vraies images).
 */
export async function GET() {
  const imagesDir = getDataPath('images');
  let files: string[];
  try {
    files = await fs.readdir(imagesDir);
  } catch {
    return NextResponse.json({ urls: [] });
  }
  const hashes: string[] = [];
  for (const name of files) {
    if (!name.endsWith('.png')) continue;
    const m = name.match(HASH_REGEX);
    if (m?.[1]) hashes.push(m[1]);
  }
  const urls = hashes.map((h) => `/api/images/file?hash=${h}`);
  return NextResponse.json({ urls });
}
