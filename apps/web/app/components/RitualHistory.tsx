'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Tabs } from '@loe/ui';
import styles from './RitualHistory.module.css';
import RitualCard, { type RitualCardItem } from './RitualCard';
import { removeCachedImage } from '../lib/images/imageCache';
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
};

export default function RitualHistory({ mockTabData = null }: RitualHistoryProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<RitualTab>('in_progress');
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<RitualCardItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  /** En mode mock : IDs des cartes retirées (mockTabData est lecture seule) */
  const [removedMockIds, setRemovedMockIds] = useState<Set<string>>(() => new Set());

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

  /** En mode mock : afficher directement mockTabData (filtré par removedMockIds) pour éviter un rendu sans imageUrl */
  const displayItems =
    mockTabData != null
      ? (mockTabData[activeTab] ?? []).filter((item) => !removedMockIds.has(item.id))
      : items;

  const showViewAll =
    !expanded && ((total ?? 0) > COLLAPSED_LIMIT || (displayItems.length >= COLLAPSED_LIMIT && !!nextCursor));

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

        {displayItems.length === 0 && !loading ? (
          <div className={styles.emptyState}>{emptyCopy}</div>
        ) : (
          <div className={styles.grid}>
            {displayItems.map((item) => (
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
