/**
 * Dev-only: current SITE default LLM config from router (dev_settings or env). 403 in prod.
 */

import { NextResponse } from 'next/server';
import { getSiteLlmConfig } from '../../../../lib/llm/router';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const config = await getSiteLlmConfig();
  return NextResponse.json({
    provider: config.provider,
    model: config.model,
    base_url: config.baseUrl,
    source: config.source,
  });
}
