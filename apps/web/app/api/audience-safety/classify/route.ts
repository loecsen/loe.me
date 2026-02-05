/**
 * Audience safety classifier. Hard checks + heuristics first; LLM only when uncertain.
 * Output: { level, reason_code, confidence, notes_short }. Recorded via recordPromptUse.
 */

import { NextResponse } from 'next/server';
import { assessAudienceSafetyDeterministic } from '../../../lib/actionability/audienceSafety';
import type { AudienceSafetyResult, AudienceSafetyLevel } from '../../../lib/actionability/audienceSafety';
import { loadPublishedPrompt } from '../../../lib/prompts/store';
import { buildUserMessage } from '../../../lib/decisionEngine/judges/runJudge';
import { recordPromptUse } from '../../../lib/db/recordPromptUse';
import { getSiteLlmClientForTier } from '../../../lib/llm/router';

const TIMEOUT_MS = 6_000;
const MAX_TOKENS = 350;

const VALID_LEVELS: AudienceSafetyLevel[] = ['all_ages', 'adult_only', 'blocked'];

function parseClassifyResponse(content: string): AudienceSafetyResult | null {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const level = parsed.level;
    if (typeof level !== 'string' || !VALID_LEVELS.includes(level as AudienceSafetyLevel)) return null;
    const reason_code = typeof parsed.reason_code === 'string' ? parsed.reason_code : 'unknown';
    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence) ? parsed.confidence : 0.5;
    const notes_short = typeof parsed.notes_short === 'string' ? parsed.notes_short : undefined;
    return {
      level: level as AudienceSafetyLevel,
      reason_code: reason_code as AudienceSafetyResult['reason_code'],
      confidence,
      notes_short,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { intent?: string; intent_lang?: string; ui_locale?: string };
    const intent = typeof body.intent === 'string' ? body.intent.trim() : '';
    const intent_lang = typeof body.intent_lang === 'string' ? body.intent_lang : 'en';
    const ui_locale = typeof body.ui_locale === 'string' ? body.ui_locale : 'en';

    if (!intent) {
      return NextResponse.json(
        { level: 'all_ages', reason_code: 'unknown', confidence: 0.5, notes_short: 'Missing intent.' },
        { status: 400 },
      );
    }

    const deterministic = assessAudienceSafetyDeterministic(intent);
    if (deterministic) {
      return NextResponse.json(deterministic);
    }

    const promptEntry = loadPublishedPrompt('audience_safety_classifier_v1');
    if (!promptEntry?.user_template) {
      return NextResponse.json({
        level: 'all_ages',
        reason_code: 'unknown',
        confidence: 0.5,
        notes_short: 'Prompt unavailable; default all_ages.',
      });
    }

    await recordPromptUse({
      prompt_name: 'audience_safety_classifier_v1',
      version: '1.0.0',
      purpose_en: promptEntry.purpose_en,
      where_used: ['app/api/audience-safety/classify/route.ts'],
      prompt_text: (promptEntry.system ?? '') + '\n' + promptEntry.user_template,
      input_schema: promptEntry.input_schema,
      output_schema: promptEntry.output_schema,
      token_budget_target: promptEntry.token_budget_target ?? 280,
      safety_notes_en: promptEntry.safety_notes_en,
    });

    const userContent = buildUserMessage(promptEntry.user_template, {
      intent: intent.replace(/"/g, '\\"'),
      intent_lang: intent_lang,
      ui_locale: ui_locale,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const siteClient = await getSiteLlmClientForTier('default');
      const res = await siteClient.client.chat.completions.create({
        model: siteClient.model,
        messages: [
          ...(promptEntry.system ? [{ role: 'system' as const, content: promptEntry.system }] : []),
          { role: 'user' as const, content: userContent },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.1,
      }, { signal: controller.signal });
      clearTimeout(timeoutId);
      const content = res.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return NextResponse.json({
          level: 'all_ages',
          reason_code: 'unknown',
          confidence: 0.5,
          notes_short: 'Empty response; default all_ages.',
          ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'default' as const }),
        });
      }

      const parsed = parseClassifyResponse(content);
      if (parsed)
        return NextResponse.json({
          ...parsed,
          ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'default' as const }),
        });

      return NextResponse.json({
        level: 'all_ages',
        reason_code: 'unknown',
        confidence: 0.5,
        notes_short: 'Parse failed; default all_ages.',
        ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'default' as const }),
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
        console.warn('[audience-safety/classify]', err.message);
      }
      return NextResponse.json({
        level: 'all_ages',
        reason_code: 'unknown',
        confidence: 0.5,
        notes_short: 'Request failed; default all_ages.',
        ...(process.env.NODE_ENV !== 'production' && { llm_tier: 'default' as const }),
      });
    }
  } catch {
    return NextResponse.json(
      { level: 'all_ages', reason_code: 'unknown', confidence: 0.5, notes_short: 'Bad request.' },
      { status: 400 },
    );
  }
}
