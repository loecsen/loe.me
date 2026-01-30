/**
 * Soft realism check for LEARN / CREATE / WELLBEING.
 * Deterministic only; used by classify (server) and Home (client).
 * Multilingual ambition markers (FR/EN/ES/ZH/KO/JA); clean adjustments without LLM.
 */

import { categoryRequiresFeasibility } from '../category';
import type { Category } from '../category';

export type RealismLevel = 'ok' | 'stretch' | 'unrealistic';

export type RealismAdjustment =
  | { type: 'reduce_scope'; label: string; next_intent: string; next_days?: number; reason?: string }
  | { type: 'increase_duration'; label: string; next_days: number; next_intent?: string; reason?: string };

export type SoftRealismResult = {
  level: RealismLevel;
  why_short?: string;
  adjustments: RealismAdjustment[];
};

/** Ambition markers by language/script. Short lists (8–20 per). */
const AMBITION_MARKERS: Record<string, RegExp[]> = {
  fr: [
    /\b(maîtriser|maitriser|courant|bilingue|natif|niveau natif|expert|champion|parfait)\b/i,
    /\b(C2|niveau C2)\b/i,
    /\b(parler couramment|fluent)\b/i,
  ],
  en: [
    /\b(master|fluent|native-level|bilingual|expert|champion|perfect)\b/i,
    /\b(C2|level C2)\b/i,
    /\b(fluently|like a native)\b/i,
  ],
  es: [
    /\b(dominar|fluido|nivel nativo|bilingüe|experto|campeón|perfecto)\b/i,
    /\b(C2|nivel C2)\b/i,
  ],
  zh: [
    /精通/i,
    /流利/i,
    /母语水平/i,
    /掌握/i,
    /达到C2|C2水平/i,
    /完美/i,
  ],
  ko: [
    /유창/i,
    /마스터/i,
    /원어민 수준/i,
    /완벽/i,
    /C2/i,
  ],
  ja: [
    /マスター|精通/i,
    /流暢|ペラペラ/i,
    /ネイティブレベル/i,
    /完璧/i,
    /C2/i,
  ],
};

/** Latin-only markers (FR/EN/ES) combined for single pass. */
const LATIN_AMBITION = [
  /\b(maîtriser|maitriser|master|fluent|courant|bilingue|native|natif|dominar|fluido|nivel nativo|bilingual|expert|experto|champion|champion|parfait|perfect|perfecto)\b/i,
  /\b(C2|niveau C2|level C2|nivel C2)\b/i,
  /\b(parler couramment|like a native)\b/i,
];

/** Language-goal keywords / patterns (subject of learning). CJK/Hangul without \\b (word boundary fails on them). */
const LANGUAGE_GOAL_PATTERNS: Array<{ re: RegExp; subject: Record<string, string> }> = [
  { re: /\b(chinois|chinese)\b|(中文|汉语)/i, subject: { fr: 'chinois', en: 'Chinese', es: 'chino', zh: '中文', ko: '중국어', ja: '中国語' } },
  { re: /\b(japonais|japanese)\b|(日本語|日语)/i, subject: { fr: 'japonais', en: 'Japanese', es: 'japonés', zh: '日语', ko: '일본어', ja: '日本語' } },
  { re: /\b(coréen|korean)\b|(한국어|韩语)/i, subject: { fr: 'coréen', en: 'Korean', es: 'coreano', zh: '韩语', ko: '한국어', ja: '韓国語' } },
  { re: /\b(anglais|english)\b|(英语)/i, subject: { fr: 'anglais', en: 'English', es: 'inglés', zh: '英语', ko: '영어', ja: '英語' } },
  { re: /\b(espagnol|spanish|español)\b|(西班牙语)/i, subject: { fr: 'espagnol', en: 'Spanish', es: 'español', zh: '西班牙语', ko: '스페인어', ja: 'スペイン語' } },
  { re: /\b(italien|italian)\b|(意大利语)/i, subject: { fr: 'italien', en: 'Italian', es: 'italiano', zh: '意大利语', ko: '이탈리아어', ja: 'イタリア語' } },
  { re: /\b(allemand|german)\b|(德语)/i, subject: { fr: 'allemand', en: 'German', es: 'alemán', zh: '德语', ko: '독일어', ja: 'ドイツ語' } },
  { re: /\b(langue|language)\b|(语言|언어|言語)/i, subject: { fr: 'cette langue', en: 'this language', es: 'este idioma', zh: '这门语言', ko: '이 언어', ja: 'この言語' } },
];

