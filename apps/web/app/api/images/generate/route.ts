import { NextResponse } from 'next/server';
import path from 'node:path';
import { DEFAULT_IMAGE_STYLE_ID, getImageStyle } from '../../../lib/images/styles';
import { pickSceneDirection, type SceneDirection } from '../../../lib/images/sceneDirection';
import {
  appendNdjson,
  ensureDir,
  fileExists,
  sha256,
  writePngFromBase64,
  getDataPath,
} from '../../../lib/storage/fsStore';

export const runtime = 'nodejs';

const STABILITY_URL = 'https://api.stability.ai/v2beta/stable-image/generate/core';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const rateLimitMap = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.OPENAI_IMAGE_RATE_LIMIT_PER_MIN ?? 60);
const ASPECT_RATIO = '16x9';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);

const shouldTranslate = (value: string) =>
  /[^\x00-\x7F]/.test(value) ||
  /\b(le|la|les|des|en|pour|avec|apprendre|jours|débutant|grammaire|méditation|compétences|professionnelles)\b/i.test(
    value,
  );

const translateFields = async ({
  apiKey,
  model,
  title,
  summary,
  fallback,
}: {
  apiKey: string;
  model: string;
  title: string;
  summary: string;
  fallback: string;
}) => {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Translate text to concise English. Return ONLY valid JSON with keys: title, summary, fallback.',
        },
        {
          role: 'user',
          content: JSON.stringify({ title, summary, fallback }),
        },
      ],
    }),
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload?.choices?.[0]?.message?.content?.trim() ?? '';
  try {
    return JSON.parse(raw) as { title?: string; summary?: string; fallback?: string };
  } catch {
    return null;
  }
};

const getRateKey = (request: Request) => {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip');
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  return forwarded ?? realIp ?? userAgent;
};

const isRateLimited = (key: string) => {
  const now = Date.now();
  const list = rateLimitMap.get(key)?.filter((ts) => now - ts < WINDOW_MS) ?? [];
  list.push(now);
  rateLimitMap.set(key, list);
  return list.length > MAX_PER_WINDOW;
};

