# Audit CSS — Préparation Flutter (reprise)

## 1. Fichiers CSS existants

| Fichier | Rôle | Tokens (var(--loe-*)) |
|---------|------|------------------------|
| **apps/web/app/globals.css** | ~1240 lignes. Reset (*, body, a), shell, header, modals, forms, mission, admin, debug, etc. | Partiel : beaucoup de `var(--loe-*)` mais ~400+ valeurs hardcodées (hex, rgba, px). |
| **apps/web/app/page.module.css** | Home (formulaire rituel, hero, pills, CTA). | Aucun : 100 % hex/rgba/px. |
| **apps/web/app/components/RitualHistory.module.css** | Historique rituels (tabs, grille, cartes, empty state). | Aucun : 100 % hex/rgba/px. |
| **packages/ui/src/styles.css** | Source des tokens (`:root`), thème dark, composants `.loe-*`. | 100 % tokens. |

**Ordre d’import (layout.tsx)** : `@loe/ui/styles.css` puis `./globals.css` → les variables `--loe-*` sont disponibles dans globals.

---

## 2. Styles globaux “à risque” (qui fuient)

- **`*`** : `box-sizing: border-box` — OK, reset standard.
- **`body`** : margin, background gradient, color, font — OK.
- **`a`** : `color: inherit; text-decoration: none` — s’applique à tous les liens du site.
- **Classes globales génériques** : tout le reste est en classes (`.app-shell`, `.hero`, `.nav`, `.card`, `.chip`, `.modal-*`, etc.). Risque : réutilisation accidentelle du même nom de classe ailleurs (ex. un autre `.card`) → style appliqué sans le vouloir. Pas de scope par page/composant.

Recommandation (hors scope de cette étape) : à terme, préférer des préfixes ou CSS Modules pour les blocs réutilisables pour éviter les collisions.

---

## 3. Valeurs hardcodées (exemples)

- **Couleurs** : `#ffffff`, `#e8e8f7`, `#cd82a0`, `#1b1f24`, `#c7b8ff`, `#e9edf4`, `#edf0f4`, `#f3f4f8`, `#f5f7fb`, `#4c5561`, `#6c7380`, `#7c858f`, `#9aa2ac`, `#1d2430`, etc.
- **Espacements** : `6px`, `8px`, `10px`, `12px`, `14px`, `16px`, `18px`, `20px`, `24px`, `26px`, `28px`, `36px`, `48px`, `50px`, `56px`, `72px`, `120px`, `160px`, etc.
- **Radius** : `50%`, `6px`, `8px`, `10px`, `12px`, `16px`, `18px`, `22px`, `24px`, `28px`, `999px`.
- **Ombres** : nombreuses répétitions de `0 12px 24px rgba(31, 41, 55, 0.05)`, `0 18px 32px rgba(...)`, etc.

Les tokens dans `@loe/ui` couvrent déjà une bonne partie (couleurs sémantiques, spacing, radius, shadows, typo) ; il manque notamment :
- dégradé body (`#e8e8f7`, `#cd82a0`) ;
- variantes de bordures/panneaux (`#e9edf4`, `#edf0f4`) ;
- radius 12px si on veut l’aligner (ex. debug-panel).

---

## 4. Plan minimal (3–5 petits commits)

1. **Commit 1 — Tokens**  
   Centraliser les design tokens : confirmer que la source unique est `@loe/ui/styles.css` (déjà importé avant globals), ajouter en tête de `globals.css` un commentaire qui le précise, et ajouter dans `@loe/ui` les tokens manquants utilisés par globals (ex. gradient body, bordure panneau, radius 12px).  
   Appliquer **3 remplacements safe** dans `globals.css` : 1 couleur → `var(--loe-color-*)`, 1 radius → `var(--loe-radius-*)`, 1 spacing → `var(--loe-space-*)`.

2. **Commit 2 — Réduire les fuites (optionnel, plus tard)**  
   Scoper ou renommer les classes globales les plus génériques (ex. `.card`, `.chip`) pour éviter les collisions, ou déplacer des blocs vers des CSS Modules.

3. **Commit 3 — Couleurs (progressif)**  
   Remplacer progressivement dans `globals.css` les hex/rgba par `var(--loe-color-*)` sans changer le rendu.

4. **Commit 4 — Espacements et radius (progressif)**  
   Remplacer les px d’espacement et de radius par `var(--loe-space-*)` et `var(--loe-radius-*)`.

5. **Commit 5 — Modules (progressif)**  
   Dans `page.module.css` et `RitualHistory.module.css`, introduire les variables `--loe-*` à la place des valeurs en dur (couleurs, espacements, radius, typo).

---

## 5. Ce qui a été fait dans cette reprise

- **Étape 1 (tokens)** : Commentaire en tête de `globals.css` ; ajout dans `packages/ui` (tokens.json + styles.css) des tokens manquants : `gradientBodyMid`, `gradientBodyEnd`, `borderPanel`, `borderPanelAlt`, `radius.panel` (12px). Body utilise désormais le dégradé via variables.
- **3 remplacements safe (exemples)** dans `globals.css` :
  - **Couleur** : `.locale-toggle` et `.user-pill` `background: #ffffff` → `var(--loe-color-background)` ; body gradient → `var(--loe-color-background)`, `var(--loe-color-gradient-body-mid)`, `var(--loe-color-gradient-body-end)`.
  - **Spacing** : `.user-pill` `gap: 8px` et `padding: 8px` → `var(--loe-space-xs)` ; `.debug-panel` right/bottom/padding → `var(--loe-space-md)` / `var(--loe-space-sm)`.
  - **Radius** : `.debug-panel` `border-radius: 12px` → `var(--loe-radius-panel)`.

Aucun changement de layout visuel intentionnel.
