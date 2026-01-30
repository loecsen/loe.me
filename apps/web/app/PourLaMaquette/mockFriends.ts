/**
 * Données fictives pour la maquette Home.
 * À supprimer quand les vraies données (amis / followers) sont branchées.
 * Noms anglophones, variés, sans doublons.
 */

export type MockFriend = {
  id: string;
  fullName: string;
  avatarSeed: number; // 1..70 pour avatar déterministe
  stepCurrent: number;
  stepTotal: number;
  progressPct: number; // cohérent: arrondi(stepCurrent/stepTotal*100)
};

const firstNames = [
  'Olivia', 'Ethan', 'Ava', 'Noah', 'Mia', 'Liam', 'Emma', 'Oliver', 'Sophia', 'Lucas',
  'Isabella', 'Mason', 'Charlotte', 'Elijah', 'Amelia', 'James', 'Harper', 'Benjamin', 'Evelyn', 'Henry',
  'Abigail', 'Alexander', 'Emily', 'Sebastian', 'Ella', 'Jack', 'Scarlett', 'Aiden', 'Grace', 'Owen',
  'Chloe', 'Samuel', 'Victoria', 'Matthew', 'Riley', 'Joseph', 'Aria', 'Levi', 'Lily', 'Mateo',
  'Zoey', 'David', 'Penelope', 'John', 'Layla', 'Luke', 'Nora', 'Anthony', 'Camila', 'Dylan',
];

const lastNames = [
  'Carter', 'Brooks', 'Mitchell', 'Turner', 'Collins', 'Stewart', 'Morris', 'Rogers', 'Reed', 'Cook',
  'Morgan', 'Bell', 'Murphy', 'Bailey', 'Rivera', 'Cooper', 'Richardson', 'Cox', 'Howard', 'Ward',
  'Torres', 'Peterson', 'Gray', 'Ramirez', 'James', 'Watson', 'Brooks', 'Kelly', 'Sanders', 'Price',
  'Bennett', 'Wood', 'Barnes', 'Ross', 'Henderson', 'Coleman', 'Jenkins', 'Perry', 'Powell', 'Long',
  'Patterson', 'Hughes', 'Flores', 'Washington', 'Butler', 'Simmons', 'Foster', 'Gonzales', 'Bryant', 'Alexander',
];

function buildMockFriends(): MockFriend[] {
  const seen = new Set<string>();
  const out: MockFriend[] = [];
  let id = 1;
  for (const first of firstNames) {
    for (const last of lastNames) {
      const fullName = `${first} ${last}`;
      if (seen.has(fullName)) continue;
      seen.add(fullName);
      const stepTotal = [7, 14, 21, 30][id % 4] as number;
      const stepCurrent = Math.min(stepTotal, Math.max(0, Math.floor((id / 80) * stepTotal)));
      const progressPct = stepTotal > 0 ? Math.round((stepCurrent / stepTotal) * 100) : 0;
      out.push({
        id: `mock-friend-${id}`,
        fullName,
        avatarSeed: (id % 70) + 1,
        stepCurrent,
        stepTotal,
        progressPct,
      });
      if (out.length >= 100) return out;
      id += 1;
    }
  }
  return out;
}

export const mockFriends: MockFriend[] = buildMockFriends();
