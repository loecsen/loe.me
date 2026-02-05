import type { MissionFull, MissionStub } from '@loe/core';
import { getLocaleFromAcceptLanguage, normalizeLocale } from '../i18n';
import type { DomainPlaybook } from '../domains/registry';
import { buildMissionFullPrompt, MISSION_FULL_PROMPT_VERSION } from '../prompts/missionFullPrompt';
import { sha256 } from '../storage/fsStore';
import { getSiteLlmClientForTier } from '../llm/router';

type RawBlock =
  | { type: 'text'; text: string }
  | { type: 'checklist'; items: string[] }
  | { type: 'quiz'; question: string; choices: string[]; correctIndex?: number };

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

type GenerationContext = {
  playbook: DomainPlaybook;
  validationMode: 'automatic' | 'self_report' | 'presence';
  ritualMode: 'progression' | 'practice' | 'maintenance';
  days: number;
  domainId?: string;
};

type GenerateBlocksInput = {
  request: Request;
  goal: string;
  pathTitle: string;
  mission: MissionStub;
  previousMissionSummary?: string;
  locale?: string;
  maxTokens?: number;
  context: GenerationContext;
};

export async function generateMissionBlocks({
  request,
  goal,
  pathTitle,
  mission,
  previousMissionSummary,
  locale,
  maxTokens,
  context,
}: GenerateBlocksInput): Promise<{
  blocks: RawBlock[];
  languageName: string;
  meta: { promptHash: string; promptVersion: string; latencyMs: number };
}> {
  const headerLocale = getLocaleFromAcceptLanguage(request.headers.get('accept-language'));
  const resolvedLocale = normalizeLocale(locale ?? headerLocale);
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

  const siteClient = await getSiteLlmClientForTier('reasoning');

  const { system, user } = buildMissionFullPrompt({
    userGoal: goal,
    days: context.days,
    userLang: languageName,
    playbook: context.playbook,
    mission,
    validationMode: context.validationMode,
    ritualMode: context.ritualMode,
    domainId: context.domainId,
  });
  const systemPrompt = system;
  const userPrompt = `${user}\nPrevious mission summary: "${previousMissionSummary ?? 'N/A'}".`;
  const promptHash = sha256(`${systemPrompt}\n\n${userPrompt}`);

  const startedAt = Date.now();
  const response = await siteClient.client.chat.completions.create({
    model: siteClient.model,
    temperature: 0.5,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  const latencyMs = Date.now() - startedAt;
  const content = response.choices?.[0]?.message?.content ?? '{}';
  try {
    const parsed = JSON.parse(content) as { blocks?: RawBlock[] };
    return {
      blocks: normalizeBlocks(parsed.blocks),
      languageName,
      meta: { promptHash, promptVersion: MISSION_FULL_PROMPT_VERSION, latencyMs },
    };
  } catch {
    return {
      blocks: normalizeBlocks([]),
      languageName,
      meta: { promptHash, promptVersion: MISSION_FULL_PROMPT_VERSION, latencyMs },
    };
  }
}

export function buildMissionFull(stub: MissionStub, blocks: RawBlock[]): MissionFull {
  return { ...stub, blocks };
}
