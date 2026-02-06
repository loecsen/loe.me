# Audit — Flow création de rituel / mission et filtrage (actionabilité, suggestions, langue)

**Date :** 2025-01-29  
**Périmètre :** App Loe.me (Next.js monorepo), approche inline sur la Home, sans templates NEEDS_CLARIFICATION dédiés.

---

## 1) Cartographie du flow (Home → /mission creating → API → persist → /ritual/[id])

### 1.1 Enchaînement global

1. **Home** (`apps/web/app/page.tsx`)  
   - Utilisateur remplit l’intention (textarea) + jours (slider 7–90), soumet le formulaire.  
   - `handleSubmit` appelle `runActionabilityV2(trimmed, finalDays)` puis `toGateResult(...)` → statut `ACTIONABLE` | `NOT_ACTIONABLE_INLINE` | `BORDERLINE`.

2. **Décision selon le gate**  
   - **NOT_ACTIONABLE_INLINE** : message inline (actionabilityNotActionableHint), pas d’appel API.  
   - **BORDERLINE** : appel `POST /api/actionability/classify` avec `intent`, `timeframe_days`, `display_lang` ; selon la réponse (ACTIONABLE vs NEEDS_REPHRASE_INLINE) soit appel à `POST /api/missions/generate`, soit affichage message + suggestion / fallback.  
   - **ACTIONABLE** : appel direct `POST /api/missions/generate` avec `intention`, `days`, `locale`, `ritualId`.

3. **Après succès de missions/generate**  
   - Home écrit en **sessionStorage** : `loe.pending_ritual_request` (ritualId, intention, days, locale), `loe.pending_ritual_result` (payload avec path, missionStubs, etc.).  
  - Redirection vers `/mission/<slug>-<shortId>?ritualId=<id>`.

4. **Page Mission** (`apps/web/app/mission/page.tsx`) avec `creating=1`  
   - Lit `PENDING_RESULT_KEY` et `PENDING_REQUEST_KEY` en sessionStorage.  
   - Construit un `RitualRecord`, persiste en **localStorage** (clés ci‑dessous), met à jour l’index, puis redirige vers `/mission?start=1&ready=1` (ou reste sur mission selon le flux).  
   - En cas d’erreur (ex. safety), redirection possible vers `/?safetyBlock=1&intention=...`.

5. **Page Ritual** (`apps/web/app/ritual/[id]/page.tsx`)  
   - Avec `creating=1` : peut créer un brouillon (record `generating`), appeler `POST /api/missions/generate`, recevoir path + missionStubs + `debugTrace`, persister le record et mettre à jour l’index.  
   - Sans `creating` : charge le rituel depuis localStorage (`buildRitualStorageKey(ritualId)`) et l’index (`RITUAL_INDEX_KEY`), affiche détail / missions.

### 1.2 Fichiers et fonctions clés

| Étape | Fichier | Fonction / rôle |
|-------|---------|------------------|
| Home submit | `apps/web/app/page.tsx` | `handleSubmit`, `storePendingRequest`, `createRitualId` |
| Gate actionability | `apps/web/app/lib/actionability.ts` | `runActionabilityV2`, `toGateResult`, `getDisplayLanguage` |
| Classify (BORDERLINE) | `apps/web/app/api/actionability/classify/route.ts` | `POST` : intent, display_lang, lexicon, LLM, suggestion template |
| Génération missions | `apps/web/app/api/missions/generate/route.ts` | `POST` : actionability, safety, realism, plan LLM, mission stubs |
| Génération rituel (legacy) | `apps/web/app/api/rituals/generate/route.ts` | `POST` : actionability + safety, mock proposal (non utilisé par le flux Home actuel) |
| Mission creating | `apps/web/app/mission/page.tsx` | Lecture PENDING_*, construction record, persistance, redirection |
| Ritual détail + génération | `apps/web/app/ritual/[id]/page.tsx` | `updateRecord`, appel missions/generate, persistance, DebugDecisionPanel |

### 1.3 États UI (Home)

