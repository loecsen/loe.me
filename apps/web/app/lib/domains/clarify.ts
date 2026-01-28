export type ClarificationSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  intention: string;
  domainHint: string;
};

const vaguePatterns = [
  'réussir ma vie',
  'reussir ma vie',
  'être heureux',
  'etre heureux',
  'être heureuse',
  'etre heureuse',
  'aller mieux',
  'me sentir bien',
  'changer de vie',
  'devenir meilleur',
  'devenir meilleure',
  'être meilleur',
  'etre meilleur',
  'être meilleure',
  'etre meilleure',
  'mieux',
];

const actionVerbs = [
  'apprendre',
  'maitriser',
  'maîtriser',
  'pratiquer',
  'améliorer',
  'ameliorer',
  'développer',
  'developper',
  'réduire',
  'reduire',
  'dormir',
  'méditer',
  'mediter',
  'respirer',
  'organiser',
  'gagner',
  'perdre',
  'jouer',
  'dessiner',
  'coder',
  'programmer',
];

const skillKeywords = [
  'guitare',
  'piano',
  'échecs',
  'chess',
  'dessin',
  'code',
  'coding',
  'méditation',
  'meditation',
  'stress',
  'sommeil',
  'sleep',
  'respiration',
  'langue',
  'language',
  'swimming',
  'tennis',
];

export function needsClarification(intention: string): boolean {
  const raw = intention.trim().toLowerCase();
  if (!raw) return true;
  if (raw.includes('→') || raw.includes('->')) {
    return false;
  }
  const wordCount = raw.split(/\s+/).filter(Boolean).length;
  const hasVaguePattern = vaguePatterns.some((pattern) => raw.includes(pattern));
  const hasActionVerb = actionVerbs.some((verb) => raw.includes(verb));
  const hasSkillKeyword = skillKeywords.some((keyword) => raw.includes(keyword));
  if (wordCount < 5) return true;
  if (hasVaguePattern) return true;
  if (!hasActionVerb && !hasSkillKeyword) return true;
  return false;
}

export function buildClarificationSuggestions(intention: string): ClarificationSuggestion[] {
  const raw = intention.trim();
  const lower = raw.toLowerCase();
  const wellbeing = lower.includes('stress') || lower.includes('calme') || lower.includes('sommeil');
  const skill =
    lower.includes('guitare') ||
    lower.includes('piano') ||
    lower.includes('échecs') ||
    lower.includes('chess') ||
    lower.includes('dessin');
  const work =
    lower.includes('travail') ||
    lower.includes('boulot') ||
    lower.includes('pro') ||
    lower.includes('carrière') ||
    lower.includes('carriere');

  const suggestionA = wellbeing
    ? {
        title: 'Calmer mon mental (10 min/jour)',
        subtitle: 'Respirer, relâcher la tension, mieux dormir.',
        intention: 'Calmer mon mental en 10 minutes par jour',
        domainHint: 'wellbeing_mind',
      }
    : {
        title: 'Calmer mon mental (10 min/jour)',
        subtitle: 'Un rituel court pour se recentrer chaque jour.',
        intention: 'Calmer mon mental en 10 minutes par jour',
        domainHint: 'wellbeing_mind',
      };

  const suggestionB = work
    ? {
        title: 'Mieux m’organiser (10 min/jour)',
        subtitle: 'Priorités claires, plan simple, moins de stress.',
        intention: 'Mieux m’organiser en 10 minutes par jour',
        domainHint: 'personal_productivity',
      }
    : {
        title: 'Mieux m’organiser (10 min/jour)',
        subtitle: 'Clarifier mes priorités et routines chaque jour.',
        intention: 'Mieux m’organiser en 10 minutes par jour',
        domainHint: 'personal_productivity',
      };

  const suggestionC = skill
    ? {
        title: 'Apprendre une compétence (10 min/jour)',
        subtitle: 'Une compétence concrète, pas à pas.',
        intention: `Apprendre les bases de ${raw} en 10 minutes par jour`,
        domainHint: 'skill_performance',
      }
    : {
        title: 'Apprendre une compétence (10 min/jour)',
        subtitle: 'Une compétence concrète, pas à pas.',
        intention: 'Apprendre une compétence concrète en 10 minutes par jour',
        domainHint: 'skill_performance',
      };

  return [
    { id: 'clarify-a', ...suggestionA },
    { id: 'clarify-b', ...suggestionB },
    { id: 'clarify-c', ...suggestionC },
  ];
}
