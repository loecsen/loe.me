# Analyse : Prochain dev « UX instant + progressive » (routine)

## Verdict global

**Oui, le spec est cohérent avec la logique actuelle**, à quelques points à trancher (qui déclenche la génération, synchrone vs asynchrone) et à des ajouts techniques clairs (nouvelle route, endpoint status, skeleton path). Rien ne bloque.

---

## 1. Flux actuel (à faire évoluer)

- **Home** : à la validation projet, on crée un `ritualId` (UUID), on met en `sessionStorage` la clé `loe.pending_ritual_request` (intention, days, ritualId, …), puis **redirection** vers  
  **`/mission/<slug>-<shortId>?ritualId=${ritualId}`**.
- **Page /mission** : si `creating=1`, elle lit le pending en session, affiche l’écran « Ton rituel prend forme » + spinner (aucun node), lance **un seul** `POST /api/missions/generate` et attend la réponse.
- Quand **generate** répond : la page construit le `RitualRecord`, écrit dans `localStorage` (ritual, missionData, index), puis **replace** vers `/mission?start=1&ready=1`.
- Au re-render, `creating` n’est plus dans l’URL → rendu de **`<MissionDashboard />`** qui lit `loe.missionData` et affiche la carte avec vrais steps.

Donc aujourd’hui : **une seule URL /mission** (avec query), **pas de nodes** pendant la génération, **une seule requête bloquante** jusqu’à ce que tout soit prêt.

---

## 2. Points du spec alignés avec l’existant

- **Pipeline generate** : plan + stubs + 1 mission full + écriture `ritual_${ritualId}.json` + index ndjson → déjà en place.
- **totalSteps = days**, **stepsPerLevel = 7**, **normalizeRitualPlan** → OK.
- **mission/next** en lazy pour les missions suivantes → OK.
- **MissionMapLovable** : reçoit `levels` (path.blueprint.levels) et en déduit le nombre de steps → pour l’« instant », il suffit de lui fournir un **path skeleton** avec `totalSteps` steps (titres placeholder), sans casser la logique actuelle.
- **RitualRecord / MissionData** : structure déjà adaptée à « path + missionStubs + missions » ; le passage à une URL du type `/mission/<slug>-<shortId>` + chargement progressif ne change pas ces modèles.

---

## 3. Changements à prévoir (résumé)

### 3.1 Routing / URL

- **Objectif** : après validation sur la Home, rediriger vers **`/mission/<slug>-<shortId>`** (URL stable).
- **Implémentation** :
  - **Slug** : dérivé du titre (intention ou `pathTitle` une fois connu) ; une fonction `slugify` existe déjà côté generate (`route.ts`). À réutiliser ou centraliser (ex. `lib/slugify.ts`).
  - **ShortId** : pour éviter collisions sans incrément. Options :
    - Premier segment (ex. 8 caractères) du `ritualId` UUID, ou
    - Id court dédié (nanoid) stocké en sessionStorage / query avec `ritualId`.
  - **RitualId** : à garder en query au moins pendant la transition, ex. `/mission/espagnol-a1-abc12?ritualId=<uuid>`, pour que la page sache quel rituel interroger (status, chargement). Optionnel : un endpoint **GET /api/rituals/by-short-id/[shortId]** qui renvoie `ritualId` (ou le payload minimal) si tu veux une URL sans query.
- **Fichiers** :  
  - **`app/page.tsx`** : au lieu de `router.push(\`/mission?creating=1&ritualId=${ritualId}\`)`, construire `slug` + `shortId` et faire `router.push(\`/mission/${slug}-${shortId}?ritualId=${ritualId}\`)` (et continuer à mettre le pending en sessionStorage).  
  - **Nouvelle route** : **`app/mission/[slugId]/page.tsx`** (ou `app/mission/[[...slugId]]/page.tsx` selon préférence) pour gérer `/mission/<slug>-<shortId>` et éventuellement garder `/mission` en fallback (redirect ou liste).

### 3.2 Placeholder immédiat (N nodes)

- **Objectif** : dès l’arrivée sur `/mission/...`, afficher **N = totalSteps** nodes, avec label **« Mission en création… »** si le stub n’est pas dispo, **min-width 130px**, **pill + pulse léger**.
- **Logique** :
  - Tant qu’on n’a pas de `path` complet (ritual pas prêt), construire un **path skeleton** :
    - `days` (donc N) vient du pending (sessionStorage) ou de la query.
    - Structure : `levels` avec `stepsPerLevel = 7`, steps `step-1-1`, `step-1-2`, … avec `title: "Mission en création…"`, `missionId` temporaire ou vide.
  - Passer ce path (ou un `LearningPathState` dérivé) à **MissionDashboard** / **MissionMapLovable** comme d’habitude. MissionMapLovable affiche déjà les labels par step ; il suffit d’afficher le placeholder quand `title` est ce texte (ou quand `contentStatus === 'generating'` / pas de stub).
