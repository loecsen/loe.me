# Loe.me – Product reference

Loe.me est un créateur de rituels d’apprentissage. L’utilisateur exprime une intention (ex. « apprendre la couture en 14 jours »), pas un choix de cours.

## État actuel

- **Home** : page d’accueil comme générateur de rituel (champ intention + durée, bouton « En réflexion » pendant l’analyse).
- **Moteur de décision V2** : pipeline Preprocess → cache exact → cache similarité (empreinte d’intention) → safety → reformulation → category → category analysis → controllability → realism. Issues : PROCEED_TO_GENERATE, SHOW_ANGLES, ASK_CLARIFICATION, CONFIRM_AMBITION, ASK_USER_CHOOSE_CATEGORY, BLOCKED_SAFETY.
- **Reformulation** : titre de méthode (sans jours) dans la langue de l’intention ; affichage unifié « Ton projet : … en X jours » ; clic sur une suggestion → texte dans le champ intention.
- **Précisions nécessaires (NeedPrecisions)** : blocs angles, clarification, ambition/réalisme avec titre commun.
- **Backend** : store file-based (PourLaMaquette) pour décisions, prompts, lexicon, eval ; APIs /api/decision/resolve, /api/actionability/classify, /api/controllability/check, /api/missions/generate, etc.
- **AI** : appels LLM pour classify, safety, reformulation, category analysis, controllability, realism ; prompts JSON sous lib/prompts/published/.
- **Mission UI** : /mission (carte + player), génération lazy des missions ; /ritual/[id], /ritual/creating.
- **Admin** : /admin/rules, /admin/prompts, /admin/lexicon, /admin/knowledge, /admin/eval (harness d’évaluation).

## Focus actuel

- Stabilité et UX (reformulation, angles, confirmation avant génération).
- i18n (EN, FR, ES, DE, IT) pour libellés Home et suggestions.
- Cache par empreinte d’intention pour réutiliser les décisions sur des formulations équivalentes.

## Design

- Fond blanc uniquement.
- Calme, premium, subtilement magique.