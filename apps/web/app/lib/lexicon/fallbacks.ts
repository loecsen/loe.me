/**
 * Script-based fallback packs. Small token lists derived from actionability/controllability/ambition baseline.
 * Used when no published or draft pack exists for intentLang.
 */

import type { LexiconPackV1, LexiconPackTokens } from './types';

const DEFAULT_NORMALIZE = { lower: true, strip_diacritics: true };
const DEFAULT_GENERATED_BY = {
  provider: 'loe',
  model: 'fallback',
  prompt_version: '1',
};

function makeFallbackPack(
  lang: string,
  script: string,
  tokens: LexiconPackTokens,
): LexiconPackV1 {
  return {
    lang,
    version: 'lexicon-pack-v1',
    generated_at: new Date(0).toISOString(),
    generated_by: DEFAULT_GENERATED_BY,
    confidence: 0.5,
    notes: `Script-based fallback (${script}). Not language-specific.`,
    normalize: DEFAULT_NORMALIZE,
    tokens,
  };
}

/** Latin script baseline (EN/FR/ES etc. — minimal overlap with existing heuristics). */
const LATIN_GENERIC_TOKENS: LexiconPackTokens = {
  greetings: ['hello', 'hi', 'hey', 'bonjour', 'salut', 'hola', 'ciao', 'hallo'],
  learning_verbs: ['learn', 'study', 'improve', 'apprendre', 'étudier', 'améliorer', 'aprender', 'mejorar'],
  consume_verbs: ['eat', 'drink', 'manger', 'boire', 'comer', 'beber'],
  romantic_markers: ['ex', 'back', 'recover', 'récupérer', 'love', 'reconquérir'],
  institution_markers: ['visa', 'citizenship', 'nationalité', 'court', 'election'],
  selection_markers: ['hired', 'embauché', 'admitted', 'accepté', 'election'],
  market_markers: ['billionaire', 'milliardaire', 'lottery', 'loto', 'stock', 'portfolio'],
  elite_role_markers: ['president', 'président', 'champion', 'CEO', 'minister', 'ministre'],
  superlative_markers: ['best', 'meilleur', 'famous', 'célèbre', 'world-class', 'nobel', 'oscar'],
};

/** CJK baseline (minimal). */
const CJK_GENERIC_TOKENS: LexiconPackTokens = {
  greetings: ['你好', '您好', '嗨'],
  learning_verbs: ['学习', '练习', '改善'],
  consume_verbs: ['吃', '喝'],
  romantic_markers: ['挽回', '復縁'],
  institution_markers: ['总统', '总理', '签证'],
  selection_markers: ['选举', '录取'],
  market_markers: ['亿万富翁', '彩票'],
  elite_role_markers: ['总统', '亿万富翁', '诺贝尔'],
  superlative_markers: ['最好', '第一'],
};

/** Hangul baseline. */
const HANGUL_GENERIC_TOKENS: LexiconPackTokens = {
  greetings: ['안녕', '안녕하세요'],
  learning_verbs: ['연습', '학습', '배우다'],
  consume_verbs: ['먹다', '마시다'],
  romantic_markers: ['재결합'],
  institution_markers: ['대통령', '선거'],
  selection_markers: ['입학', '채용'],
  market_markers: ['복권', '억만장자'],
  elite_role_markers: ['대통령', '억만장자'],
  superlative_markers: ['최고', '유명'],
};

/** Kana (Japanese) baseline. */
const KANA_GENERIC_TOKENS: LexiconPackTokens = {
  greetings: ['こんにちは', '你好'],
  learning_verbs: ['勉強', '学習', '練習'],
  consume_verbs: ['食べる', '飲む'],
  romantic_markers: ['復縁'],
  institution_markers: ['大統領', '総理'],
  selection_markers: ['選挙', '合格'],
  market_markers: ['億万長者', '宝くじ'],
  elite_role_markers: ['大統領', '億万長者'],
  superlative_markers: ['最高', '一番'],
};

/** Cyrillic baseline (minimal). */
const CYRILLIC_GENERIC_TOKENS: LexiconPackTokens = {
  greetings: ['привет', 'здравствуйте'],
  learning_verbs: ['учиться', 'изучить', 'улучшить'],
  consume_verbs: ['есть', 'пить'],
  romantic_markers: ['вернуть', 'любовь'],
  institution_markers: ['виза', 'гражданство', 'выборы'],
  selection_markers: ['нанят', 'принят'],
  market_markers: ['миллиардер', 'лотерея'],
  elite_role_markers: ['президент', 'чемпион'],
  superlative_markers: ['лучший', 'известный'],
};

/** Arabic baseline (minimal). */
const ARABIC_GENERIC_TOKENS: LexiconPackTokens = {
  greetings: ['مرحبا', 'أهلا'],
  learning_verbs: ['تعلم', 'دراسة', 'تحسين'],
  consume_verbs: ['أكل', 'شرب'],
  romantic_markers: ['حب', 'عودة'],
  institution_markers: ['فيزا', 'جنسية', 'انتخابات'],
  selection_markers: ['توظيف', 'قبول'],
  market_markers: ['ملياردير', 'يانصيب'],
  elite_role_markers: ['رئيس', 'بطل'],
  superlative_markers: ['الأفضل', 'شهير'],
};

export const FALLBACK_PACKS: Record<string, LexiconPackV1> = {
  latin_generic: makeFallbackPack('latin', 'latin', LATIN_GENERIC_TOKENS),
  cjk_generic: makeFallbackPack('zh', 'cjk', CJK_GENERIC_TOKENS),
  hangul_generic: makeFallbackPack('ko', 'hangul', HANGUL_GENERIC_TOKENS),
  kana_generic: makeFallbackPack('ja', 'kana', KANA_GENERIC_TOKENS),
  cyrillic_generic: makeFallbackPack('ru', 'cyrillic', CYRILLIC_GENERIC_TOKENS),
  arabic_generic: makeFallbackPack('ar', 'arabic', ARABIC_GENERIC_TOKENS),
};

export type FallbackPackKey = keyof typeof FALLBACK_PACKS;
