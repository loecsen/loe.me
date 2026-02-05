import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { loadPublishedPack, loadDraftPack } from '../../../lib/lexicon/registry';
import type { LexiconPackV1 } from '../../../lib/lexicon/types';
import { sanitizePack } from '../../../lib/lexicon/validate';
import {
  LEXICON_BOOTSTRAP_SYSTEM,
  LEXICON_BOOTSTRAP_PROMPT_VERSION,
  buildLexiconBootstrapUser,
} from '../../../lib/lexicon/bootstrapPrompt';
import { getSiteLlmClientForTier } from '../../../lib/llm/router';

const BOOTSTRAP_TIMEOUT_MS = 15_000;

function getDraftPacksDir(): string {
  const cwd = process.cwd();
  const fromWeb = path.join(cwd, 'app', 'PourLaMaquette', 'lexicon-drafts');
  const fromRoot = path.join(cwd, 'apps', 'web', 'app', 'PourLaMaquette', 'lexicon-drafts');
  return fs.existsSync(fromWeb) ? fromWeb : fromRoot;
}

export async function POST(request: Request) {
  let body: { target_lang?: string; ui_locale?: string };
  try {
    body = (await request.json()) as { target_lang?: string; ui_locale?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const targetLang = typeof body.target_lang === 'string' ? body.target_lang.trim().toLowerCase().slice(0, 10) : '';
  if (!targetLang || !/^[a-z]{2}(-[a-z0-9]+)?$/i.test(targetLang.replace('-', ''))) {
    return NextResponse.json({ ok: false, error: 'target_lang required (BCP-47, e.g. ro, pt)' }, { status: 400 });
  }

  const langCode = targetLang.split('-')[0];

  const published = await loadPublishedPack(langCode);
  if (published) {
    return NextResponse.json({ ok: true, pack: published, source: 'published' as const });
  }

  const draft = await loadDraftPack(langCode);
  if (draft) {
    return NextResponse.json({ ok: true, pack: draft, source: 'draft' as const });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BOOTSTRAP_TIMEOUT_MS);

  try {
    const siteClient = await getSiteLlmClientForTier('default');
    const res = await siteClient.client.chat.completions.create({
      model: siteClient.model,
      messages: [
        { role: 'system', content: LEXICON_BOOTSTRAP_SYSTEM },
        { role: 'user', content: buildLexiconBootstrapUser(langCode) },
      ],
      max_tokens: 2048,
      temperature: 0.2,
    }, { signal: controller.signal });
    clearTimeout(timeoutId);
    const content = res.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ ok: false, error: 'Empty response' }, { status: 502 });
    }

    const stripped = content.replace(/^[\s\S]*?\{/, '{').replace(/\}[\s\S]*$/, '}');
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON from model' }, { status: 502 });
    }

    const result = sanitizePack(parsed);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    const pack: LexiconPackV1 = {
      ...result.pack,
      lang: langCode,
      version: 'lexicon-pack-v1',
      generated_at: new Date().toISOString(),
      generated_by: {
        provider: siteClient.provider,
        model: siteClient.model,
        prompt_version: LEXICON_BOOTSTRAP_PROMPT_VERSION,
      },
      confidence: Math.max(0, Math.min(1, result.pack.confidence ?? 0.6)),
      normalize: result.pack.normalize ?? { lower: true, strip_diacritics: true },
    };

    if (process.env.NODE_ENV !== 'production') {
      const draftDir = getDraftPacksDir();
      if (draftDir && fs.existsSync(path.dirname(draftDir))) {
        try {
          if (!fs.existsSync(draftDir)) {
            fs.mkdirSync(draftDir, { recursive: true });
          }
          const filePath = path.join(draftDir, `${langCode}.json`);
          fs.writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf8');
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[lexicon/bootstrap] Failed to write draft', e);
          }
        }
      }
    }
    return NextResponse.json({
      ok: true,
      pack,
      source: 'draft' as const,
      ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'default' as const }),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
      console.warn('[lexicon/bootstrap]', err.message);
    }
    return NextResponse.json({ ok: false, error: 'Generation failed' }, { status: 502 });
  }
}