- `intention`, `selectedDays`, `isSubmitting`, `submitError`  
- `lastSubmittedIntent`, `inlineHint`, `inlineHintSecondary`, `suggestedRephrase`  
- Selon réponse : message seul (NOT_ACTIONABLE / safety_no_suggestion) ou message + suggestion cliquable (reformulation), ou redirection vers mission.

### 1.4 Clés sessionStorage / localStorage

| Clé | Utilisation |
|-----|-------------|
| `loe.pending_ritual_request` | Payload de la requête en cours (ritualId, intention, days, locale). Écrit par Home, lu par mission page et ritual/[id]. |
| `loe.pending_ritual_result` | Réponse de missions/generate (path, missionStubs, etc.). Écrit par Home, lu par mission page. |
| `loe.active_ritual_id` | Dernier rituel actif (mission page après persist). |
| `loe.ritual` | Dernier rituel résumé (ritualId, intention, days, proposal, createdAt, lastActiveAt). |
| `loe.missionData` | Données mission (path, missions, ritualId, etc.) après création depuis mission page. |
| `loe.ritual_index_v1` | Liste d’entrées (RitualIndexItem) pour l’historique. |
| `loe.ritual.<ritualId>` | Record complet du rituel (RitualRecord). |
| `loe.ritual_lock.<ritualId>` | Lock anti-double appel generate (TTL 2 min). |
| `loe.ritual_map_v1` | Map ritualId → ritualId résolu (redirections). |
| `loe_mock_ui` | Préférence mock UI (dev). |

---

## 2) Où se fait la décision d’actionnabilité et sous quelles formes

### 2.1 Heuristiques / gates

- **Gate unique côté rule-based :** `runActionabilityV2(text, timeframe_days?)` dans `apps/web/app/lib/actionability.ts`.  
- **Pas de LLM** pour le premier tri : tout est heuristiques (script, mots latins, CEFR, structure, verbes, etc.).

Ordre d’évaluation (résumé) :

1. **noise** : `onlyEmojiOrPunct` → `not_actionable_inline`.  
2. **social_chitchat** : patterns greeting (bonjour, hello, 你好, …) → `not_actionable_inline`.  
3. **actionable** : `has_digit || has_cefr || has_structure` → `actionable` (ex. « apprendre le chinois A2 90 jours »).  
4. **Latin dominant** :  
   - `isFairePlusNoun` → actionable ;  
   - `isConsumeOnly` (manger, eat, …) → borderline ;  
   - timeframe ≥ 30 + `hasLearningVerb` + ≥ 2 mots → actionable.  
5. **CJK / Hangul** :  
   - ≥ 6 caractères “effectifs” → actionable ;  
   - ≤ 2 → `not_actionable_inline` (too_short_cjk) ;  
   - sinon → borderline.  
6. **Fallback** :  
   - ≥ 3 mots latins ou ≥ 24 caractères effectifs → actionable ;  
   - ≤ 1 mot latin → `single_term` → not_actionable_inline ;  
   - sinon → borderline.

Le **timeframe_days** n’est utilisé que dans la branche Latin (favoriser actionable si objectif apprentissage + 30j+).

### 2.2 Reason_codes existants

- **actionability (types)**  
  `apps/web/app/lib/actionability/types.ts` :  
  `too_vague`, `social_chitchat`, `pure_noun_topic`, `no_action_or_outcome`, `ambiguous_goal`, `noise`, `too_short_cjk`, `single_term`, `borderline_actionable`, `ok`, `actionable`, `classifier_error`, `safety_no_suggestion`.

- **Côté runActionabilityV2** (actionability.ts) :  
  `noise`, `social_chitchat`, `actionable`, `borderline_actionable`, `too_short_cjk`, `single_term`.

- **Classifier (LLM)** :  
  `too_vague`, `social_chitchat`, `pure_noun_topic`, `no_action_or_outcome`, `ambiguous_goal`, `ok`.

### 2.3 Conditions exactes : inline clarify vs génération

