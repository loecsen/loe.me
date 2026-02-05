'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Tabs } from '@loe/ui';
import styles from './RitualHistory.module.css';
import RitualCard, { type RitualCardItem } from './RitualCard';
import CommunityRitualCard, { getCoverUrl } from './CommunityRitualCard';
import { removeCachedImage } from '../lib/images/imageCache';
import type { CommunityRitualV1 } from '../lib/db/types';
import type { IdeaRoutineCategory } from '../lib/db/types';
import { useI18n } from './I18nProvider';
import { CATEGORY_IDS } from '../lib/taxonomy/categories';
import {
  buildRitualStorageKey,
  RITUAL_INDEX_KEY,
  type RitualIndexItem,
} from '../lib/rituals/inProgress';

type RitualTab = 'in_progress' | 'mine' | 'community';

/** Données par onglet (passées par la Home quand source = mock). */
export type RitualTabData = Record<RitualTab, RitualCardItem[]>;

type ListResponse = {
  items: RitualCardItem[];
  nextCursor: string | null;
  total?: number;
};

const COLLAPSED_LIMIT = 6;
const EXPANDED_LIMIT = 6;
const LOAD_MORE_LIMIT = 6;

const tabLabels: Record<RitualTab, string> = {
  in_progress: 'Rituels en cours',
  mine: 'Mes projets',
  community: 'Inspiration',
};

type RitualHistoryProps = {
  /** Données maquette par onglet ; si fourni, on les affiche sans appeler l’API */
  mockTabData?: RitualTabData | null;
  uiLocale?: string;
  onPrefillIntent?: (intent: string, days: number, ideaId?: string) => void;
  onJoinCommunityRitual?: (ritual: CommunityRitualV1) => void;
  /** Quand le rituel a été créé complètement (parcours créé) à partir de cette idée, on retire le chip. */
  ideaIdUsedForRitual?: string | null;
};

/** localStorage key: loe.used_idea_routines.<ui_locale>.<category> → JSON array of idea routine IDs. */
const USED_IDEAS_KEY_PREFIX = 'loe.used_idea_routines.';
const IDEA_CHIPS_COUNT = 4;

function getUsedIdeaIds(uiLocale: string, category: IdeaRoutineCategory): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = `${USED_IDEAS_KEY_PREFIX}${uiLocale || 'en'}.${category}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function markIdeaUsed(uiLocale: string, category: IdeaRoutineCategory, id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${USED_IDEAS_KEY_PREFIX}${uiLocale || 'en'}.${category}`;
    const prev = getUsedIdeaIds(uiLocale, category);
    if (prev.includes(id)) return;
    window.localStorage.setItem(key, JSON.stringify([...prev, id]));
  } catch {
    // ignore
  }
}

