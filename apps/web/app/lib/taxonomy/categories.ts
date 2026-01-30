/**
 * Category registry: single source of truth for ritual categories.
 * Stable internal IDs (English); labels via i18n label_key.
 */

export const CATEGORY_IDS = [
  'LEARN',
  'CREATE',
  'PERFORM',
  'WELLBEING',
  'SOCIAL',
  'CHALLENGE',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type SubcategoryDoc = {
  id: string;
  label_key: string;
  examples: string[];
};

export type CategoryDoc = {
  id: CategoryId;
  emoji: string;
  label_key: string;
  requires_feasibility_eval: boolean;
  subcategories: SubcategoryDoc[];
  default_playbook_id: string;
};

export const CATEGORY_DOCS: CategoryDoc[] = [
  {
    id: 'LEARN',
    emoji: '🧠',
    label_key: 'categoryLabelLearn',
    requires_feasibility_eval: true,
    subcategories: [
      { id: 'language', label_key: 'categorySubLearnLanguage', examples: ['apprendre le chinois A2', 'Learn Spanish basics'] },
      { id: 'skill', label_key: 'categorySubLearnSkill', examples: ['me préparer à un entretien en anglais'] },
    ],
    default_playbook_id: 'INLINE_SOFT_REALISM_KEEP_ADJUST',
  },
  {
    id: 'CREATE',
    emoji: '✍️',
    label_key: 'categoryLabelCreate',
    requires_feasibility_eval: true,
    subcategories: [
      { id: 'express', label_key: 'categorySubCreateExpress', examples: ['créer une routine de concentration'] },
    ],
    default_playbook_id: 'INLINE_SOFT_REALISM_KEEP_ADJUST',
  },
  {
    id: 'PERFORM',
    emoji: '🚀',
    label_key: 'categoryLabelPerform',
    requires_feasibility_eval: false,
    subcategories: [],
    default_playbook_id: 'PROCEED_GENERATE',
  },
  {
    id: 'WELLBEING',
    emoji: '🌱',
    label_key: 'categoryLabelWellbeing',
    requires_feasibility_eval: true,
    subcategories: [
      { id: 'grounding', label_key: 'categorySubWellbeingGrounding', examples: ['mieux gérer mon stress', 'feel better after the breakup'] },
      { id: 'habits', label_key: 'categorySubWellbeingHabits', examples: ['améliorer ma routine de sommeil'] },
    ],
    default_playbook_id: 'INLINE_TWO_PATHS_CONTROL',
  },
  {
    id: 'SOCIAL',
    emoji: '🤝',
    label_key: 'categoryLabelSocial',
    requires_feasibility_eval: false,
    subcategories: [],
    default_playbook_id: 'PROCEED_GENERATE',
  },
  {
    id: 'CHALLENGE',
    emoji: '🎯',
    label_key: 'categoryLabelChallenge',
    requires_feasibility_eval: false,
    subcategories: [],
    default_playbook_id: 'PROCEED_GENERATE',
  },
];

export function categoryRequiresFeasibility(categoryId: CategoryId | undefined): boolean {
  if (categoryId == null) return false;
  const doc = CATEGORY_DOCS.find((c) => c.id === categoryId);
  return doc?.requires_feasibility_eval ?? false;
}

export function getCategoryById(categoryId: CategoryId | undefined): CategoryDoc | undefined {
  if (categoryId == null) return undefined;
  return CATEGORY_DOCS.find((c) => c.id === categoryId);
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

/** Resolve emoji + label for display; label from translations by label_key. */
export function getCategoryDisplay(
  categoryId: CategoryId | undefined,
  locale: string,
  translationsMap?: Record<string, Record<string, string>>,
): { emoji: string; label: string } {
  const doc = getCategoryById(categoryId as CategoryId);
  if (!doc) return { emoji: '', label: String(categoryId ?? '') };
  const localeKey = locale?.split('-')[0]?.toLowerCase() ?? 'en';
  const t = translationsMap?.[localeKey] ?? translationsMap?.en ?? {};
  const label = (t[doc.label_key] as string) ?? doc.label_key;
  return { emoji: doc.emoji, label };
}