- **Inline clarify (pas d’appel missions/generate)**  
  - Gate = **NOT_ACTIONABLE_INLINE** → message `actionabilityNotActionableHint`, pas de suggestion.  
  - Gate = **BORDERLINE** et classify retourne **NEEDS_REPHRASE_INLINE** → message + suggestion (ou fallback si `reason_code === 'safety_no_suggestion'`).  
  - **missions/generate** retourne `needsClarification: true` + `clarification.mode === 'inline'` → message selon `reason_code` (single_term, too_long, unrealistic, etc.).  
  - **missions/generate** ou classify retourne **blocked** + `clarification.type === 'safety'` → message safety + secondary (ou fallback).

- **Génération (appel missions/generate)**  
  - Gate = **ACTIONABLE** → appel direct missions/generate.  
  - Gate = **BORDERLINE** et classify retourne **ACTIONABLE** → intention = `normalized_intent` ou trimmed, puis appel missions/generate.

- **rituals/generate** n’est pas utilisé par le flux Home actuel ; il applique aussi actionability + safety et retourne un mock proposal.

---

## 3) Où sont générées les “suggestions de reformulation”

### 3.1 Chaîne complète

1. **Entrée** : uniquement en cas de gate **BORDERLINE** (Home appelle `/api/actionability/classify`).  
2. **API classify** (`apps/web/app/api/actionability/classify/route.ts`) :  
   - Reçoit `intent`, `timeframe_days`, `display_lang`.  
   - Si `!shouldSuggestRephraseSync(intent)` → retourne `suggested_rephrase: null`, `reason_code: 'safety_no_suggestion'` (pas d’appel LLM).  
   - Sinon : `getLexiconGuard()`, `guard(intent)` ; si bloqué → même réponse `safety_no_suggestion`.  
   - Sinon : appel LLM (OpenAI) avec `ACTIONABILITY_CLASSIFIER_SYSTEM` et `buildActionabilityClassifierUser(intent, timeframe_days, displayLang)`.  
   - Réponse parsée → `normalized_intent` ; **suggestion construite côté serveur** avec `buildSuggestionFromTemplate(displayLang, parsed.normalized_intent)` (le `suggested_rephrase` du LLM est ignoré).

### 3.2 Prompt / heuristique

- **Prompt** : `apps/web/app/lib/prompts/actionabilityClassifier.ts`  
  - `ACTIONABILITY_CLASSIFIER_SYSTEM` : rôle classifieur, schéma JSON (verdict, reason_code, normalized_intent, suggested_rephrase, confidence).  
  - Règles : ACTIONABLE vs NEEDS_REPHRASE_INLINE, multilingue, normalized_intent même langue que l’intent, suggested_rephrase non utilisé (construit côté serveur).  
- **User message** : `buildActionabilityClassifierUser(intent, timeframe_days?, display_lang?)` : Intent, timeframe_days, display_lang.

### 3.3 Langue (display_lang)

- **Source** : `getDisplayLanguage(intent, uiLocale)` dans `apps/web/app/lib/actionability.ts`.  
- **Règles** :  
  - Hangul dans l’intent → `ko` ;  
  - Kana → `ja` ;  
  - CJK (idéogrammes) → `zh` ;  
  - Cyrillic → `ru` ;  
  - Sinon → langue UI (composant principal de `uiLocale`, ex. `fr`, `en`).  
- **Utilisation** :  
  - Home envoie `display_lang: getDisplayLanguage(trimmed, locale)` au classify.  
  - Classify utilise ce `display_lang` pour choisir le template de suggestion (`buildSuggestionFromTemplate`).

### 3.4 Choix du “14 jours”

- **Templates** dans `apps/web/app/lib/actionability/suggestion.ts` :  
  `SUGGESTION_TEMPLATES` par `DisplayLang` avec **14 jours en dur** (ex. FR : `"Exemple : '{intent} en 14 jours'"`, EN : `"Example: '{intent} in 14 days'"`).  
- Aucune prise en compte du `timeframe_days` ou du slider pour la suggestion inline ; le “14 jours” est fixe.

---

## 4) Debug panel

### 4.1 Données injectées