const CEFR_PATTERN = /\b(A1|A2|B1|B2|C1|C2)\b/i;
const CEFR_HIGH_LEVEL = /\b(C1|C2)\b/i;

type DisplayLocale = 'fr' | 'en' | 'es' | 'de' | 'it' | 'zh' | 'ja' | 'ko';
const DEFAULT_LOCALE: DisplayLocale = 'en';

function normalizeLocale(locale: string | undefined): DisplayLocale {
  const code = (locale ?? '').toLowerCase().split('-')[0];
  const allowed: DisplayLocale[] = ['fr', 'en', 'es', 'de', 'it', 'zh', 'ja', 'ko'];
  return allowed.includes(code as DisplayLocale) ? (code as DisplayLocale) : DEFAULT_LOCALE;
}

/** Minimal intent language: Hangul dominant => ko, CJK dominant => zh, else fallback (UI locale). */
function inferIntentLang(intent: string, fallbackLocale: DisplayLocale): DisplayLocale {
  const trimmed = intent.trim();
  if (!trimmed) return fallbackLocale;
  let hangul = 0;
  let cjk = 0;
  let other = 0;
  for (const ch of trimmed) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0xac00 && code <= 0xd7af) hangul += 1;
    else if (code >= 0x4e00 && code <= 0x9fff) cjk += 1;
    else if (code >= 0x3040 && code <= 0x30ff) cjk += 1;
    else if (code >= 0x3400 && code <= 0x4dbf) cjk += 1;
    else other += 1;
  }
  const total = hangul + cjk + other;
  if (total === 0) return fallbackLocale;
  if (hangul / total > 0.3) return 'ko';
  if (cjk / total > 0.3) return 'zh';
  return fallbackLocale;
}

function hasAmbitionMarkers(text: string, locale?: string): boolean {
  if (LATIN_AMBITION.some((re) => re.test(text))) return true;
  if (/[\u4e00-\u9fff]/.test(text) && AMBITION_MARKERS.zh?.some((re) => re.test(text))) return true;
  if (/[\uac00-\ud7af]/.test(text) && AMBITION_MARKERS.ko?.some((re) => re.test(text))) return true;
  if (/[\u3040-\u30ff]/.test(text) && AMBITION_MARKERS.ja?.some((re) => re.test(text))) return true;
  const loc = locale ? locale.split('-')[0].toLowerCase() : '';
  if (AMBITION_MARKERS[loc]) return AMBITION_MARKERS[loc].some((re) => re.test(text));
  return false;
}

function detectLanguageSubject(intent: string, locale: DisplayLocale): string | null {
  for (const { re, subject } of LANGUAGE_GOAL_PATTERNS) {
    if (re.test(intent)) return subject[locale] ?? subject.en ?? null;
  }
  return null;
}

function hasLanguageGoal(intent: string): boolean {
  return LANGUAGE_GOAL_PATTERNS.some(({ re }) => re.test(intent)) || /\b(langue|language|语言|언어|言語)\b/i.test(intent);
}

function hasCefrOrHighLevel(intent: string): boolean {
  return CEFR_HIGH_LEVEL.test(intent) || hasAmbitionMarkers(intent, 'en');
}

/** Two duration options: [short, long] according to current days. */
function getDurationOptions(days: number): [number, number] {
  if (days <= 30) return [60, 90];
  if (days <= 60) return [90, 180];
  return [180, 270];
}

