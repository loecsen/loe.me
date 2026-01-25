import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type StyleRegistry = {
  defaultStyleId: string;
  styles: Array<{ id: string; version: number; prompt: string }>;
};

const registryPath = path.resolve(process.cwd(), 'app/lib/images/styleRegistry.json');

async function readRegistry(): Promise<StyleRegistry> {
  const raw = await fs.readFile(registryPath, 'utf-8');
  return JSON.parse(raw) as StyleRegistry;
}

async function writeRegistry(next: StyleRegistry): Promise<void> {
  const payload = `${JSON.stringify(next, null, 2)}\n`;
  await fs.writeFile(registryPath, payload, 'utf-8');
}

export async function GET() {
  try {
    const registry = await readRegistry();
    return NextResponse.json(registry);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'registry_read_failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { defaultStyleId?: string };
    const nextDefault = body?.defaultStyleId?.trim();
    if (!nextDefault) {
      return NextResponse.json({ error: 'missing_default_style' }, { status: 400 });
    }
    const registry = await readRegistry();
    const exists = registry.styles.some((style) => style.id === nextDefault);
    if (!exists) {
      return NextResponse.json({ error: 'unknown_style_id' }, { status: 400 });
    }
    if (registry.defaultStyleId === nextDefault) {
      return NextResponse.json({ ok: true, defaultStyleId: registry.defaultStyleId });
    }
    const nextRegistry = { ...registry, defaultStyleId: nextDefault };
    await writeRegistry(nextRegistry);
    return NextResponse.json({ ok: true, defaultStyleId: nextDefault });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'registry_write_failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
