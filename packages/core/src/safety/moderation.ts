import type { SafetyVerdict } from './types';
import { pushTrace, type TraceEvent } from './trace';
import type { ReasonCode } from './types';

type ModerationCategoryMap = Record<string, boolean>;
type ModerationScores = Record<string, number>;

const OPENAI_URL = 'https://api.openai.com/v1/moderations';
const MODEL = 'omni-moderation-latest';

const hasAnyKeyContaining = (categories: ModerationCategoryMap, needle: string) =>
  Object.keys(categories).some((key) => key.includes(needle) && categories[key]);

const mapReasonCode = (categories: ModerationCategoryMap): ReasonCode => {
  if (hasAnyKeyContaining(categories, 'sexual/minors')) {
    return 'sexual_minors';
  }
  if (hasAnyKeyContaining(categories, 'self-harm') || hasAnyKeyContaining(categories, 'self_harm')) {
    return 'self_harm';
  }
  if (hasAnyKeyContaining(categories, 'sexual/violence')) {
    return 'violence';
  }
  if (hasAnyKeyContaining(categories, 'sexual')) {
    return 'sexual';
  }
  if (hasAnyKeyContaining(categories, 'hate')) {
    return 'hate';
  }
  if (hasAnyKeyContaining(categories, 'illicit') || hasAnyKeyContaining(categories, 'illegal')) {
    return 'illegal_wrongdoing';
  }
  if (hasAnyKeyContaining(categories, 'terror') || hasAnyKeyContaining(categories, 'extrem')) {
    return 'extremism';
  }
  if (hasAnyKeyContaining(categories, 'violence') || hasAnyKeyContaining(categories, 'threat')) {
    return 'violence';
  }
  return 'other';
};

export async function moderationGuard(text: string, trace?: TraceEvent[]): Promise<SafetyVerdict> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      pushTrace(trace, {
        gate: 'safety.openai_moderation',
        outcome: 'ok',
        meta: { skipped: 'missing_api_key' },
      });
      return { status: 'ok' };
    }
    return { status: 'blocked', reason_code: 'other' };
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`moderation_failed:${response.status}`);
    }

    const payload = (await response.json()) as {
      results?: Array<{
        flagged?: boolean;
        categories?: ModerationCategoryMap;
        category_scores?: ModerationScores;
      }>;
    };

    const result = payload?.results?.[0];
    const categories = result?.categories ?? {};
    const flagged = Boolean(result?.flagged);
    const anyCategory = Object.values(categories).some(Boolean);
    const isBlocked = flagged || anyCategory;

    if (isBlocked) {
      const reason = mapReasonCode(categories);
      pushTrace(trace, {
        gate: 'safety.openai_moderation',
        outcome: 'blocked',
        reason_code: reason,
        meta: {
          flagged,
          categories: Object.keys(categories),
          category_scores: result?.category_scores,
        },
      });
      return { status: 'blocked', reason_code: reason };
    }

    pushTrace(trace, {
      gate: 'safety.openai_moderation',
      outcome: 'ok',
      meta: {
        flagged,
        categories: Object.keys(categories),
        category_scores: result?.category_scores,
      },
    });
    return { status: 'ok' };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      pushTrace(trace, {
        gate: 'safety.openai_moderation',
        outcome: 'ok',
        meta: { skipped: 'request_failed', error: String(error) },
      });
      return { status: 'ok' };
    }
    return { status: 'blocked', reason_code: 'other' };
  }
}