/** Build reduce_scope: label in UI locale, next_intent in intent language. */
function buildReduceScopeAdjustment(
  intent: string,
  days: number,
  locale: DisplayLocale,
  intentLang: DisplayLocale,
): { label: string; next_intent: string } {
  const subjectForLabel = detectLanguageSubject(intent, locale);
  const subjectForIntent = detectLanguageSubject(intent, intentLang);
  const base = intent.split(/[→\->]/)[0]?.trim() || intent;
  if (subjectForLabel || subjectForIntent) {
    const subjectLabel = subjectForLabel ?? subjectForIntent ?? '';
    const subjectIntent = subjectForIntent ?? subjectForLabel ?? '';
    const templates: Record<DisplayLocale, string> = {
      fr: `Apprendre les bases de ${subjectLabel}`,
      en: `Learn the basics of ${subjectLabel}`,
      es: `Aprender lo básico de ${subjectLabel}`,
      de: `Grundlagen von ${subjectLabel} lernen`,
      it: `Imparare le basi di ${subjectLabel}`,
      zh: `学习${subjectLabel}基础`,
      ja: `${subjectLabel}の基礎を学ぶ`,
      ko: `${subjectLabel} 기초 배우기`,
    };
    const label = templates[locale] ?? templates.en;
    const levelTemplates: Record<DisplayLocale, string> = {
      fr: `Atteindre le niveau A1 en ${subjectIntent}`,
      en: `Reach A1 level in ${subjectIntent}`,
      es: `Alcanzar nivel A1 en ${subjectIntent}`,
      de: `A1-Niveau in ${subjectIntent} erreichen`,
      it: `Raggiungere il livello A1 in ${subjectIntent}`,
      zh: `达到${subjectIntent}A1水平`,
      ja: `${subjectIntent}でA1レベルに`,
      ko: `${subjectIntent} A1 수준 달성`,
    };
    const next_intent = levelTemplates[intentLang] ?? levelTemplates.en;
    return { label, next_intent };
  }
  const templates: Record<DisplayLocale, string> = {
    fr: 'Apprendre les bases',
    en: 'Learn the basics',
    es: 'Aprender lo básico',
    de: 'Grundlagen lernen',
    it: 'Imparare le basi',
    zh: '学习基础',
    ja: '基礎を学ぶ',
    ko: '기초 배우기',
  };
  const unit = locale === 'fr' ? 'jours' : locale === 'es' ? 'días' : locale === 'de' ? 'Tage' : locale === 'it' ? 'giorni' : 'days';
  const label = (templates[locale] ?? templates.en) + ` (${days} ${unit})`;
  const nextPhrase: Record<DisplayLocale, string> = {
    fr: `Progresser sur le sujet (${days} jours)`,
    en: `Progress on the topic (${days} days)`,
    es: `Progresar en el tema (${days} días)`,
    de: `Fortschritt beim Thema (${days} Tage)`,
    it: `Progressi sull'argomento (${days} giorni)`,
    zh: `推进主题 (${days}天)`,
    ja: `テーマの進捗 (${days}日)`,
    ko: `주제 진행 (${days}일)`,
  };
  const next_intent = nextPhrase[intentLang] ?? nextPhrase.en;
  return { label, next_intent };
}

/** Build increase_duration label. */
function formatDaysLabel(days: number, locale: DisplayLocale): string {
  const unit = locale === 'fr' ? 'jours' : locale === 'es' ? 'días' : locale === 'de' ? 'Tage' : locale === 'it' ? 'giorni' : 'days';
  return `${days} ${unit}`;
}

/**
 * Deterministic soft realism. Only runs when category is LEARN, CREATE, or WELLBEING.
 * locale: UI language (labels, messages, adjustment.label).
 * intentLang: inferred from intent (Hangul dominant => ko, CJK dominant => zh, else locale); used for adjustment.next_intent (reformulations).
 */