- **Composant** : `apps/web/app/components/DebugDecisionPanel.tsx`.  
- **Props** : `trace: TraceEvent[]`, `status: 'OK' | 'ACTIONABLE' | 'NOT_ACTIONABLE_INLINE' | 'BORDERLINE' | 'BLOCKED'`.

- **Contenu affiché** :  
  - Badge de statut.  
  - Liste d’événements `trace` : pour chaque événement, `gate`, `outcome`, `reason_code`, et `meta` (JSON tronqué à 600 caractères).

### 4.2 Qui alimente le trace

- **API missions/generate** : quand `DEBUG === '1'` ou `NODE_ENV !== 'production'`, construit un tableau `trace` et y pousse des événements (actionability_v2, safety, safety_gate, realism_gate, etc.), puis renvoie `debugTrace` dans la réponse.  
- **ritual/[id]** : après appel à `POST /api/missions/generate`, lit `payload.debugTrace` (ou `payload.data.debugTrace`) et appelle `setDebugTrace(payloadDebugTrace)`, puis rend `<DebugDecisionPanel trace={debugTrace} status="OK" />`.  
- **Mission page** : ne reçoit pas et n’affiche pas le trace ; elle consomme uniquement le payload (path, missionStubs) stocké en sessionStorage par la Home. Donc **le debug du flux Home → missions/generate n’est pas affiché** sur la page Mission ; il ne l’est que si la génération est lancée depuis **ritual/[id]** (record en `generating`).

---

## 5) Points d’extension

### 5.1 Injecter `category` (ex. LEARN, CREATE, PERFORM, ANCHOR, SOCIAL, CHALLENGE) sans casser l’API

- **Côté rule-based** :  
  - Dans `runActionabilityV2`, après décision actionable/borderline/not_actionable, on peut dériver une `category` à partir des mêmes features (hasLearningVerb, isFairePlusNoun, isConsumeOnly, CEFR, etc.) et l’ajouter au `debug` ou à un champ dédié du résultat.  
  - Fichier : `apps/web/app/lib/actionability.ts` ; type de retour étendu (ex. `ActionabilityResult` + `category?: string`).

- **Côté classifier** :  
  - Étendre le schéma JSON du prompt (`actionabilityClassifier.ts`) avec un champ `category` (enum des 6 valeurs).  
  - Parser ce champ dans `parseClassifierResponse` et le renvoyer dans la réponse du classify.  
  - Fichier : `apps/web/app/lib/prompts/actionabilityClassifier.ts` ; `apps/web/app/api/actionability/classify/route.ts` (réponse JSON).

- **Côté missions/generate** :  
  - Accepter un paramètre optionnel `category` dans le body (ex. issu du classifier ou de la Home).  
  - Le passer au prompt de plan / domain (enrichIntention, resolvePlaybooks, etc.) pour orienter le domaine ou le ton.  
  - Fichiers : `apps/web/app/api/missions/generate/route.ts`, éventuellement `apps/web/app/lib/domains/infer.ts` ou prompts.

- **Côté Home** :  
  - Si le classifier renvoie `category`, le stocker ou l’envoyer avec la requête missions/generate (ex. dans `storePendingRequest` ou dans le body de l’appel fetch).  
  - Fichier : `apps/web/app/page.tsx`.

### 5.2 Fallback LLM “rewrite” uniquement en zone grise

- **Où** : dans le flux BORDERLINE, après ou à la place de l’appel actuel au classifieur.  
- **Option A** : garder le classifieur actuel ; en cas de NEEDS_REPHRASE_INLINE, appeler un second LLM “rewrite” qui ne fait que reformuler (sans verdict), puis afficher cette reformulation comme suggestion.  
- **Option B** : remplacer l’appel classifieur par un seul appel “rewrite + classify” qui retourne à la fois verdict et phrase reformulée.  
- **Fichiers concernés** :  
  - `apps/web/app/api/actionability/classify/route.ts` (ou nouveau route ex. `rewrite`) ;  
  - `apps/web/app/lib/prompts/` (nouveau prompt rewrite) ;  
  - `apps/web/app/page.tsx` (appel optional au rewrite si BORDERLINE).

