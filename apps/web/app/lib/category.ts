/**
 * Ritual category: re-export from taxonomy (single source of truth).
 * Used by classify, missions/generate, RitualRecord, and actionability.
 */

import {
  CATEGORY_IDS,
  CATEGORY_DOCS,
  categoryRequiresFeasibility as taxonomyCategoryRequiresFeasibility,
  type CategoryId,
} from './taxonomy/categories';

export type Category = CategoryId;

export const Category = {
  LEARN: 'LEARN',
  CREATE: 'CREATE',
  PERFORM: 'PERFORM',
  WELLBEING: 'WELLBEING',
  SOCIAL: 'SOCIAL',
  CHALLENGE: 'CHALLENGE',
} as const;

export const CATEGORIES: Category[] = [...CATEGORY_IDS];

export const CATEGORIES_REQUIRING_FEASIBILITY: Category[] = CATEGORY_DOCS.filter(
  (c) => c.requires_feasibility_eval,
).map((c) => c.id);

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function categoryRequiresFeasibility(category: Category | undefined): boolean {
  return taxonomyCategoryRequiresFeasibility(category as CategoryId | undefined);
}

/** Labels + emoji for Admin rules / UI (fallback FR); use taxonomy getCategoryDisplay for i18n. */
export const CATEGORY_DISPLAY: ReadonlyArray<{ id: Category; label: string; emoji: string }> =
  CATEGORY_DOCS.map((c) => ({
    id: c.id,
    label:
      c.id === 'LEARN'
        ? 'Apprendre & comprendre'
        : c.id === 'CREATE'
          ? "Créer & s'exprimer"
          : c.id === 'PERFORM'
            ? 'Progresser & performer'
            : c.id === 'WELLBEING'
              ? "Changer & s'ancrer"
              : c.id === 'SOCIAL'
                ? 'Social & collectif'
                : 'Défis & transformations',
    emoji: c.emoji,
  }));