- **Fichiers** :
  - **`app/mission/page.tsx`** ou **`app/mission/[slugId]/page.tsx`** : construire le skeleton à partir de `days` (pending ou query), injecter dans le même état que d’habitude (path + missions vides/placeholder).
  - **MissionMapLovable** (et son CSS) : pour les steps sans vrai titre, afficher « Mission en création… », **min-width: 130px**, **animation pulse** (déjà des keyframes pulse côté actif ; ajouter une variante plus douce pour ce placeholder).

### 3.3 Encart « Préparation de ta routine… »

- **Objectif** : sous le header, une card blanche tant que **status !== ready** : texte « Préparation de ta routine… », « Cela peut prendre plusieurs minutes », et 3 étapes UI (analyse / plan / premières missions).
- **Implémentation** : composant dédié (ex. `RoutinePreparingBanner` ou section dans la page mission), affiché quand `creatingStatus === 'generating'` ou quand le polling renvoie `status: 'pending'`. Masqué dès `ready` (ou quand on a le ritual complet).
- **Fichiers** : nouveau composant (ex. dans `app/mission/` ou `components/`) + intégration dans la page mission (ou dans MissionDashboard si la logique « creating » y est centralisée).

### 3.4 Mécanisme de statut et polling

- **Objectif** : **GET /api/rituals/[id]/status** renvoyant `{ status: "pending"|"ready"|"error", progress?: 0..1, lastStepReady?: number }`, et sur la page mission **polling toutes les 1.5 s** tant que `pending`.
- **Cohérence avec l’existant** :
  - Aujourd’hui **generate** est **synchrone** : la requête ne répond qu’une fois le ritual écrit. Donc tant qu’on garde ce comportement, il n’y a **pas** de « pending » côté serveur : soit le fichier existe (ready), soit il n’existe pas (404 / error).
  - Pour avoir un vrai **pending** et du polling utile, il faudrait soit :
    - **Option A** : que **generate** retourne très tôt (ex. **202 Accepted** + `ritualId`) et fasse le travail en arrière-plan (worker, job queue, ou même « fire-and-forget » dans le même process). Puis **GET status** lit un fichier ou une table « ritual en cours » (ex. `ritual_${id}.pending`) et passe à `ready` quand `ritual_${id}.json` est écrit.
    - **Option B** : garder generate synchrone ; la page mission affiche tout de suite le skeleton + encart, lance **un seul** fetch generate. Pas de polling : à la résolution du fetch, on passe directement à « ready » et on affiche confetti + popup. L’endpoint **GET status** peut exister pour une future évolution (ex. génération asynchrone plus tard).
- **Recommandation** : pour le prochain dev, **Option B** est la plus simple et respecte déjà « instant + progressive » (affichage immédiat des N nodes + encart pendant l’attente). On peut ajouter **GET /api/rituals/[id]/status** qui pour l’instant renvoie **ready** si le fichier ritual existe, **pending** ou **error** sinon (sans vraie génération asynchrone), afin de préparer l’Option A plus tard.
- **Fichiers** :
  - **Nouveau** : **`app/api/rituals/[id]/status/route.ts`** : lit `getDataPath('rituals', \`ritual_${id}.json\`)` (et éventuellement un fichier `.pending` si tu introduis l’async plus tard) ; renvoie `{ status: 'ready' | 'pending' | 'error', progress?, lastStepReady? }`.
  - **Page mission** : si tu restes en synchrone, pas de polling nécessaire pour la V1 ; sinon boucle `setInterval` 1.5 s sur GET status jusqu’à `ready`, puis chargement du ritual (voir ci-dessous).

### 3.5 Chargement du ritual quand ready

- Aujourd’hui les données « ready » viennent de la **réponse** de **POST /api/missions/generate** (ritualId, path, missionStubs, missions). Si on passe à un flux avec polling :
  - Quand **GET status** renvoie **ready**, il faut **récupérer** path + missionStubs (et au moins la 1ère mission). Aujourd’hui il n’y a pas d’endpoint **GET /api/rituals/[id]** qui renvoie le JSON du ritual.
- **À ajouter** : **GET /api/rituals/[id]/route.ts** (ou **GET /api/rituals/[id]**) qui lit `ritual_${id}.json` et renvoie `{ path, missionStubs, missionsById, ... }` (ou un sous-ensemble suffisant pour hydrater `missionData`). La page mission pourra alors, après un status `ready`, appeler cet endpoint et faire le même traitement qu’aujourd’hui (écriture localStorage, setPath, setMissions, etc.).

### 3.6 Animation « jet de fleurs » + popup

- **Objectif** : au passage **pending → ready**, une seule fois : animation type pétales (PetalBurst), puis popup « Ta routine est en place » + CTA (Démarrer / Partager / Inviter).
- **Implémentation** : composant **`<PetalBurst />`** (CSS + keyframes, 20–30 particules, couleurs rose/orange, spawn bords gauche/droite, 1.2–1.8 s) ; un state du type `justBecameReady` ou `showRoutineReadyModal` déclenché quand on passe de pending à ready (fetch résolu ou status passé à ready après polling). Popup = modal simple avec texte + 3 boutons (Inviter en UI seule si pas branché).
- **Fichiers** : nouveau composant `PetalBurst` (et CSS), modal « routine en place », intégration dans la page mission ou MissionDashboard.

