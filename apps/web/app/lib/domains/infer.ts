import type { DomainPlaybook } from './registry';

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  language: [
    'language',
    'langue',
    'spanish',
    'french',
    'english',
    'german',
    'italian',
    'portuguese',
    'japanese',
    'korean',
    'chinese',
    'mandarin',
    'arabic',
    'greek',
    'vocab',
    'vocabulary',
    'grammar',
    'pronunciation',
    'tones',
    'a1',
    'a2',
    'b1',
    'b2',
    'c1',
    'c2',
    'débutant',
    'intermédiaire',
  ],
  fitness_sport: [
    'tennis',
    'serve',
    'crawl',
    'swimming',
    'nager',
    'run',
    'running',
    'jog',
    'gym',
    'workout',
    'training',
    'fitness',
    'sport',
    'yoga',
    'pilates',
    'marathon',
  ],
  wellbeing_meditation: [
    'meditation',
    'méditation',
    'mindfulness',
    'breathing',
    'respiration',
    'breath',
    'stress',
    'calm',
    'calme',
    'anxiety',
    'anxiété',
  ],
  wellbeing_mind: [
    'stress',
    'anxiety',
    'anxiété',
    'calm',
    'calme',
    'sommeil',
    'sleep',
    'énergie',
    'energy',
    'mindfulness',
    'méditation',
    'breathing',
    'respiration',
    'breath',
  ],
  skill_performance: [
    'guitare',
    'guitar',
    'piano',
    'échecs',
    'chess',
    'dessin',
    'drawing',
    'code',
    'coding',
    'practice',
    'drill',
  ],
  tech_coding: ['code', 'coding', 'programming', 'javascript', 'python', 'react', 'typescript'],
  music_practice: ['violin', 'drums', 'music', 'singing'],
  craft_cooking_diy: [
    'cooking',
    'cuisine',
    'recipe',
    'recette',
    'pizza',
    'pizzas',
    'pâte',
    'pate',
    'four',
    'diy',
    'bricolage',
    'craft',
  ],
  academics_exam: ['exam', 'examen', 'math', 'history', 'biology', 'physics', 'revision', 'révision'],
  professional_skills: ['presentation', 'presentation skills', 'email', 'pitch', 'meeting', 'leadership'],
  business_growth: ['growth', 'marketing', 'sales', 'startup', 'business', 'acquisition'],
  personal_productivity: ['focus', 'productivity', 'routine', 'habits', 'organisation'],
};

const languageLevelRegex = /\b(a1|a2|b1|b2|c1|c2)\b/;
const timeframeRegex = /\b(\d+)\s?(days|day|jours|jour|weeks|week|semaines|semaine)\b/;
const vagueGoalRegex =
  /(confiance en soi|motivation|discipline|être meilleur|mieux|améliorer|progresser|bases|débuter|apprendre)$/;

export type ValidationPreference = 'automatic' | 'self_report' | 'presence';

export type EnrichedIntention = {
  goalHint:
    | 'language_learning'
    | 'fitness_skill'
    | 'wellbeing_meditation'
    | 'coding_skill'
    | 'music_skill'
    | 'business_growth'
    | 'professional_skill'
    | 'academic_exam'
    | 'craft_cooking_diy'
    | 'personal_confidence'
    | 'personal_productivity';
  contextHint:
    | 'needs_level_timeframe'
    | 'needs_pronunciation_tones'
    | 'needs_sport_technique'
    | 'needs_daily_routine'
    | 'needs_workplace_scenario'
    | 'needs_exam_focus'
    | 'needs_creative_project'
    | 'needs_calm_breathing'
    | 'needs_cooking_steps'
    | 'needs_coding_project';
  validationPreference: ValidationPreference;
  source: 'heuristic' | 'llm' | 'fallback';
};

export function inferDomainId(intention: string): string {
  const text = intention.toLowerCase();
  const scores = Object.entries(DOMAIN_KEYWORDS).map(([id, keywords]) => ({
    id,
    score: keywords.reduce((acc, keyword) => (text.includes(keyword) ? acc + 1 : acc), 0),
  }));
  const best = scores.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), scores[0]);
  if (languageLevelRegex.test(text) && best?.id !== 'language') {
    return 'language';
  }
  return best?.score ? best.id : 'personal_productivity';
}