---

## 6) Problèmes / régressions possibles

### 6.1 Multilingue (CJK / Hangul, 1–2 caractères)

- **CJK / Hangul très courts** :  
  - `runActionabilityV2` : pour script CJK ou Hangul, si `char_count_effective <= 2` → `too_short_cjk` (not_actionable_inline).  
  - Risque : “学习” (2 caractères) ou “피자” (2 syllabes) considérés trop courts alors que sémantiquement actionnables ; déjà partiellement couvert par les tests (“피자” → not_actionable_inline, “学习中文A2 90天” → actionable).

- **Display lang** :  
  - `getDisplayLanguage` compte les caractères par script (Hangul, Kana, CJK idéogrammes, Cyrillic).  
  - Mélange de scripts (ex. latin + CJK) : la priorité Hangul > Kana > CJK > Cyrillic > UI peut donner une langue d’affichage différente de la langue perçue par l’utilisateur.

- **Classifier** :  
  - Le LLM reçoit `display_lang` dans le user message ; la consigne “same language as intent” pour `normalized_intent` peut rester ambiguë pour des intents courts ou mélangés.

### 6.2 Suggestions toxiques / sexuelles

- **Mitigations actuelles** :  
  - `shouldSuggestRephraseSync(intent)` : liste `BLOCKED_SUBSTRINGS` (sexual/insult) + greeting + trop court / emoji → pas de suggestion.  
  - Classify : `getLexiconGuard()` + `guard(intent)` ; si blocage → `safety_no_suggestion`, pas de suggestion.  
  - Suggestion construite par template (`buildSuggestionFromTemplate`) à partir de `normalized_intent` du LLM ; pas de texte libre du LLM affiché tel quel.

- **Risques restants** :  
  - Lexicon ou liste sync incomplète : nouveaux termes ou euphémismes non couverts.  
  - LLM qui retourne un `normalized_intent` encore inapproprié : le template l’affiche tel quel (“Exemple : '…' en 14 jours”). Un filtre post-LLM sur `normalized_intent` (lexicon ou liste) pourrait renvoyer `safety_no_suggestion` si l’intent normalisé est bloqué.

### 6.3 “apprendre le chinois A2 90 jours” parfois needs clarification

- Côté **rule-based** : `has_digit` est vrai (90), donc la branche `features.has_digit || has_cefr || has_structure` renvoie **actionable** avant d’atteindre les seuils de mots latins. Donc en théorie ce cas ne devrait pas être marqué needs clarification par le gate.  
- Si le problème persiste :  
  - soit il vient de **missions/generate** (ex. realism_gate, safety_gate, ou autre raison_code inline) ;  
  - soit d’un **race/ordre** (ex. timeframe_days non passé, ou autre chemin).  
  - À vérifier : logs côté serveur (reason_code retourné), et que `timeframe_days` est bien envoyé depuis la Home (finalDays).

### 6.4 Suggestion “nulle” (ex. “manger pizza” → “manger pizza en 14 jours”)

- Comportement attendu : en BORDERLINE (consume only), le classifieur renvoie probablement NEEDS_REPHRASE_INLINE avec `normalized_intent` proche de l’intent (ex. “manger pizza”).  
- La suggestion est alors `buildSuggestionFromTemplate(displayLang, "manger pizza")` → “Exemple : 'manger pizza en 14 jours'”, qui n’apporte pas de vraie reformulation “objectif apprentissage”.  
- Reco : soit renforcer le prompt du classifieur pour exiger un `normalized_intent` avec verbe d’apprentissage/objectif (ex. “apprendre à cuisiner une pizza en 14 jours”), soit en BORDERLINE consume-only afficher un message spécifique sans suggestion, ou une suggestion fixe (i18n) plutôt que construite à partir de l’intent.

---

## 7) Recos (sans code)

### 7.1 Option minimal