**Hors scope pour l’instant** : planification spiral (progressionPattern / revisitIntervalDays dans le plan LLM) — prévu plus tard.

---

## 4. Liste de fichiers à modifier (ordre suggéré)

- **Home / validation**  
  - `apps/web/app/page.tsx`  
    - Remplacer la redirection mission par `/mission/${slug}-${shortId}?ritualId=...`, avec construction de `slug` (intention ou titre) et `shortId` (dérivé de ritualId ou nanoid).

- **Routing mission**  
  - `apps/web/app/mission/page.tsx`  
    - Soit garder comme point d’entrée en gérant à la fois `?creating=1&ritualId=...` et l’arrivée depuis une URL du type `/mission?ritualId=...` (pour compat), soit déplacer la logique « creating » vers une route dynamique.  
  - **Nouveau** : `apps/web/app/mission/[slugId]/page.tsx`  
    - Gérer `/mission/<slug>-<shortId>`, lire `ritualId` (query ou API by-short-id), days (pending ou query), afficher tout de suite le skeleton (N nodes) + encart « Préparation… », lancer generate (ou attendre le polling), puis à ready charger le ritual et afficher confetti + popup.

- **API status (et chargement ritual)**  
  - **Nouveau** : `apps/web/app/api/rituals/[id]/status/route.ts`  
    - GET : selon présence de `ritual_${id}.json` (et éventuellement `.pending`) renvoyer `status`, `progress`, `lastStepReady`.  
  - **Nouveau** (si polling utilisé) : `apps/web/app/api/rituals/[id]/route.ts`  
    - GET : renvoyer le contenu du ritual (path, missionStubs, missionsById) pour hydrater la page après `ready`.

- **Page mission (logique + UI)**  
  - Même fichier(s) que ci‑dessus (page ou [slugId]/page) :  
    - Construction du **path skeleton** (N steps, labels « Mission en création… »).  
    - Affichage de l’**encart** tant que status !== ready.  
    - Polling (si Option A) ou attente du fetch generate (Option B).  
    - Au ready : mise à jour path/missions, déclenchement **PetalBurst** + **popup** « Ta routine est en place ».

- **Carte / placeholders**  
  - `apps/web/app/mission/MissionMapLovable.tsx`  
    - Utiliser le titre de step ou un flag pour afficher « Mission en création… » avec **min-width 130px** et **pulse léger** (classe CSS dédiée).  
  - `apps/web/app/mission/MissionMapLovable.module.css`  
    - Styles placeholder + animation pulse douce.

- **Composants**  
  - **Nouveau** : composant encart « Préparation de ta routine… » (sous le header).  
  - **Nouveau** : `PetalBurst` (CSS + keyframes).  
  - **Nouveau** : modal « Ta routine est en place » + CTA.

---

## 5. Ordre d’implémentation recommandé (comme dans le spec)

1. **Lister les fichiers** (déjà fait ci‑dessus).  
2. **UX placeholder + encart sans animation** :  
   - Nouvelle route (ou adaptation de `/mission`) avec **skeleton path** (N nodes, « Mission en création… », min-width 130px, pulse).  
   - Encart « Préparation… » sous le header.  
   - Garder pour l’instant le flux synchrone (un seul fetch generate, pas de polling).  
3. **Polling status** (optionnel V1) :  
   - Implémenter **GET /api/rituals/[id]/status** (+ **GET /api/rituals/[id]** si besoin).  
   - Sur la page mission, soit polling 1.5 s tant que pending (si generate devient async plus tard), soit ignorer le polling en V1 et garder le fetch unique.  
4. **Animation + popup** :  
   - PetalBurst au passage ready, puis modal « Ta routine est en place » + CTA.

---

## 6. Risques / à trancher

- **Génération synchrone vs asynchrone** : le spec parle de polling 1.5 s ; cela suppose à terme un generate qui retourne vite (202) et travaille en arrière-plan. Pour la première livraison, un flux « un fetch + skeleton + encart + confetti à la réponse » est plus simple et déjà « instant + progressive » côté UX.  
- **ShortId vs ritualId** : garder `ritualId` en query (`/mission/slug-shortId?ritualId=uuid`) évite un mapping shortId → ritualId côté serveur pour la V1.  
- **Compatibilité** : garder le comportement actuel pour `/mission?creating=1&ritualId=...` (redirect vers la nouvelle URL ou traitement direct) évite de casser les liens ou favoris existants.

Tout cela reste aligné avec la logique actuelle (generate, normalizeRitualPlan, mission/next, MissionMapLovable, missionData/ritual). Rien ne bloque ; il suffit d’appliquer les changements par étapes ci‑dessus.