type InferDomainOptions = {
  playbooks: DomainPlaybook[];
  locale?: string;
  llm?: { apiKey: string; model: string };
  hints?: EnrichedIntention;
};

const pickPlaybook = (playbooks: DomainPlaybook[], domainId: string) =>
  playbooks.find((entry) => entry.id === domainId) ?? playbooks[0];

export async function inferDomainContext(
  intention: string,
  locale: string,
  { playbooks, llm, hints }: InferDomainOptions,
) {
  const heuristic = inferDomainId(intention);
  const domainIds = playbooks.map((entry) => entry.id);
  const hintedDomain = hints ? mapGoalHintToDomain(hints.goalHint) : null;
  const fallback = pickPlaybook(playbooks, hintedDomain ?? heuristic);
  let domainId = fallback.id;
  let source: 'heuristic' | 'llm' | 'fallback' = hintedDomain ? hints?.source ?? 'heuristic' : 'heuristic';

  if (llm?.apiKey && (hintedDomain === null || domainId === 'personal_productivity')) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${llm.apiKey}`,
        },
        body: JSON.stringify({
          model: llm.model,
          temperature: 0,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'domain_classifier',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  domainId: { type: 'string', enum: domainIds },
                },
                required: ['domainId'],
                additionalProperties: false,
              },
            },
          },
          messages: [
            {
              role: 'system',
              content:
                'You are a strict classifier. Return JSON only with the chosen domainId.',
            },
            {
              role: 'user',
              content: `Goal: "${intention}". Locale: ${locale}. DomainIds: ${domainIds.join(
                ', ',
              )}`,
            },
          ],
        }),
      });
      if (response.ok) {
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as { domainId?: string };
          if (parsed.domainId && domainIds.includes(parsed.domainId)) {
            domainId = parsed.domainId;
            source = 'llm';
          }
        }
      }
    } catch {
      source = 'fallback';
    }
  }

  const playbook = pickPlaybook(playbooks, domainId);
  return {
    domainId: playbook.id,
    domainProfile: playbook.profile.label,
    domainPlaybookVersion: String(playbook.version),
    source,
  };
}

const mapGoalHintToDomain = (goalHint: EnrichedIntention['goalHint']) => {
  switch (goalHint) {
    case 'language_learning':
      return 'language';
    case 'fitness_skill':
      return 'fitness_sport';
    case 'wellbeing_meditation':
      return 'wellbeing_mind';
    case 'coding_skill':
      return 'skill_performance';
    case 'music_skill':
      return 'skill_performance';
    case 'business_growth':
      return 'business_growth';
    case 'professional_skill':
      return 'professional_skills';
    case 'academic_exam':
      return 'academics_exam';
    case 'craft_cooking_diy':
      return 'craft_cooking_diy';
    case 'personal_confidence':
    case 'personal_productivity':
    default:
      return 'personal_productivity';
  }
};

export async function enrichIntention(
  intention: string,
  locale: string,
  llm?: { apiKey: string; model: string },
): Promise<EnrichedIntention> {
  const text = intention.toLowerCase().trim();
  const hasLevel = languageLevelRegex.test(text);
  const hasTimeframe = timeframeRegex.test(text);
  const isVague = text.length < 18 || vagueGoalRegex.test(text);

  const goalHint = (() => {
    if (DOMAIN_KEYWORDS.language.some((entry) => text.includes(entry))) {
      return 'language_learning';
    }
    if (DOMAIN_KEYWORDS.fitness_sport.some((entry) => text.includes(entry))) {
      return 'fitness_skill';
    }
    if (DOMAIN_KEYWORDS.wellbeing_meditation.some((entry) => text.includes(entry))) {
      return 'wellbeing_meditation';
    }
    if (DOMAIN_KEYWORDS.tech_coding.some((entry) => text.includes(entry))) {
      return 'coding_skill';
    }
    if (DOMAIN_KEYWORDS.music_practice.some((entry) => text.includes(entry))) {
      return 'music_skill';
    }
    if (DOMAIN_KEYWORDS.business_growth.some((entry) => text.includes(entry))) {
      return 'business_growth';
    }
    if (DOMAIN_KEYWORDS.professional_skills.some((entry) => text.includes(entry))) {
      return 'professional_skill';
    }
    if (DOMAIN_KEYWORDS.academics_exam.some((entry) => text.includes(entry))) {
      return 'academic_exam';
    }
    if (DOMAIN_KEYWORDS.craft_cooking_diy.some((entry) => text.includes(entry))) {
      return 'craft_cooking_diy';
    }
    if (text.includes('confiance') || text.includes('self-confidence')) {
      return 'personal_confidence';
    }
    return 'personal_productivity';
  })();

  const contextHint = (() => {
    if (goalHint === 'language_learning') {
      if (text.includes('tone') || text.includes('ton')) {
        return 'needs_pronunciation_tones';
      }
      return 'needs_level_timeframe';
    }
    if (goalHint === 'fitness_skill') {
      return 'needs_sport_technique';
    }
    if (goalHint === 'wellbeing_meditation') {
      return 'needs_calm_breathing';
    }
    if (goalHint === 'coding_skill') {
      return 'needs_coding_project';
    }
    if (goalHint === 'professional_skill') {
      return 'needs_workplace_scenario';
    }
    if (goalHint === 'academic_exam') {
      return 'needs_exam_focus';
    }
    if (goalHint === 'craft_cooking_diy') {
      return 'needs_cooking_steps';
    }
    if (goalHint === 'business_growth') {
      return 'needs_creative_project';
    }
    return 'needs_daily_routine';
  })();

  const validationPreference: ValidationPreference = (() => {
    if (goalHint === 'language_learning' || goalHint === 'coding_skill') {
      return 'automatic';
    }
    if (goalHint === 'wellbeing_meditation') {
      return 'presence';
    }
    return 'self_report';
  })();

  if (llm?.apiKey && isVague) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${llm.apiKey}`,
        },
        body: JSON.stringify({
          model: llm.model,
          temperature: 0,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'intention_enricher',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  goalHint: {
                    type: 'string',
                    enum: [
                      'language_learning',
                      'fitness_skill',
                      'wellbeing_meditation',
                      'coding_skill',
                      'music_skill',
                      'business_growth',
                      'professional_skill',
                      'academic_exam',
                      'craft_cooking_diy',
                      'personal_confidence',
                      'personal_productivity',
                    ],
                  },
                  contextHint: {
                    type: 'string',
                    enum: [
                      'needs_level_timeframe',
                      'needs_pronunciation_tones',
                      'needs_sport_technique',
                      'needs_daily_routine',
                      'needs_workplace_scenario',
                      'needs_exam_focus',
                      'needs_creative_project',
                      'needs_calm_breathing',
                      'needs_cooking_steps',
                      'needs_coding_project',
                    ],
                  },
                  validationPreference: {
                    type: 'string',
                    enum: ['automatic', 'self_report', 'presence'],
                  },
                },
                required: ['goalHint', 'contextHint', 'validationPreference'],
                additionalProperties: false,
              },
            },
          },
          messages: [
            {
              role: 'system',
              content:
                'You enrich goals for a learning ritual. Return JSON only using enums.',
            },
            {
              role: 'user',
              content: `Goal: "${intention}". Locale: ${locale}.`,
            },
          ],
        }),
      });
      if (response.ok) {
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as EnrichedIntention;
          return { ...parsed, source: 'llm' };
        }
      }
    } catch {
      return { goalHint, contextHint, validationPreference, source: 'fallback' };
    }
  }

  return { goalHint, contextHint, validationPreference, source: 'heuristic' };
}

export function domainContextFromHints(
  hints: EnrichedIntention,
  playbooks: DomainPlaybook[],
) {
  const domainId = mapGoalHintToDomain(hints.goalHint);
  const playbook = pickPlaybook(playbooks, domainId);
  return {
    domainId: playbook.id,
    domainProfile: playbook.profile.label,
    domainPlaybookVersion: String(playbook.version),
  };
}
