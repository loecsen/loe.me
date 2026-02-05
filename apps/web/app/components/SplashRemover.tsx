'use client';

import { useEffect } from 'react';

const SPLASH_ID = 'loe-splash';
const DISPLAY_MS = 2500;
const FADE_MS = 500;

/**
 * Supprime le splash preloader (bleu « Stop scroll. Act. ») après affichage.
 * Le splash est rendu en HTML initial dans le layout pour être visible avant le reste.
 */
export default function SplashRemover() {
  useEffect(() => {
    const el = document.getElementById(SPLASH_ID);
    if (!el) return;
    const t1 = setTimeout(() => el.classList.add('loe-splash-out'), DISPLAY_MS);
    const t2 = setTimeout(() => el.remove(), DISPLAY_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  return null;
}
