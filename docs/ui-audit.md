# Audit CSS — Loe.me

## 1. Stratégie CSS actuelle

| Approche | Fichiers | Usage |
|----------|----------|--------|
| **Global** | `apps/web/app/globals.css` (~2135 lignes) | Layout, shell, modals, mission, forms. Importe `@loe/ui/styles.css`. |
| **CSS Modules** | `page.module.css`, `RitualHistory.module.css` | Home (form, CTA, pills), RitualHistory (grille, tabs, cards). Aucune variable `--loe-*`. |
| **Tailwind** | — | **Non utilisé** (absent de `package.json`). |
| **Inline** | `page.tsx`, `MissionPlayer.tsx`, `MissionDashboard.tsx`, `ritual/[id]/page.tsx`, `admin/safety/page.tsx` | `style={{}}` pour `--progress`, marges, flex, opacité. |

**Packages UI** : `packages/ui` expose `tokens.ts` (couleurs, radius, spacing, typo), `styles.css` (variables `:root`), `components.tsx` (Container, Surface, Pill) avec **inline styles** utilisant `var(--loe-*)` et quelques valeurs en dur (px, rgba).

---

## 2. Incohérences

- **Couleurs** : `globals.css` mélange `var(--loe-color-*)` et hex/rgba (#ffffff, #f3f4f8, #c7b8ff, #1b1f24, rgba(31,41,55,0.08), etc.). Les modules (`page.module.css`, `RitualHistory.module.css`) sont 100 % hex/rgba (#141428, #7b56ff, #eef1f5, #1d2430, #9aa2ac…).
- **Espacements** : variables `--loe-space-*` dans globals ; px en dur dans modules (10px, 14px, 20px, 24px, 35px…) et dans `components.tsx` (6px, 14px).
- **Radius** : variables `--loe-radius-*` dans globals ; valeurs en dur dans modules (10px, 16px, 20px, 999px).
- **Ombres** : aucune variable `--loe-shadow-*` ; ombres partout en dur (0 12px 24px rgba(…), 0 18px 36px rgba(…)).
- **Typo** : variables `--loe-font-*` dans globals ; tailles/poids en dur dans modules (14px, 15px, font-weight: 600).
- **Duplications** : blanc #ffffff, gris (#9aa2ac, #7b8190, #1d2430), violet (#7b56ff, #c7b7ff), bordures #eef1f5 / #edf0f5 répétées.

---

## 3. Choix cible : **B) CSS variables + CSS Modules**

**Justification (5 lignes)** :

1. Les tokens existent déjà en CSS vars dans `@loe/ui/styles.css` ; pas de nouveau framework.
2. Une seule source de vérité (JSON) peut alimenter le web (CSS vars) et Flutter (ThemeData) sans couplage Tailwind.
3. Les CSS Modules permettent de garder des classes sémantiques et d’utiliser uniquement `var(--loe-*)` ; migration progressive possible.
4. Règles de verrouillage simples (stylelint / ESLint) : interdire hex et `style={{}}` dans les composants UI.
5. Tailwind imposerait une couche build + nomenclature de classes peu transposable telle quelle en Flutter.

**Approche retenue** : Tokens en JSON → export CSS variables + constantes TS. Composants UI (Button, Card, Tabs) en CSS Modules ou classes globales basées uniquement sur ces variables. Migration pilote sur un écran (Home) puis documentation et lint.
