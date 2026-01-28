import 'server-only';

export type ModerationDecision =
  | { status: 'ok' }
  | {
      status: 'blocked';
      reason_code: 'self_harm' | 'violence' | 'sexual_violence' | 'hate' | 'illegal' | 'other_blocked';
    };

type ModerationCategoryMap = Record<string, boolean>;
type ModerationReasonCode = Extract<ModerationDecision, { status: 'blocked' }>['reason_code'];

const OPENAI_URL = 'https://api.openai.com/v1/moderations';
const MODEL = 'omni-moderation-latest';

const hasAnyCategory = (categories: ModerationCategoryMap, keys: string[]) =>
  keys.some((key) => categories[key]);

const hasAnyKeyContaining = (categories: ModerationCategoryMap, needle: string) =>
  Object.keys(categories).some((key) => key.includes(needle) && categories[key]);

const mapReasonCode = (categories: ModerationCategoryMap): ModerationReasonCode => {
  if (hasAnyKeyContaining(categories, 'self-harm') || hasAnyKeyContaining(categories, 'self_harm')) {
    return 'self_harm';
  }
  if (
    hasAnyCategory(categories, ['sexual/violence', 'sexual_violence']) ||
    (hasAnyKeyContaining(categories, 'sexual') && hasAnyKeyContaining(categories, 'violence'))
  ) {
    return 'sexual_violence';
  }
  if (
    hasAnyKeyContaining(categories, 'hate') ||
    hasAnyKeyContaining(categories, 'harassment')
  ) {
    return 'hate';
  }
  if (hasAnyKeyContaining(categories, 'illicit') || hasAnyKeyContaining(categories, 'illegal')) {
    return 'illegal';
  }
  if (hasAnyKeyContaining(categories, 'violence') || hasAnyKeyContaining(categories, 'threat')) {
    return 'violence';
  }
  return 'other_blocked';
};

export async function runOpenAIModeration(intention: string): Promise<ModerationDecision> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[moderation] missing OPENAI_API_KEY, skipping');
      return { status: 'ok' };
    }
    return { status: 'blocked', reason_code: 'other_blocked' };
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
        input: intention,
      }),
    });

    if (!response.ok) {
      throw new Error(`moderation_failed:${response.status}`);
    }

    const payload = (await response.json()) as {
      results?: Array<{
        flagged?: boolean;
        categories?: ModerationCategoryMap;
        category_scores?: Record<string, number>;
      }>;
    };

    const result = payload?.results?.[0];
    const categories = result?.categories ?? {};
    const flagged = Boolean(result?.flagged);
    const anyCategory = Object.values(categories).some(Boolean);

    if (process.env.NODE_ENV !== 'production') {
      console.warn('[moderation] debug', {
        flagged,
        categories: Object.keys(categories),
        category_scores: result?.category_scores,
      });
    }

    if (!flagged && !anyCategory) {
      return { status: 'ok' };
    }

    return {
      status: 'blocked',
      reason_code: mapReasonCode(categories),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[moderation] request failed, skipping', error);
      return { status: 'ok' };
    }
    return { status: 'blocked', reason_code: 'other_blocked' };
  }
}
