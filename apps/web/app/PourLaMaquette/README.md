# PourLaMaquette

Données fictives pour la maquette Home. **Nettoyable en 1 commit** quand les vraies données sont branchées.

## Règles

- **Tout le mock vit UNIQUEMENT ici** : `apps/web/app/PourLaMaquette/`
- **Aucun fichier en dehors** de ce dossier ne doit importer `../PourLaMaquette/...` (sauf le point d’entrée Home)
- **Composants métier** (RitualCard, RitualHistory, etc.) restent 100 % data-driven (props), aucune logique mock dedans
- **Un seul point d’entrée** qui choisit mock vs vrai : **Home** (`apps/web/app/page.tsx`)

## Fichiers

- **mockFriends.ts** — Profils anglophones (id, fullName, avatarSeed 1..70, stepCurrent, stepTotal, progressPct)
- **mockCovers.ts** — (optionnel) URLs de placeholders locaux ; en maquette on utilise `imageUrl: null` pour afficher les PNG liés aux rituels.
- **mockRituals.ts** — `mockRitualsByTab` = { in_progress, mine, community }. 6 cartes inProgress, avatars via pravatar, **imageUrl: null** pour que RitualCard utilise PlanImage → génération/récupération du PNG (cache `ritual_${id}`)
- **getMockHomeData.ts** — Point d’entrée unique : `getMockHomeData()` retourne `{ tabs: mockRitualsByTab }` (pas de logique métier)

## Switch mock vs API

- **Toggle** : en dev (ou `NEXT_PUBLIC_SHOW_DEV_TOOLS=1`), bouton « Mock UI: ON/OFF » à côté des liens admin ; état persisté dans `localStorage` (loe_mock_ui) et priorité à `?mock=1` en URL.
- **Env** : `NEXT_PUBLIC_USE_MOCKS=1` force aussi les données maquette.
- **Où** : le choix est fait uniquement dans `page.tsx` ; RitualHistory reçoit `mockTabData` en prop (ou `null`).

## Images (séparation maquette / métier)

- **RitualCard** ne fait aucune logique image : il reçoit `imageUrl` (string) et l’affiche ; si absent (vrai flux), fallback existant (PlanImage) est conservé.
- **Quand Mock UI est ON** : les items ont `imageUrl: null`. RitualCard affiche donc PlanImage (ritualId, title) qui génère ou récupère depuis le cache le **PNG** lié au rituel (clé `ritual_${id}`). Au premier chargement les images peuvent se générer (placeholder mauve bref), puis le PNG s’affiche et est mis en cache.
- **Covers maquette** : pas de SVG/placeholders — on veut les PNG des images liées aux rituels, donc `imageUrl: null` et PlanImage fait le travail (même flux que le vrai).
- **Avatars maquette** : `avatarUrl: https://i.pravatar.cc/100?img=${seed}` avec seed 1..70 dans mockFriends (pas de doublons de seed).

## Anti-fuite

- Le script `npm run lint:ui-rules` échoue si un fichier **hors** `PourLaMaquette/` importe PourLaMaquette (sauf `page.tsx`).

## Suppression

Supprimer ce dossier + dans `page.tsx` : l’import de `getMockHomeData`, la constante `mockTabData`, et la prop `mockTabData` passée à RitualHistory. Dans RitualHistory : retirer la prop `mockTabData` et la branche qui l’utilise.
