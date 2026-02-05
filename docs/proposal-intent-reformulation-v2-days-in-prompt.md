# Proposition : reformulation avec jours dans le prompt (v2)

## Contexte

Aujourd’hui (`intent_reformulation_v1`) :

- Le prompt demande une reformulation **sans** inclure le nombre de jours : *"Do NOT include the number of days (we add it separately)"*.
- Le LLM retourne par ex. `{"reformulated_intent": "Préparer des sushis"}`.
- L’app ajoute ensuite le suffixe localisé (ex. `reformulationDaysSuffix` : "en {days} jours", "in {days} days") via `formatReformulationWithDays(text, days)` → "Préparer des sushis en 14 jours".

**Risque** : dans certaines langues, coller un segment fixe en fin de phrase peut être incorrect (ordre des mots, cas, classificateurs, etc.). Mieux vaut que la phrase complète soit générée dans la langue cible avec le nombre de jours intégré de façon naturelle.

## Évolution proposée (v2, non appliquée)

### 1. Nouveau prompt `intent_reformulation_v2`

- **Input** : inchangé — `intent`, `intent_lang`, `days` (déjà passés au template).
- **Instruction** : demander une phrase courte style « titre de méthode » dans la même langue que l’utilisateur, **en incluant le nombre de jours** de façon grammaticalement naturelle pour cette langue.
- **Output** : même schéma `{ "reformulated_intent": string }`, mais la chaîne est la **phrase complète** (avec les jours déjà dedans).

Exemples de consignes à intégrer dans le prompt :

- *"Include the number of days in the phrase in a natural way for that language (e.g. FR: 'Préparer des sushis en 14 jours', EN: 'Learn to make sushi in 14 days'). Output valid JSON only."*
- Ne plus dire "Do not add days".

Exemple de `user_template` :

```text
Intent: "{{intent}}". Language: {{intent_lang}}. Duration: {{days}} days.
Reformulate as a short method-style title in the same language, including the duration in a natural way (e.g. 'Préparer des sushis en 14 jours', 'Learn Chinese in 30 days'). Capital letter. Reply with JSON: {"reformulated_intent": string}
```

Exemple de `system` :

```text
You output a single short phrase that reformulates the user's goal as a clear method title, in the same language as the user. Include the number of days in the phrase in a grammatically natural way for that language. Start with a capital letter. Output valid JSON only.
```

### 2. Schéma de sortie

- Inchangé : `{ "reformulated_intent": "string" }`.
- La valeur est cette fois la phrase **complète** prête à afficher (avec les jours inclus), pas une phrase à laquelle on ajoute un suffixe côté app.

### 3. Côté consommateur (à faire lors de l’implémentation)

- **Moteur** : appeler le juge avec `intent`, `intent_lang`, `days` ; utiliser `reformulated_intent` tel quel comme `rewritten_intent` (déjà la phrase finale).
- **UI** : 
  - Si la décision provient du juge v2 : afficher `rewritten_intent` **tel quel** (plus d’appel à `formatReformulationWithDays` sur ce champ).
  - Pour les **fallbacks** (pas de reformulation LLM : `pre.normalized_intent` ou `input.intent`), garder `formatReformulationWithDays(text, days)` pour ajouter le suffixe localisé.
- **Compatibilité** : tant qu’on garde v1 en prod, on peut soit basculer par feature flag (v1 vs v2), soit détecter si la chaîne « contient déjà » une forme de nombre de jours (moins fiable). Recommandation : un seul prompt actif (v2 une fois validé) et affichage conditionnel selon la source (reformulation LLM → as-is ; fallback → suffix).

### 4. Option « include in the sentence » (alternative)

Tu mentionnais un truc du genre *"include in the sentence nbe of days"*. Deux interprétations possibles :

- **A) Un seul champ** : le LLM produit directement la phrase avec les jours → `{"reformulated_intent": "Préparer des sushis en 14 jours"}`. C’est ce que décrit la proposition ci-dessus.
- **B) Deux champs** : par ex. `reformulated_intent` (sans jours) + un indicateur ou un second champ pour la phrase avec jours, pour garder une phrase « courte » sans jours ailleurs. Ça complique le modèle et l’usage ; pas recommandé sauf besoin métier de garder une version sans durée.

Recommandation : **A)** — un seul champ `reformulated_intent` contenant la phrase complète avec les jours. Si besoin d’une version sans jours ailleurs (ex. cache, debug), on peut la dériver côté code (regex / strip du segment « en X jours ») ou ajouter plus tard un second champ uniquement si nécessaire.

---

**Résumé** : faire produire par le LLM la phrase complète (titre de méthode + jours) dans la langue cible, avec un nouveau prompt v2 et afficher cette chaîne telle quelle ; garder l’ajout de suffixe uniquement pour les fallbacks.

## Implémentation (faite)

- **Prompt** : `lib/prompts/published/intent_reformulation_v2.json` créé ; juge `intentReformulation.ts` utilise `intent_reformulation_v2`.
- **Types** : `PayloadProceed` et `PayloadAngles` ont `reformulation_includes_days?: boolean`.
- **Engine** : tous les payloads (Proceed + SHOW_ANGLES) définissent `reformulation_includes_days: reformulationFromStep != null`.
- **Page** : `lastSubmitReformulation`, `controllabilityPending`, `confirmBeforeProceed` ont `includesDays` / `reformulationIncludesDays` ; helper `formatReformulationDisplay(text, days, alreadyIncludesDays)` affiche tel quel ou avec suffixe selon le flag.
