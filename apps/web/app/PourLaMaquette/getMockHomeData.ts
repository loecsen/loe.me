/**
 * Point d'entrée unique des données maquette pour la Home.
 * Pas de logique métier : retourne uniquement les données.
 * Avatars : https://i.pravatar.cc/100?img=${seed} (1..70) — géré dans mockRituals/mockFriends.
 * Covers rituels en cours : injectées à l'affichage dans RitualHistory (getCoverUrl) quand imageUrl null.
 */

import { mockRitualsByTab } from './mockRituals';

export function getMockHomeData() {
  return {
    tabs: mockRitualsByTab,
  };
}
