/**
 * Dev-only LLM settings (provider, model, base_url). No API key. 403 in prod.
 */

import { NextResponse } from 'next/server';
import { readDevLlmSettings, writeDevLlmSettings } from '../../../lib/db/llmSettings.file';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const settings = await readDevLlmSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  let body: {
    provider?: string;
    model?: string;
    base_url?: string;
    pricing?: unknown;
    routing?: { default?: unknown; reasoning?: unknown };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const provider =
    body.provider === 'qwen' ? 'qwen' : body.provider === 'openai' ? 'openai' : undefined;
  let pricing: Record<string, { input_per_1k: number; output_per_1k: number }> | null | undefined = undefined;
  if (body.pricing !== undefined) {
    if (body.pricing === null) {
      pricing = null;
    } else if (typeof body.pricing === 'string') {
      try {
        pricing = JSON.parse(body.pricing) as Record<string, { input_per_1k: number; output_per_1k: number }>;
      } catch {
        return NextResponse.json({ error: 'Invalid pricing JSON' }, { status: 400 });
      }
    } else if (typeof body.pricing === 'object') {
      pricing = body.pricing as Record<string, { input_per_1k: number; output_per_1k: number }>;
    } else {
      return NextResponse.json({ error: 'Invalid pricing value' }, { status: 400 });
    }
  }
  const settings = await writeDevLlmSettings({
    ...(provider != null && { provider }),
    ...(typeof body.model === 'string' && { model: body.model.trim() || undefined }),
    ...(typeof body.base_url === 'string' && { base_url: body.base_url.trim() || undefined }),
    ...(pricing !== undefined && { pricing }),
    ...(body.routing !== undefined && { routing: body.routing }),
  });
  return NextResponse.json(settings);
}
