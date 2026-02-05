/**
 * EN-only copy for all gate/system messages (actionability, safety, realism, ambition, controllability).
 * UI locale is ignored for these messages so gate behavior is consistent and auditable.
 */

export const GateCopy = {
  /** Hard block: safety / blocked. Do NOT use for safety_no_suggestion. */
  safetyBlockedMessage: (): string =>
    "We can't generate a ritual for this request.",

  safetyBlockedSecondary: (): string =>
    "Try instead: 'improve my sleep routine in 14 days'",

  /** Playful / nonsense intent (humor_response). */
  humorResponse: (): string =>
    "This looks like fun! Pick a concrete goal to build your ritual.",

  /** Only when reason_code === 'safety_no_suggestion' (suggestion filtered, not blocked). */
  noSuggestionHint: (): string =>
    "I can't suggest a rewrite for this request. Please rephrase it in your own words.",

  actionabilityNotActionableHint: (): string =>
    "It will be difficult to create a ritual with this request. Can you rephrase with an action (do / learn / improve)?",

  inlineNotActionablePrimary: (): string =>
    "This isn't enough to build a ritual yet. Try adding what you want to do and a result.",

  wellbeingRephraseHint: (): string =>
    "I see what you mean. To create a ritual, phrase your goal around what you can control.",

  wellbeingTwoPathsPrimary: (): string =>
    "I can help. That goal involves someone else, so let's focus on what you can control.",

  wellbeingTwoPathsOptionA: (days: number): string =>
    `Feel better after the breakup (${days} days)`,

  wellbeingTwoPathsOptionB: (days: number): string =>
    `Improve communication & boundaries (${days} days)`,

  wellbeingPathAIntent: (): string =>
    "Feel better after the breakup",

  wellbeingPathBIntent: (): string =>
    "Improve communication and boundaries",

  /** Default / legacy: use external variant when confident. */
  controllabilitySupportTitle: (): string =>
    "This outcome depends on other people (or factors you can't fully control).",

  controllabilitySupportBody: (): string =>
    "We can still help: pick an angle you can act on right now. Or keep your original goal and we'll turn it into a plan with steps you can control.",

  /** When controllability low and confident: romance/institution/selection/market. */
  controllabilitySupportTitleExternal: (): string =>
    "This outcome depends on other people (or factors you can't fully control).",

  controllabilitySupportBodyExternal: (): string =>
    "We can still help: pick an angle you can act on right now. Or keep your original goal and we'll turn it into a plan with steps you can control.",

  /** When system uncertain / unclear / thin intent; show angles as reframing tool. */
  controllabilitySupportTitleUnclear: (): string =>
    "We may not have understood your goal yet.",

  controllabilitySupportBodyUnclear: (): string =>
    "Pick what you really want to focus on, or rewrite your goal in your own words.",

  controllabilityKeepOriginal: (): string =>
    "Keep my original goal",

  controllabilityImproveChancesTemplate: (): string =>
    "Improve my chances through actions I can control",

  realismInlineMessage: (days: number): string =>
    `This might be too ambitious for ${days} days.`,

  realismConfirmTitle: (): string =>
    "That's a very ambitious challenge!",

  realismConfirmBody: (days: number): string =>
    `In ${days} days we can't guarantee the final outcome. But we can create a solid ritual of first steps toward this goal.`,

  realismConfirmQuestion: (): string =>
    "Do you confirm you want to go for it?",

  realismConfirmYes: (): string =>
    "Yes, I confirm",

  realismConfirmAdjust: (): string =>
    "I prefer to adjust",

  realismKeepAnyway: (): string =>
    "Keep anyway",

  realismOr: (): string =>
    "or",

  ambitionConfirmTitle: (): string =>
    "That's very ambitious!",

  ambitionConfirmBody: (): string =>
    "We can try to build a ritual from that. Do you confirm?",

  ambitionConfirmYes: (): string =>
    "Yes, I confirm",

  ambitionConfirmRefine: (): string =>
    "I prefer to refine",

  ambitionRefineHint: (): string =>
    "Try adding a concrete first step or outcome, e.g. \"prepare for…\" or \"first steps toward…\".",

  suggestionLabel: (): string =>
    "Suggestion: ",
};