export async function POST(request: Request) {
  const { prompt, size, styleId, title, summary, promptOverride, userLang, sceneDirection } =
    (await request.json()) as {
      prompt?: string;
      size?: '340x190' | '512x512';
      seedKey?: string;
      styleId?: string;
      title?: string;
      summary?: string;
      promptOverride?: string;
      userLang?: string;
      sceneDirection?: SceneDirection;
    };

  const featureEnabled = (process.env.FEATURE_IMAGES_ENABLED ?? 'true').toLowerCase();
  if (featureEnabled === 'false' || featureEnabled === '0' || featureEnabled === 'off') {
    return NextResponse.json({ imageDataUrl: null, error: 'images_disabled' }, { status: 200 });
  }

  const subjectTitle = title?.trim() || '';
  const subjectSummary = summary?.trim() || '';
  const fallbackSubject = prompt?.trim() || '';
  const subject = subjectTitle || subjectSummary || fallbackSubject;
  if (!subject) {
    return NextResponse.json({ imageDataUrl: null, error: 'missing_prompt' }, { status: 200 });
  }

  const key = getRateKey(request);
  if (Number.isFinite(MAX_PER_WINDOW) && MAX_PER_WINDOW > 0 && isRateLimited(key)) {
    return NextResponse.json(
      { imageDataUrl: null, error: 'Please wait a minute and try again.' },
      { status: 429 },
    );
  }

  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { imageDataUrl: null, error: 'missing_api_key' },
      { status: 500 },
    );
  }

  const style = getImageStyle(styleId ?? DEFAULT_IMAGE_STYLE_ID);
  const styleText =
    typeof promptOverride === 'string' && promptOverride.trim().length > 0
      ? promptOverride.trim()
      : style.prompt;

  const getSceneDirection = (
    titleText: string,
    summaryText: string,
    override?: SceneDirection,
  ) => {
    if (override) {
      return override;
    }
    return pickSceneDirection(titleText, summaryText);
  };

  let promptTitle = subjectTitle;
  let promptSummary = subjectSummary;
  let promptFallback = fallbackSubject;
  const shouldTranslatePrompt = [subjectTitle, subjectSummary, fallbackSubject]
    .filter(Boolean)
    .some((value) => shouldTranslate(value ?? ''));
  if (shouldTranslatePrompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    if (apiKey) {
      const translated = await translateFields({
        apiKey,
        model,
        title: subjectTitle,
        summary: subjectSummary,
        fallback: fallbackSubject,
      });
      if (translated) {
        promptTitle = translated.title?.trim() || promptTitle;
        promptSummary = translated.summary?.trim() || promptSummary;
        promptFallback = translated.fallback?.trim() || promptFallback;
      }
    }
  }

  const subjectBlockParts = [];
  if (promptTitle) subjectBlockParts.push(`Title: ${promptTitle}.`);
  if (promptSummary) subjectBlockParts.push(`Summary: ${promptSummary}.`);
  if (!promptTitle && !promptSummary && promptFallback) {
    subjectBlockParts.push(`Subject: ${promptFallback}.`);
  }
  const subjectBlock = subjectBlockParts.join(' ');
  const subjectKeywords = [promptTitle, promptSummary, promptFallback]
    .filter(Boolean)
    .join(' | ');

  const styleLock = [styleText].filter(Boolean).join(' ');

  const resolvedScene = getSceneDirection(subjectTitle, subjectSummary, sceneDirection);
  const hashSource = [
    style.id,
    String(style.version),
    resolvedScene,
    subjectTitle || fallbackSubject,
    subjectSummary,
    ASPECT_RATIO,
  ].join('|');
  const imageHash = sha256(hashSource);
  const subjectSlug = slugify(subjectTitle || subjectSummary || fallbackSubject || 'subject');
  const imageFileName = `img_${imageHash}__style-${style.id}_v${style.version}__scene-${resolvedScene}__subj-${subjectSlug || 'subject'}__${ASPECT_RATIO}.png`;
  const imageFilePath = getDataPath('images', imageFileName);
  if (await fileExists(imageFilePath)) {
    return NextResponse.json({
      imageHash,
      imageUrl: `/api/images/file?hash=${imageHash}`,
      imageDataUrl: null,
    });
  }
  const tennisCues =
    /\b(tennis|raquette|racket|court|balle|ball)\b/i.test(subject) ||
    /\b(tennis|raquette|racket|court|balle|ball)\b/i.test(subjectBlock)
      ? 'Include tennis court, racket, and ball.'
      : '';

  const sceneLine = (() => {
    switch (resolvedScene) {
      case 'human_action':
        return [
          'SCENE: one person performing the activity, wide shot, full-body, dynamic pose, mid-action.',
          'Visible equipment and setting cues; the activity must be unmistakable.',
          tennisCues,
          subjectBlock || `Subject: ${subject}.`,
        ]
          .filter(Boolean)
          .join(' ');
      case 'abstract_symbolic':
        return [
          'SCENE: symbolic, abstract depiction of the subject using shapes, paths, waves, and visual metaphors.',
          subjectBlock || `Subject: ${subject}.`,
        ]
          .filter(Boolean)
          .join(' ');
      case 'object_scene':
      default:
        return [
          'SCENE: objects and environment only, no people. Focus on tools, setting, and implied motion.',
          tennisCues,
          subjectBlock || `Subject: ${subject}.`,
        ]
          .filter(Boolean)
          .join(' ');
    }
  })();

  const constraintsLine = (() => {
    switch (resolvedScene) {
      case 'human_action':
        return 'CONSTRAINTS: max one human. No group, no crowd, no portrait, no close-up, no headshot, no face-centered framing. Wide shot, full-body, action-focused.';
      case 'abstract_symbolic':
        return 'CONSTRAINTS: no humans. Abstract symbolic elements only.';
      case 'object_scene':
      default:
        return 'CONSTRAINTS: NO PEOPLE. Objects/environment only.';
    }
  })();

  const finalPrompt = [
    styleLock,
    sceneLine,
    constraintsLine,
    subjectKeywords ? `SUBJECT KEYWORDS: ${subjectKeywords}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const negativePrompt =
    'low quality, blurry, photorealistic, group, crowd, multiple people, friends, girls, portrait, lineup, selfie, looking at camera, headshot, close-up, beauty portrait';
  if (process.env.NODE_ENV !== 'production') {
    console.log('[images.generate] request', {
      styleId: styleId ?? DEFAULT_IMAGE_STYLE_ID,
      title: subjectTitle || undefined,
      summary: subjectSummary || undefined,
      hasOverride: Boolean(promptOverride && promptOverride.trim().length > 0),
      userLang,
      sceneDirection: resolvedScene,
    });
    console.log('[images.generate] prompt', finalPrompt);
    console.log('[images.generate] negative_prompt', negativePrompt);
  }
  const timeoutMs = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? 200000);
  const controller = new AbortController();
  const timeoutId = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  let response: Response;
  try {
      const formData = new FormData();
      formData.append('prompt', finalPrompt);
      formData.append('negative_prompt', negativePrompt);
      formData.append('aspect_ratio', '16:9');
      formData.append('output_format', 'png');
    if (process.env.NODE_ENV !== 'production') {
      const payloadLog = JSON.stringify(
        {
          prompt: finalPrompt,
          negative_prompt: negativePrompt,
          aspect_ratio: '16:9',
          output_format: 'png',
        },
        null,
        2,
      );
      console.log('[images.generate] stability_url', STABILITY_URL);
      console.log('[images.generate] sending_prompt_head', finalPrompt.slice(0, 300));
      console.log('[images.generate] sending_prompt_tail', finalPrompt.slice(-300));
      console.log('[images.generate] payload', payloadLog.slice(0, 1000));
    }
    response = await fetch(STABILITY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    return NextResponse.json(
      {
        imageDataUrl: null,
        error: 'image_failed',
        details:
          process.env.NODE_ENV === 'production'
            ? undefined
            : error instanceof Error
              ? error.message
              : String(error),
      },
      { status: 200 },
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[images.generate] failed', response.status, errorText.slice(0, 300));
    return NextResponse.json(
      { imageDataUrl: null, error: `stability_${response.status}` },
      { status: 200 },
    );
  }

  try {
    const payload = (await response.json()) as { image?: string | null };
    if (payload?.image) {
      const dataUrl = `data:image/png;base64,${payload.image}`;
      await ensureDir(path.dirname(imageFilePath));
      await writePngFromBase64(dataUrl, imageFilePath);
      await appendNdjson(getDataPath('index', 'images.ndjson'), {
        imageHash,
        fileName: imageFileName,
        styleId: style.id,
        styleVersion: style.version,
        sceneDirection: resolvedScene,
        title: subjectTitle || undefined,
        summary: subjectSummary || undefined,
        aspectRatio: ASPECT_RATIO,
        createdAt: new Date().toISOString(),
      });
      return NextResponse.json({
        imageHash,
        imageUrl: `/api/images/file?hash=${imageHash}`,
        imageDataUrl: dataUrl,
      });
    }
    return NextResponse.json({ imageDataUrl: null, error: 'invalid_image' }, { status: 200 });
  } catch {
    return NextResponse.json({ imageDataUrl: null, error: 'invalid_image' }, { status: 200 });
  }
}

// Self-test (no real keys):
// curl -X POST "https://api.stability.ai/v2beta/stable-image/generate/core" \
//   -H "Authorization: Bearer YOUR_STABILITY_KEY" \
//   -H "Accept: application/json" \
//   -F "prompt=Example mission about learning chords" \
//   -F "negative_prompt=low quality, blurry, photorealistic" \
//   -F "aspect_ratio=16:9" \
//   -F "output_format=png"

