/**
 * Liste des messages affichés selon les scénarios (par ex. variantes support, sécurité, ambition).
 * Utilisée par l’admin "Messages selon les scénarios" pour lier chaque message à l’action qui l’affiche.
 * FR-only labels pour l’admin.
 */

export type ScenarioMessageEntry = {
  /** Libellé court de l’action / du contexte (ex. "Variante « objectif flou » — titre") */
  action: string;
  /** Clé i18n (ex. supportUnclearTitle) */
  key: string;
  /** Groupe pour le tri (ex. "Variantes support") */
  group: string;
};

export const SCENARIO_MESSAGES: ScenarioMessageEntry[] = [
  // Variantes support (bloc angles / propositions)
  { action: 'Variante « objectif flou » — titre', key: 'supportUnclearTitle', group: 'Variantes support' },
  { action: 'Variante « objectif flou » — corps', key: 'supportUnclearBody', group: 'Variantes support' },
  { action: 'Variante « fun / nonsense » — titre', key: 'supportPlayfulTitle', group: 'Variantes support' },
  { action: 'Variante « fun / nonsense » — corps', key: 'supportPlayfulBody', group: 'Variantes support' },
  { action: 'Variante « résultat externe » — titre', key: 'controllabilitySupportTitleExternal', group: 'Variantes support' },
  { action: 'Variante « résultat externe » — corps', key: 'controllabilitySupportBodyExternal', group: 'Variantes support' },
  { action: 'Variante « santé » — titre', key: 'supportHealthTitle', group: 'Variantes support' },
  { action: 'Variante « santé » — corps', key: 'supportHealthBody', group: 'Variantes support' },
  { action: 'Variante « angles génériques » — titre', key: 'supportGenericTitle', group: 'Variantes support' },
  { action: 'Variante « angles génériques » — corps', key: 'supportGenericBody', group: 'Variantes support' },
  { action: 'Bouton « Garder mon objectif » (angles)', key: 'controllabilityKeepOriginal', group: 'Variantes support' },
  // Sécurité
  { action: 'Bloc sécurité — message principal', key: 'safetyInlineMessage', group: 'Sécurité' },
  { action: 'Bloc sécurité — exemple de reformulation', key: 'safetyInlineFallbackExample', group: 'Sécurité' },
  { action: 'Bloc sécurité — secondaire (rituel alternatif)', key: 'safetyInlineSecondary', group: 'Sécurité' },
  // Humour / playful
  { action: 'Intention fun / nonsense (humorResponse)', key: 'humorResponse', group: 'Humour / playful' },
  // Clarification / pas de suggestion
  { action: 'Pas de suggestion de reformulation', key: 'noSuggestionHint', group: 'Clarification' },
  { action: 'Indication « précise ton objectif »', key: 'inlineClarifyHint', group: 'Clarification' },
  { action: 'Indication « précise » (mot unique)', key: 'inlineClarifyHintSingleTerm', group: 'Clarification' },
  // Ambition
  { action: 'Confirmation ambition — titre', key: 'ambitionConfirmTitle', group: 'Ambition' },
  { action: 'Confirmation ambition — corps', key: 'ambitionConfirmBody', group: 'Ambition' },
  { action: 'Confirmation ambition — oui', key: 'ambitionConfirmYes', group: 'Ambition' },
  { action: 'Confirmation ambition — préciser', key: 'ambitionConfirmRefine', group: 'Ambition' },
  { action: 'Confirmation ambition — hint', key: 'ambitionRefineHint', group: 'Ambition' },
  // Réalisme
  { action: 'Réalisme — message inline', key: 'realismInlineMessage', group: 'Réalisme' },
  { action: 'Réalisme — titre confirmation', key: 'realismConfirmTitle', group: 'Réalisme' },
  { action: 'Réalisme — corps confirmation', key: 'realismConfirmBody', group: 'Réalisme' },
  { action: 'Réalisme — question', key: 'realismConfirmQuestion', group: 'Réalisme' },
  { action: 'Réalisme — oui', key: 'realismConfirmYes', group: 'Réalisme' },
  { action: 'Réalisme — ajuster', key: 'realismConfirmAdjust', group: 'Réalisme' },
  { action: 'Réalisme — garder quand même', key: 'realismKeepAnyway', group: 'Réalisme' },
  // Confirmation projet (écran final)
  { action: 'Confirmation projet — intro (En X jours...)', key: 'inDaysYouWillKnow', group: 'Confirmation projet' },
  { action: 'Confirmation projet — question', key: 'confirmObjectiveQuestion', group: 'Confirmation projet' },
  { action: 'Confirmation projet — bouton oui', key: 'confirmYes', group: 'Confirmation projet' },
  { action: 'Confirmation projet — bouton préciser', key: 'confirmRefine', group: 'Confirmation projet' },
  // Précisions (inline refine)
  { action: 'Precisions — label contexte', key: 'clarifyContextLabel', group: 'Precisions' },
  { action: 'Precisions — label niveau vise', key: 'clarifyComfortLabel', group: 'Precisions' },
  { action: 'Precisions — chargement', key: 'clarifyLoading', group: 'Precisions' },
  { action: 'Precisions — annuler', key: 'clarifyCancel', group: 'Precisions' },
  { action: 'Precisions — mettre a jour', key: 'clarifyApply', group: 'Precisions' },
  { action: 'Precisions — modal titre', key: 'clarifyModalTitle', group: 'Precisions' },
  { action: 'Precisions — modal sous-titre', key: 'clarifyModalSubtitle', group: 'Precisions' },
  { action: 'Precisions — modal fallback', key: 'clarifyModalFallback', group: 'Precisions' },
  { action: 'Precisions — modal label', key: 'clarifyModalLabel', group: 'Precisions' },
  // Contrôlabilité (legacy / fallback)
  { action: 'Contrôlabilité — titre (fallback)', key: 'controllabilitySupportTitle', group: 'Contrôlabilité' },
  { action: 'Contrôlabilité — corps (fallback)', key: 'controllabilitySupportBody', group: 'Contrôlabilité' },
  // Actionabilité
  { action: 'Pas actionnable — hint', key: 'actionabilityNotActionableHint', group: 'Actionabilité' },
  { action: 'Objectif trop vague — primary', key: 'inlineNotActionablePrimary', group: 'Actionabilité' },
  // Bien-être
  { action: 'Bien-être — reformuler', key: 'wellbeingRephraseHint', group: 'Bien-être' },
  { action: 'Bien-être — deux chemins (titre)', key: 'wellbeingTwoPathsPrimary', group: 'Bien-être' },
];
