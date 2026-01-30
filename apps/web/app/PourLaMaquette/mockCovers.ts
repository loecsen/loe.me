/**
 * URLs des images de couverture pour la maquette Home.
 * Uniquement des assets locaux : zéro appel réseau, zéro régénération.
 * RitualCard reçoit imageUrl et l’affiche tel quel quand Mock UI est ON.
 */

const BASE = '/mock/covers';

/** Covers maquette : un par carte inProgress, tous locaux */
export const MOCK_COVER_URLS = [
  `${BASE}/spanish.svg`,
  `${BASE}/pizza.svg`,
  `${BASE}/soccer.svg`,
  `${BASE}/meditation.svg`,
  `${BASE}/organize.svg`,
  `${BASE}/drawing.svg`,
] as const;

/** Retourne l’URL de cover pour la carte mock à l’index donné (0..5). */
export function getMockCoverUrl(index: number): string {
  const i = Math.max(0, Math.min(index, MOCK_COVER_URLS.length - 1));
  return MOCK_COVER_URLS[i] as string;
}
