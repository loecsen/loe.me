/**
 * Centralises which gate copy to show for a classify API response.
 * Used by Home (page.tsx) and smoke tests to assert BLOCKED vs safety_no_suggestion.
 */

import { GateCopy } from './copy';

export interface ClassifyInlineMessage {
  hint: string;
  secondary: string | null;
  suggestedRephrase: null;
}

export interface ClassifyResponseLike {
  verdict?: string;
  reason_code?: string;
}

/**
 * Returns gate copy for blocked or safety_no_suggestion (no rephrase) cases.
 * - BLOCKED or reason_code === 'blocked' → hard safety message (never noSuggestionHint).
 * - reason_code === 'safety_no_suggestion' (and not BLOCKED) → no-suggestion hint, suggestedRephrase = null.
 * - Otherwise returns null (caller handles rephrase / two-path etc.).
 */
export function getClassifyInlineMessage(data: ClassifyResponseLike): ClassifyInlineMessage | null {
  if (data.verdict === 'BLOCKED' || data.reason_code === 'blocked') {
    return {
      hint: GateCopy.safetyBlockedMessage(),
      secondary: GateCopy.safetyBlockedSecondary(),
      suggestedRephrase: null,
    };
  }
  if (data.reason_code === 'safety_no_suggestion') {
    return {
      hint: GateCopy.noSuggestionHint(),
      secondary: null,
      suggestedRephrase: null,
    };
  }
  return null;
}