export function runSoftRealism(
  intent: string,
  days: number,
  category: string | undefined,
  locale?: string,
): SoftRealismResult {
  if (!categoryRequiresFeasibility(category as Category)) {
    return { level: 'ok', adjustments: [] };
  }

  const trimmed = intent.trim();
  if (!trimmed) return { level: 'ok', adjustments: [] };

  const loc = normalizeLocale(locale);
  const intentLang = inferIntentLang(trimmed, loc);
  const lower = trimmed.toLowerCase();
  const hasAmbition = hasAmbitionMarkers(trimmed, loc);
  const isLanguageGoal = hasLanguageGoal(trimmed);
  const hasHighLevel = hasCefrOrHighLevel(trimmed);

  if (!hasAmbition && !hasHighLevel) {
    if (isLanguageGoal && days < 30) {
      return {
        level: 'stretch',
        why_short: loc === 'fr' ? `Court pour une langue (${days} jours).` : loc === 'es' ? `Poco tiempo para un idioma (${days} días).` : `Short for a language (${days} days).`,
        adjustments: [],
      };
    }
    return { level: 'ok', adjustments: [] };
  }

  const [opt1, opt2] = getDurationOptions(days);
  const reduceScope = buildReduceScopeAdjustment(trimmed, days, loc, intentLang);

  if (days <= 30 && hasAmbition) {
    return {
      level: 'unrealistic',
      why_short: loc === 'fr' ? `Objectif ambitieux pour ${days} jours.` : loc === 'es' ? `Objetivo ambicioso para ${days} días.` : `Ambitious goal for ${days} days.`,
      adjustments: [
        { type: 'reduce_scope', label: reduceScope.label, next_intent: reduceScope.next_intent, reason: undefined },
        { type: 'increase_duration', label: formatDaysLabel(opt1, loc), next_days: opt1, next_intent: trimmed },
        { type: 'increase_duration', label: formatDaysLabel(opt2, loc), next_days: opt2, next_intent: trimmed },
      ],
    };
  }

  if (isLanguageGoal && hasHighLevel && days <= 90) {
    return {
      level: 'unrealistic',
      why_short: loc === 'fr' ? `Une langue à haut niveau en ${days} jours est très ambitieux.` : loc === 'es' ? `Un idioma a nivel alto en ${days} días es muy ambicioso.` : `A language to high level in ${days} days is very ambitious.`,
      adjustments: [
        { type: 'reduce_scope', label: reduceScope.label, next_intent: reduceScope.next_intent },
        { type: 'increase_duration', label: formatDaysLabel(90, loc), next_days: 90, next_intent: trimmed },
        { type: 'increase_duration', label: formatDaysLabel(180, loc), next_days: 180, next_intent: trimmed },
      ],
    };
  }

  if (days <= 60 && isLanguageGoal && hasAmbition) {
    return {
      level: 'unrealistic',
      why_short: loc === 'fr' ? `Une langue en ${days} jours est ambitieux.` : loc === 'es' ? `Un idioma en ${days} días es ambicioso.` : `A language in ${days} days is ambitious.`,
      adjustments: [
        { type: 'reduce_scope', label: reduceScope.label, next_intent: reduceScope.next_intent },
        { type: 'increase_duration', label: formatDaysLabel(opt1, loc), next_days: opt1, next_intent: trimmed },
        { type: 'increase_duration', label: formatDaysLabel(opt2, loc), next_days: opt2, next_intent: trimmed },
      ],
    };
  }

  if (days <= 60 && hasAmbition) {
    return {
      level: 'stretch',
      why_short: loc === 'fr' ? `Ambitieux pour ${days} jours.` : loc === 'es' ? `Ambicioso para ${days} días.` : `Ambitious for ${days} days.`,
      adjustments: [
        { type: 'increase_duration', label: formatDaysLabel(opt1, loc), next_days: opt1, next_intent: trimmed },
        { type: 'increase_duration', label: formatDaysLabel(opt2, loc), next_days: opt2, next_intent: trimmed },
      ],
    };
  }

  if (isLanguageGoal && days < 30) {
    return {
      level: 'stretch',
      why_short: loc === 'fr' ? `Court pour une langue.` : loc === 'es' ? `Poco tiempo para un idioma.` : `Short for a language.`,
      adjustments: [],
    };
  }

  return { level: 'ok', adjustments: [] };
}
