# UI Blueprint — Design Tokens + composants

Ce document décrit les conventions UI de Loe.me pour une base transposable vers Flutter (Design Tokens + composants).

---

## 1. Source de vérité des tokens

- **Fichier** : `packages/ui/src/tokens.json`
- **Contenu** : `colors` (sémantiques), `spacing`, `radius`, `shadows`, `typography`
- **Export** :
  - **Web** : variables CSS dans `packages/ui/src/styles.css` (`:root { --loe-* }`)
  - **TypeScript** : `packages/ui/src/tokens.ts` importe le JSON et ré-exporte

Conventions de nommage des tokens :
- Couleurs : `--loe-color-<role>` (ex. `--loe-color-background`, `--loe-color-muted`)
- Espacements : `--loe-space-<size>` (xxs, xs, sm, md, lg, xl, xxl, huge)
- Radius : `--loe-radius-<size>` (xs, sm, md, lg, pill)
- Ombres : `--loe-shadow-<role>` (sm, md, lg, focus, card, card-hover)
- Typo : `--loe-font-*`, `--loe-line-height-*`, `--loe-font-weight-*`

---

## 2. Créer un composant UI

1. **Emplacement** : composants réutilisables et basés uniquement sur les tokens → `packages/ui/src/components.tsx` (ou nouveau fichier dans `packages/ui/src/`).
2. **Styles** : utiliser **uniquement** des variables `var(--loe-*)` dans les classes (définies dans `packages/ui/src/styles.css`) ou des classes existantes `.loe-*`.
3. **Pas de** : couleurs hex, `rgba`/`hsl` en dur, `px` arbitraires hors échelle de tokens (spacing/radius).
4. **Props** : exposer `className` optionnel pour surcharge sans casser le design système.

Exemple de composant conforme :
```tsx
<button className="loe-button loe-button--secondary">Label</button>
```
Les classes `.loe-button` et `.loe-button--secondary` sont définies dans `styles.css` avec uniquement `var(--loe-*)`.

---

## 3. Règles « interdit »

- **Couleurs** : pas de `#hex`, `rgb()`, `rgba()`, `hsl()` en dur dans les composants UI (`packages/ui/`) ni dans les modules CSS des écrans migrés vers les tokens ; utiliser `var(--loe-color-*)`.
- **Espacements / radius** : pas de `px` arbitraires ; utiliser l’échelle (`var(--loe-space-*)`, `var(--loe-radius-*)`).
- **Inline styles** : pas de `style={{ ... }}` dans les composants UI (sauf exception documentée, ex. variable CSS dynamique type `--progress` pour un slider).
- **Ombres** : pas d’ombres en dur ; utiliser `var(--loe-shadow-*)`.

Exceptions documentées :
- `style={{ '--progress': `${value}%` } as React.CSSProperties}` pour contrôles de type slider (variable CSS custom).
- Composants legacy en cours de migration : tolérés temporairement en dehors de `packages/ui/` jusqu’à refactor.

---

## 4. Garde-fous (lint)

- **stylelint** (ou règle custom) : dans `packages/ui/src/**/*.css`, interdire les couleurs hex/rgba/hsl en dur (forcer `var(--loe-*)`).
- **ESLint** : dans `packages/ui/src/**/*.tsx`, interdire `style={{ ... }}` sauf si un commentaire `// eslint-disable-next-line ...` avec référence à cette doc.

Voir `.eslintrc.*` et `stylelint.config.*` à la racine ou dans `packages/ui/`.

---

## 5. Migration vers Flutter

- **Tokens** : `tokens.json` peut être lu par un script ou du code Flutter pour construire un `ThemeData` (couleurs, `TextTheme`, espacements, radius, ombres).
- **Composants** : Button, Card, Tabs ont des équivalents logiques (Widgets) qui consomment le thème ; pas de logique métier dans les composants UI, uniquement présentation + tokens.