- **Contenu** :  
  - Documenter/clarifier le flux (ce doc).  
  - S’assurer que le trace debug du flux Home est soit stocké dans le record (ex. `debugMeta` / `debugTrace`) et affiché sur une page (mission ou ritual), soit au moins présent en log côté serveur.  
  - Ajouter un filtre post-LLM sur `normalized_intent` dans classify : si le lexicon (ou une liste sync) matche l’intent normalisé, retourner `safety_no_suggestion` au lieu d’afficher la suggestion.

- **Complexité relative** : faible.

### 7.2 Option moyen

- **Contenu** :  
  - Introduire une **category** (LEARN, CREATE, PERFORM, ANCHOR, SOCIAL, CHALLENGE) : dérivée en rule-based + optionnellement dans le classifier et transmise à missions/generate.  
  - Adapter les messages/suggestions selon la category (ex. message différent pour SOCIAL vs LEARN).  
  - Unifier/réutiliser la logique “should suggest” entre actionability et suggestion (éviter doublons greeting/short).  
  - Rendre le “14 jours” de la suggestion cohérent avec le slider (paramètre `timeframe_days` dans le template ou message dédié).

- **Complexité relative** : moyen.

### 7.3 Option complet

- **Contenu** :  
  - Refactor du gate : pipeline explicite (script → social → safety sync → category → actionable/borderline/not_actionable) avec reason_code et category à chaque étape.  
  - Classifier unique “rewrite + classify” en BORDERLINE avec sortie structurée (verdict, normalized_intent, category).  
  - Intégration category dans tout le flux (Home, classify, missions/generate, ritual record, debug).  
  - Debug panel alimenté aussi pour le flux Home (trace stocké dans PENDING_RESULT ou record initial).  
  - Tests E2E ou scénarios pour CJK/Hangul courts et cas “consume only” (suggestion pertinente ou désactivée).

- **Complexité relative** : fort.

---

## Table des fichiers impactés

| Fichier | Rôle dans le flow / filtrage / suggestions |
|---------|--------------------------------------------|
| `apps/web/app/page.tsx` | Home : submit, gate, classify, missions/generate, storage, messages inline, display_lang. |
| `apps/web/app/lib/actionability.ts` | runActionabilityV2, toGateResult, getDisplayLanguage, detectScriptStats. |
| `apps/web/app/lib/actionability/types.ts` | ActionabilityStatus, ActionabilityReasonCode, ActionabilityGateResult. |
| `apps/web/app/lib/actionability/suggestion.ts` | shouldSuggestRephraseSync, buildSuggestionFromTemplate, BLOCKED_SUBSTRINGS, SUGGESTION_TEMPLATES. |
| `apps/web/app/api/actionability/classify/route.ts` | POST classify : intent, display_lang, safety sync + lexicon, LLM, suggestion template. |
| `apps/web/app/lib/prompts/actionabilityClassifier.ts` | ACTIONABILITY_CLASSIFIER_SYSTEM, buildActionabilityClassifierUser, parseClassifierResponse. |
| `apps/web/app/api/missions/generate/route.ts` | POST : actionability, safety, realism, plan + missions, debugTrace. |
| `apps/web/app/api/rituals/generate/route.ts` | POST (legacy) : actionability, safety, mock proposal. |
| `apps/web/app/lib/safety/getLexiconGuard.ts` | Chargement lexicon, createLexiconGuard. |
| `apps/web/app/mission/page.tsx` | creating=1 : lecture PENDING_*, persistance localStorage, redirection. |
| `apps/web/app/ritual/[id]/page.tsx` | Création/génération rituel, appel missions/generate, persistance, DebugDecisionPanel. |
| `apps/web/app/components/DebugDecisionPanel.tsx` | Affichage trace + status. |
| `apps/web/app/lib/rituals/inProgress.ts` | Types RitualRecord, RitualIndexItem, clés storage (buildRitualStorageKey, RITUAL_INDEX_KEY, etc.). |
| `apps/web/app/lib/i18n.ts` | actionabilityNotActionableHint, safetyInlineMessage, safetyInlineFallbackExample, actionabilitySuggestionLabel. |
