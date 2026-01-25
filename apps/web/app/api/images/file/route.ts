import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDataPath } from '../../../lib/storage/fsStore';

const findImageByHash = async (hash: string): Promise<string | null> => {
  const imagesDir = getDataPath('images');
  try {
    const files = await fs.readdir(imagesDir);
    const match = files.find((name) => name.startsWith(`img_${hash}__`) && name.endsWith('.png'));
    return match ? path.join(imagesDir, match) : null;
  } catch {
    return null;
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash')?.trim();
  if (!hash) {
    return NextResponse.json({ error: 'missing_hash' }, { status: 400 });
  }
  const filePath = await findImageByHash(hash);
  if (!filePath) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    const buffer = await fs.readFile(filePath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
