import { NextResponse } from 'next/server';
import { getLocaleFromAcceptLanguage, normalizeLocale } from '../../../lib/i18n';
import type { LearningPathBlueprintV2, MissionBlueprintV2, PassCriteria } from '@loe/core';

export const runtime = 'nodejs';

type RawBlock =
  | { type: 'text'; text: string }
  | { type: 'checklist'; items: string[] }
  | { type: 'quiz'; question: string; choices: string[]; correctIndex?: number };

type MissionStub = Omit<MissionBlueprintV2, 'blocks'> & {
  blocks?: MissionBlueprintV2['blocks'];
  durationMin?: number;
  type?: string;
};

type Payload = {
  goal?: string;
  path?: LearningPathBlueprintV2;
  missionStub?: MissionStub;
  previousMissionSummary?: string;
  locale?: string;
};

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const safeText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const normalizeBlocks = (blocks: RawBlock[] | undefined): RawBlock[] => {
  if (!blocks || blocks.length === 0) {
    return [{ type: 'text', text: 'Prends un instant pour te recentrer.' }];
  }
  const filtered = blocks
    .map((block) => {
      if (block.type === 'text' && block.text) {
        return { type: 'text', text: safeText(block.text, 'Contenu en préparation.') };
      }
      if (block.type === 'checklist' && Array.isArray(block.items)) {
        const items = block.items.filter((item) => typeof item === 'string' && item.trim());
        if (items.length > 0) {
          return { type: 'checklist', items };
        }
      }
      if (block.type === 'quiz' && Array.isArray(block.choices)) {
        const choices = block.choices.filter((choice) => typeof choice === 'string' && choice.trim());
        if (choices.length >= 2) {
          const correctIndex =
            typeof block.correctIndex === 'number' &&
            block.correctIndex >= 0 &&
            block.correctIndex < choices.length
              ? block.correctIndex
              : undefined;
          return {
            type: 'quiz',
            question: safeText(block.question, 'Question rapide'),
            choices,
            correctIndex,
          };
        }
      }
      return null;
    })
    .filter((block): block is RawBlock => Boolean(block));

  return filtered.length > 0 ? filtered.slice(0, 4) : [{ type: 'text', text: 'Contenu en préparation.' }];
};

const normalizePassCriteria = (value: unknown): PassCriteria =>
  value === 'score' || value === 'mixed' ? value : 'completion';

function buildSystemPrompt(languageName: string) {
  return `You create the content blocks for a single learning mission.

Output language: ${languageName}.

Return strict JSON only with this shape:
{
  "blocks": [
    { "type": "text", "text": "..." },
    { "type": "checklist", "items": ["...", "..."] },
    { "type": "quiz", "question": "...", "choices": ["...", "..."], "correctIndex": 0 }
  ]
}

Constraints:
- 2 to 4 blocks max.
- Calm, clear, premium tone.
- No technical jargon, no mention of AI.
- Keep blocks concrete and short.
- If you use a quiz, provide at least 2 choices.
`;
}

function buildUserPrompt(goal: string, path: LearningPathBlueprintV2 | undefined, mission: MissionStub, prev?: string) {
  return `Goal: "${goal}".
Path: "${path?.title ?? 'Learning path'}".
Mission title: "${mission.title}".
Mission summary: "${mission.summary ?? 'N/A'}".
Pass criteria: "${mission.passCriteria}".
Previous mission summary: "${prev ?? 'N/A'}".
`;
}

export async function POST(request: Request) {
  const { goal, path, missionStub, previousMissionSummary, locale } = (await request.json()) as Payload;
  const safeGoal = safeText(goal, 'Progresser avec constance');
  const headerLocale = getLocaleFromAcceptLanguage(request.headers.get('accept-language'));
  const resolvedLocale = normalizeLocale(locale ?? headerLocale);
  console.log('[missions.generate-one] incoming', {
    intention: safeGoal,
    days: undefined,
    locale: resolvedLocale,
  });
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[missions.generate-one] deprecated: use /api/missions/next');
    return NextResponse.json({ error: 'deprecated' }, { status: 410 });
  }
  if (!missionStub) {
    return NextResponse.json({ error: 'missing_mission' }, { status: 400 });
  }

  const rawLocale = locale ?? request.headers.get('accept-language') ?? resolvedLocale;
  const languageTag = rawLocale.split(',')[0]?.trim().split('-')[0] || resolvedLocale;
  const languageName = (() => {
    try {
      const display = new Intl.DisplayNames(['en'], { type: 'language' });
      const name = display.of(languageTag);
      return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'English';
    } catch {
      return 'English';
    }
  })();

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  if (!apiKey) {
    return NextResponse.json({ error: 'missing_api_key' }, { status: 500 });
  }

  const systemPrompt = buildSystemPrompt(languageName);
  const userPrompt = buildUserPrompt(safeGoal, path, missionStub, previousMissionSummary);

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }

  const payload = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? '{}';
  let blocks: RawBlock[] = [];
  try {
    const parsed = JSON.parse(content) as { blocks?: RawBlock[] };
    blocks = normalizeBlocks(parsed.blocks);
  } catch {
    blocks = normalizeBlocks([]);
  }

  const mission: MissionBlueprintV2 = {
    id: missionStub.id,
    title: missionStub.title,
    summary: missionStub.summary,
    passCriteria: normalizePassCriteria(missionStub.passCriteria),
    minScore: missionStub.minScore,
    blocks,
  };

  return NextResponse.json({
    data: { mission: { ...mission, generatedAt: new Date().toISOString(), contentStatus: 'ready' } },
  });
}