function pickRandom<T>(arr: T[], excludeIds: string[], idGetter: (t: T) => string, count: number): T[] {
  const set = new Set(excludeIds);
  const available = arr.filter((t) => !set.has(idGetter(t)));
  if (available.length <= count) return available;
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function RitualHistory({
  mockTabData = null,
  uiLocale = 'en',
  onPrefillIntent,
  onJoinCommunityRitual,
  ideaIdUsedForRitual = null,
}: RitualHistoryProps) {
  const router = useRouter();
  const { t } = useI18n();
  const tRec = t as Record<string, string>;
  const [activeTab, setActiveTab] = useState<RitualTab>('in_progress');
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<RitualCardItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  /** En mode mock : IDs des cartes retirées (mockTabData est lecture seule) */
  const [removedMockIds, setRemovedMockIds] = useState<Set<string>>(() => new Set());
  const [communitySections, setCommunitySections] = useState<Array<{ category: IdeaRoutineCategory; items: CommunityRitualV1[] }>>([]);
  /** All idea routines from API (to filter by category when tab changes). */
  const [allIdeaRoutines, setAllIdeaRoutines] = useState<Array<{ id: string; category: IdeaRoutineCategory; title_en: string; intent_en: string; translations?: Record<string, { title: string; intent: string }> }>>([]);
  const [ideaChips, setIdeaChips] = useState<Array<{ id: string; title: string; intent: string }>>([]);
  const [ideaChipsCategory, setIdeaChipsCategory] = useState<IdeaRoutineCategory | null>(null);
  /** Selected category tab in Inspiration (horizontal tabs: Apprendre, Créer, …). */
  const [inspirationCategoryTab, setInspirationCategoryTab] = useState<IdeaRoutineCategory>('LEARN');
  /** Category actually displayed (lags behind during fade-out transition). */
  const [inspirationDisplayedCategory, setInspirationDisplayedCategory] = useState<IdeaRoutineCategory>('LEARN');
  /** True while current content is fading out before switching category. */
  const [inspirationLeaving, setInspirationLeaving] = useState(false);
  /** True when new content has just mounted and should animate in (fade in + slide up). */
  const [inspirationEntering, setInspirationEntering] = useState(false);
  const [inspirationLoading, setInspirationLoading] = useState(false);
  /** En Mock UI ON : URLs des images réelles (data/images/) pour les cartes. */
  const [dataImageUrls, setDataImageUrls] = useState<string[]>([]);

  /** After tab switch: trigger enter animation (fade in + slide up) on next frame. */
  useEffect(() => {
    if (!inspirationEntering) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setInspirationEntering(false));
    });
    return () => cancelAnimationFrame(id);
  }, [inspirationEntering]);

  const fetchPage = useCallback(
    async ({
      tab,
      limit,
      cursor,
      reset,
    }: {
      tab: RitualTab;
      limit: number;
      cursor?: string | null;
      reset: boolean;
    }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          tab,
          limit: String(limit),
        });
        if (cursor) {
          params.set('cursor', cursor);
        }
        const response = await fetch(`/api/rituals/list?${params.toString()}`);
        if (!response.ok) {
          throw new Error('list_failed');
        }
        const payload = (await response.json()) as ListResponse;
        setItems((prev) =>
          reset ? payload.items ?? [] : [...prev, ...(payload.items ?? [])],
        );
        setNextCursor(payload.nextCursor ?? null);
        if (typeof payload.total === 'number') {
          setTotal(payload.total);
        }
      } catch {
        if (reset) {
          setItems([]);
          setNextCursor(null);
          setTotal(0);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadInitial = useCallback(() => {
    if (mockTabData != null) {
      const list = mockTabData[activeTab] ?? [];
      setItems(list);
      setTotal(list.length);
      setNextCursor(null);
      setLoading(false);
      return;
    }
    const limit = expanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT;
    fetchPage({ tab: activeTab, limit, cursor: null, reset: true });
  }, [mockTabData, activeTab, expanded, fetchPage]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (activeTab !== 'community') return;
    let cancelled = false;
    setInspirationLoading(true);
    (async () => {
      try {
        const [commRes, ideaRes] = await Promise.all([
          fetch(`/api/community-rituals?ui_locale=${encodeURIComponent(uiLocale)}`),
          fetch(`/api/idea-routines/list?limit=100`),
        ]);
        if (cancelled) return;
        const commData = commRes.ok ? ((await commRes.json()) as { categories?: Array<{ category: IdeaRoutineCategory; items: CommunityRitualV1[] }> }) : { categories: [] };
        const ideaData = ideaRes.ok ? ((await ideaRes.json()) as { items?: Array<{ id: string; category: IdeaRoutineCategory; title_en: string; intent_en: string; translations?: Record<string, { title: string; intent: string }> }> }) : { items: [] };
        const sections = commData.categories ?? [];
        setCommunitySections(sections);
        const allRoutines = ideaData.items ?? [];
        setAllIdeaRoutines(allRoutines);
        const firstCategoryWithRituals = CATEGORY_IDS.find((cat) => sections.some((s) => s.category === cat && s.items.length > 0)) ?? 'LEARN';
        setInspirationCategoryTab(firstCategoryWithRituals);
      } catch {
        if (!cancelled) {
          setCommunitySections([]);
          setAllIdeaRoutines([]);
          setIdeaChips([]);
          setIdeaChipsCategory(null);
        }
      } finally {
        if (!cancelled) setInspirationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, uiLocale]);

  /** En Mock UI ON : charger les URLs des images réelles (data/images/) pour afficher de vraies images sur les cartes. */
  useEffect(() => {
    if (mockTabData == null) {
      setDataImageUrls([]);
      return;
    }
    let cancelled = false;
    fetch('/api/images/list')
      .then((res) => (res.ok ? res.json() : { urls: [] }))
      .then((body: { urls?: string[] }) => {
        if (!cancelled && Array.isArray(body?.urls)) setDataImageUrls(body.urls);
      })
      .catch(() => {
        if (!cancelled) setDataImageUrls([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mockTabData]);

  /** Retirer le chip et marquer l’idée comme utilisée uniquement quand le rituel a été créé complètement (parcours créé). */
  useEffect(() => {
    if (!ideaIdUsedForRitual?.trim() || !ideaChipsCategory) return;
    const id = ideaIdUsedForRitual.trim();
    markIdeaUsed(uiLocale, ideaChipsCategory, id);
    setIdeaChips((prev) => prev.filter((c) => c.id !== id));
  }, [ideaIdUsedForRitual, ideaChipsCategory, uiLocale]);

  /** Idées du fallback pour la catégorie sélectionnée (inspirationCategoryTab). */
  useEffect(() => {
    if (activeTab !== 'community' || allIdeaRoutines.length === 0) return;
    const category = inspirationCategoryTab;
    setIdeaChipsCategory(category);
    const byCategory = allIdeaRoutines.filter((r) => r.category === category);
    const used = getUsedIdeaIds(uiLocale, category);
    const picked = pickRandom(byCategory, used, (r) => r.id, IDEA_CHIPS_COUNT);
    const locale = (uiLocale || 'en').slice(0, 2).toLowerCase();
    setIdeaChips(
      picked.map((r) => ({
        id: r.id,
        title: r.translations?.[locale]?.title ?? r.title_en,
        intent: r.translations?.[locale]?.intent ?? r.intent_en,
      })),
    );
  }, [activeTab, inspirationCategoryTab, allIdeaRoutines, uiLocale]);

  /** En mode mock : afficher directement mockTabData (filtré par removedMockIds). */
  const displayItems =
    mockTabData != null
      ? (mockTabData[activeTab] ?? []).filter((item) => !removedMockIds.has(item.id))
      : items;

  /** Image pour chaque carte : en Mock UI ON → data/images/ (vraies images), sinon imageUrl ou fallback SVG. */
  const displayItemsWithCovers = useMemo(() => {
    if (activeTab === 'community') return displayItems;
    const useDataImages = mockTabData != null && dataImageUrls.length > 0;
    return displayItems.map((item, index) => {
      const url = item.imageUrl?.trim();
      const imageUrl = useDataImages
        ? dataImageUrls[index % dataImageUrls.length]
        : (url || getCoverUrl(item.id));
      return { ...item, imageUrl };
    });
  }, [activeTab, displayItems, mockTabData, dataImageUrls]);

  const showViewAll =
    activeTab !== 'community' &&
    !expanded &&
    ((total ?? 0) > COLLAPSED_LIMIT || (displayItems.length >= COLLAPSED_LIMIT && !!nextCursor));

  const hasMore = expanded && !!nextCursor;

  const emptyCopy = useMemo(() => {
    if (activeTab === 'community') {
      return "L'inspiration arrive bientôt.";
    }
    if (activeTab === 'mine') {
      return 'Aucun projet pour le moment.';
    }
    return 'Aucun rituel en cours.';
  }, [activeTab]);

  const openRitualInMission = (ritualId: string) => {
    if (typeof window === 'undefined') {
      router.push('/mission?start=1&ready=1');
      return;
    }
    try {
      const raw = window.localStorage.getItem(buildRitualStorageKey(ritualId));
      if (raw) {
        const record = JSON.parse(raw) as {
          ritualId: string;
          intention: string;
          days: number;
          createdAt: string;
          path?: unknown;
          missions?: unknown[];
        };
        const snapshot = {
          ritualId: record.ritualId,
          intention: record.intention,
          days: record.days,
          proposal: null,
          createdAt: record.createdAt,
          lastActiveAt: new Date().toISOString(),
        };
        window.localStorage.setItem('loe.ritual', JSON.stringify(snapshot));
        if (record.path && record.missions) {
          window.localStorage.setItem(
            'loe.missionData',
            JSON.stringify({
              ritualId: record.ritualId,
              ritualKey: `${record.intention}::${record.days}`,
              generatedAt: new Date().toISOString(),
              path: record.path,
              missions: record.missions,
            }),
          );
        }
      }
      window.sessionStorage.setItem('loe.active_ritual_id', ritualId);
    } catch {
      // ignore
    }
    router.push('/mission?start=1&ready=1');
  };

  const handleRemove = async (ritualId: string) => {
    const isMock = ritualId.startsWith('mock-');
    if (isMock) {
      setRemovedMockIds((prev) => new Set(prev).add(ritualId));
      setTotal((prev) => (typeof prev === 'number' && prev > 0 ? prev - 1 : prev));
      return;
    }
    try {
      await fetch('/api/rituals/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ritualId }),
      });
    } catch {
      // ignore
    }

    setItems((prev) => prev.filter((item) => item.id !== ritualId));
    setTotal((prev) => (typeof prev === 'number' && prev > 0 ? prev - 1 : prev));

    if (typeof window !== 'undefined') {
      try {
        const rawIndex = window.localStorage.getItem(RITUAL_INDEX_KEY);
        if (rawIndex) {
          const parsed = JSON.parse(rawIndex) as RitualIndexItem[];
          const nextIndex = parsed.filter((item) => item.ritualId !== ritualId);
          window.localStorage.setItem(RITUAL_INDEX_KEY, JSON.stringify(nextIndex));
        }
        window.localStorage.removeItem(buildRitualStorageKey(ritualId));
        removeCachedImage(`ritual_${ritualId}`);
      } catch {
        // ignore
      }
    }
  };

  return (
    <section className={styles.historyShell}>
      <div className={styles.historyBox}>
        <div className={styles.historyHeader}>
          <Tabs
            tabs={[
              { id: 'in_progress', label: tabLabels.in_progress },
              { id: 'mine', label: tabLabels.mine },
              { id: 'community', label: tabLabels.community },
            ]}
            activeId={activeTab}
            onSelect={(id) => {
              setActiveTab(id as RitualTab);
              setExpanded(false);
            }}
          />
          {showViewAll && (
            <Button variant="text" type="button" onClick={() => setExpanded(true)}>
              Tout afficher →
            </Button>
          )}
        </div>

        {activeTab === 'community' ? (
          <>
            {inspirationLoading ? (
              <div className={styles.emptyState}>Chargement…</div>
            ) : (
              <>
                <div className={styles.inspirationCategoryTabs}>
                  <Tabs
                    tabs={CATEGORY_IDS.map((cat) => ({
                      id: cat,
                      label: tRec[`categoryLabel${cat.charAt(0) + cat.slice(1).toLowerCase()}`] ?? cat,
                    }))}
                    activeId={inspirationCategoryTab}
                    onSelect={(id) => {
                      const next = id as IdeaRoutineCategory;
                      if (next === inspirationDisplayedCategory) return;
                      setInspirationCategoryTab(next);
                      setInspirationLeaving(true);
                    }}
                  />
                </div>
                <div
                  className={`${styles.inspirationContentWrap} ${inspirationLeaving ? styles.inspirationContentLeaving : ''}`}
                  onTransitionEnd={() => {
                    if (inspirationLeaving) {
                      setInspirationDisplayedCategory(inspirationCategoryTab);
                      setInspirationLeaving(false);
                      setInspirationEntering(true);
                    }
                  }}
                >
                  <div
                    key={inspirationDisplayedCategory}
                    className={`${styles.inspirationContentInner} ${inspirationEntering ? styles.inspirationContentEntering : ''}`}
                  >
                    {(() => {
                      const section = communitySections.find((s) => s.category === inspirationDisplayedCategory);
                      const items = section?.items ?? [];
                      const useDataImages = mockTabData != null && dataImageUrls.length > 0;
                      return items.length > 0 ? (
                        <div className={styles.inspirationSection}>
                          <div className={styles.grid}>
                            {items.map((ritual, index) => (
                              <CommunityRitualCard
                                key={ritual.id}
                                ritual={ritual}
                                imageUrl={useDataImages ? dataImageUrls[index % dataImageUrls.length] : (ritual.image_ref ? `/mock/covers/${ritual.image_ref}.svg` : getCoverUrl(ritual.id))}
                                joinLabel={tRec.inspirationJoin ?? 'Rejoindre'}
                                progressLabel={tRec.inspirationCommunityProgress ?? 'Community progress'}
                                onJoin={(r) => {
                                  onJoinCommunityRitual?.(r);
                                }}
                                useMockAvatars={mockTabData != null}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className={styles.emptyState}>Aucun rituel dans cette catégorie.</div>
                      );
                    })()}
                    {ideaChips.length > 1 && (
                      <div className={styles.inspirationFallback}>
                        <h3 className={styles.inspirationFallbackTitle}>
                          {tRec.inspirationFallbackTitle ?? "Tu ne trouves pas ton bonheur ?"}
                        </h3>
                        <p className={styles.inspirationFallbackSubtitle}>
                          {tRec.inspirationFallbackSubtitle ?? "Crée ton propre rituel à partir d'une de ces idées"}
                        </p>
                        <div className={styles.inspirationChips}>
                          {ideaChips.map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              className={styles.inspirationChip}
                              onClick={() => {
                                document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
                                onPrefillIntent?.(chip.intent, 21, chip.id);
                              }}
                            >
                              {chip.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        ) : displayItems.length === 0 && !loading ? (
          <div className={styles.emptyState}>{emptyCopy}</div>
        ) : (
          <div className={styles.grid}>
            {displayItemsWithCovers.map((item) => (
              <RitualCard key={item.id} item={item} onOpen={openRitualInMission} onRemove={handleRemove} />
            ))}
          </div>
        )}

        {loading && displayItems.length > 0 && <div className={styles.loadingNote}>Chargement…</div>}

        {hasMore && !loading && (
          <Button
            variant="secondary"
            className={styles.loadMore}
            type="button"
            onClick={() =>
              fetchPage({
                tab: activeTab,
                limit: LOAD_MORE_LIMIT,
                cursor: nextCursor,
                reset: false,
              })
            }
          >
            Charger plus
          </Button>
        )}
      </div>
    </section>
  );
}
