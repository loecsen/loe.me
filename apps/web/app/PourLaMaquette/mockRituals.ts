/**
 * Données fictives pour la maquette Home — scénarios exacts type Lovable.
 * À supprimer quand les vraies données sont branchées.
 */

import type { RitualCardItem } from '../components/RitualCard';
import type { FriendInTooltip } from '../components/FriendsTooltip';
import { mockFriends, type MockFriend } from './mockFriends';

const PRAVATAR_BASE = 'https://i.pravatar.cc/100';

/** imageUrl à null : en mock, RitualHistory injecte une cover du répertoire à l'affichage (getCoverUrl). */

function toFriendInTooltip(
  m: MockFriend,
  avatarUrl: string | null = null,
): FriendInTooltip {
  const url = avatarUrl ?? `${PRAVATAR_BASE}?img=${Math.min(70, Math.max(1, m.avatarSeed))}`;
  return {
    id: m.id,
    name: m.fullName,
    avatarUrl: url,
    stepCurrent: m.stepCurrent,
    stepTotal: m.stepTotal,
  };
}

function pickFriends(count: number, offset: number = 0): FriendInTooltip[] {
  if (count <= 0) return [];
  return mockFriends
    .slice(offset, offset + count)
    .map((m) => toFriendInTooltip(m));
}

function todayStartISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** 6 cartes "inProgress" comme Lovable — A à F */
function buildMockInProgress(): RitualCardItem[] {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  return [
    {
      id: 'mock-spanish-a2',
      title: 'Spanish A2 grammar in 30 days',
      imageUrl: null,
      lastViewedAt: new Date(now - 2 * oneDayMs).toISOString(),
      status: 'ready',
      levelCurrent: 2,
      levelTotal: 5,
      progressPct: 40,
      stepCurrent: 12,
      stepTotal: 30,
      friends: pickFriends(5, 0),
      followerCount: 1247,
      rating: 4.5,
      reviewCount: 342,
    },
    {
      id: 'mock-pizzas',
      title: 'Learn to make pizzas in 14 days',
      imageUrl: null,
      lastViewedAt: new Date(now - 3 * oneDayMs).toISOString(),
      status: 'ready',
      levelCurrent: 1,
      levelTotal: 3,
      progressPct: 36,
      stepCurrent: 5,
      stepTotal: 14,
      friends: pickFriends(10, 5),
      followerCount: 3892,
      rating: 4.8,
      reviewCount: 1024,
    },
    {
      id: 'mock-soccer',
      title: 'Learn to play soccer in 14 days',
      imageUrl: null,
      lastViewedAt: new Date(now - 3 * oneDayMs).toISOString(),
      status: 'ready',
      levelCurrent: 3,
      levelTotal: 4,
      progressPct: 57,
      stepCurrent: 8,
      stepTotal: 14,
      friends: pickFriends(30, 15),
      followerCount: 8421,
      rating: 4.2,
      reviewCount: 2156,
    },
    {
      id: 'mock-meditation',
      title: 'Meditation for beginners in 21 days',
      imageUrl: null,
      lastViewedAt: todayStartISO(),
      status: 'ready',
      levelCurrent: 2,
      levelTotal: 3,
      progressPct: 71,
      stepCurrent: 15,
      stepTotal: 21,
      friends: pickFriends(1, 45),
      followerCount: 15230,
      rating: 4.9,
      reviewCount: 4521,
    },
    {
      id: 'mock-organized',
      title: 'Get organized in 10 minutes a day (14 days)',
      imageUrl: null,
      lastViewedAt: new Date(now - 3 * oneDayMs).toISOString(),
      status: 'ready',
      levelCurrent: 1,
      levelTotal: 2,
      progressPct: 21,
      stepCurrent: 3,
      stepTotal: 14,
      friends: pickFriends(50, 46),
      followerCount: 6782,
      rating: 4.1,
      reviewCount: 1890,
    },
    {
      id: 'mock-drawing',
      title: 'Learn digital drawing in 7 days',
      imageUrl: null,
      lastViewedAt: new Date(now - 1 * oneDayMs).toISOString(),
      status: 'ready',
      levelCurrent: 2,
      levelTotal: 2,
      progressPct: 86,
      stepCurrent: 6,
      stepTotal: 7,
      friends: [],
      followerCount: 2341,
      rating: 4.6,
      reviewCount: 687,
    },
  ];
}

export const mockRitualsByTab: {
  in_progress: RitualCardItem[];
  mine: RitualCardItem[];
  community: RitualCardItem[];
} = {
  in_progress: buildMockInProgress(),
  mine: [],
  community: [],
};
