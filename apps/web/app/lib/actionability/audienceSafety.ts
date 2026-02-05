/**
 * Audience safety gate: minors-safe classification.
 * all_ages | adult_only | blocked. Pipeline: hard checks → heuristics → API (doubt only).
 * EN-only for reason codes and notes.
 */

export type AudienceSafetyLevel = 'all_ages' | 'adult_only' | 'blocked';

export type AudienceSafetyReasonCode =
  | 'sexual_content'
  | 'nudity'
  | 'weapons'
  | 'drugs'
  | 'violence'
  | 'self_harm'
  | 'hate'
  | 'crime_howto'
  | 'sexual_minors'
  | 'sexual_violence'
  | 'explosives_howto'
  | 'unknown';

export type AudienceSafetyResult = {
  level: AudienceSafetyLevel;
  reason_code: AudienceSafetyReasonCode;
  confidence: number;
  flags?: string[];
  notes_short?: string;
};

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

/** Hard blocks: CSAM/sexual minors, explicit self-harm instructions, bomb/explosive how-to, sexual violence. Always return blocked. */
function hardChecks(intent: string): AudienceSafetyResult | null {
  const raw = normalize(intent);
  if (!raw) return null;

  // Sexual minors (align with safety/hardBlock)
  const minorTerms = ['enfant', 'mineur', 'underage', 'minor', 'kid', 'child', 'teen', 'adolescent'];
  const sexualTerms = ['sex', 'sexual', 'porn', 'explicit', 'intercourse', 'rape', 'violer', 'viol'];
  if (includesAny(raw, minorTerms) && includesAny(raw, sexualTerms)) {
    return { level: 'blocked', reason_code: 'sexual_minors', confidence: 1, notes_short: 'Sexual content involving minors.' };
  }

  // Sexual violence
  if (/\b(rape|viol\s|sexual\s+violence|assault)\b/.test(raw) && includesAny(raw, sexualTerms)) {
    return { level: 'blocked', reason_code: 'sexual_violence', confidence: 1, notes_short: 'Sexual violence.' };
  }

  // Self-harm instructions / encouragement
  const selfHarmInstruct = [
    'how to cut',
    'how to kill myself',
    'how to commit suicide',
    'comment se suicider',
    'faire une tentative',
    'cut myself',
    'cutting instructions',
  ];
  if (selfHarmInstruct.some((phrase) => raw.includes(phrase))) {
    return { level: 'blocked', reason_code: 'self_harm', confidence: 1, notes_short: 'Self-harm content.' };
  }

  // Bomb / explosive how-to
  const bombTerms = ['how to make a bomb', 'how to build a bomb', 'bomb making', 'explosive recipe', 'fabriquer une bombe'];
  if (bombTerms.some((phrase) => raw.includes(phrase))) {
    return { level: 'blocked', reason_code: 'explosives_howto', confidence: 1, notes_short: 'Explosives how-to.' };
  }

  // Violent crime how-to
  const crimeHowto = ['how to murder', 'how to kill someone', 'how to poison', 'comment tuer'];
  if (crimeHowto.some((phrase) => raw.includes(phrase))) {
    return { level: 'blocked', reason_code: 'crime_howto', confidence: 1, notes_short: 'Violent wrongdoing how-to.' };
  }

  return null;
}

/** Heuristics: adult sexual (non-minors), nudity, drugs, weapons, gambling, graphic violence → adult_only when strong hit. */
function heuristics(intent: string): AudienceSafetyResult | null {
  const raw = normalize(intent);
  if (!raw) return null;

  const flags: string[] = [];

  // Consensual adult sexual / kamasutra / intimacy (non-instructional harmful)
  if (
    /\b(kamasutra|kama sutra|pratiquer.*sexe|sexual intimacy|adult content|explicit content)\b/.test(raw) ||
    (includesAny(raw, ['sex', 'sexual', 'intimacy', 'couple']) && !includesAny(raw, ['minor', 'child', 'kid', 'teen']))
  ) {
    flags.push('adult_sexual');
  }

  // Nudity / nudism
  if (/\b(nudit|nudism|nude|naked)\b/.test(raw)) flags.push('nudity');

  // Drugs (recreational talk, not how-to)
  if (/\b(cannabis|weed|drugs|drogue|detox)\b/.test(raw) && !/\b(detox program|quit|stop|sober)\b/.test(raw)) {
    // "Do a detox program" → all_ages; "grow weed" → adult
    if (!/\b(detox|quit|stop|sober|recovery)\b/.test(raw)) flags.push('drugs');
  }
  if (/\b(detox program|detox)\b/.test(raw) && !/\b(weed|cannabis|grow)\b/.test(raw)) {
    // Detox program alone → all_ages, no flag
    return null;
  }

  // Weapons / tactical
  if (/\b(weapon|gun|rifle|tactical|armes)\b/.test(raw)) flags.push('weapons');

  // Gambling
  if (/\b(gambling|poker|casino|betting|paris)\b/.test(raw)) flags.push('gambling');

  if (flags.length === 0) return null;

  // Strong adult-only: sexual, nudity, weapons
  if (flags.some((f) => ['adult_sexual', 'nudity'].includes(f))) {
    const reason = flags.includes('adult_sexual') ? 'sexual_content' : 'nudity';
    return { level: 'adult_only', reason_code: reason, confidence: 0.85, flags, notes_short: 'Adult content.' };
  }
  if (flags.includes('weapons')) {
    return { level: 'adult_only', reason_code: 'weapons', confidence: 0.75, flags, notes_short: 'Weapons/tactical.' };
  }
  if (flags.includes('drugs') || flags.includes('gambling')) {
    return { level: 'adult_only', reason_code: 'drugs', confidence: 0.7, flags, notes_short: 'Adult topic.' };
  }

  return null;
}

/** Hard checks + heuristics only; no API. Used by classify route to skip LLM when already determined. Nonsense/playful (pizza, dragon, etc.) are handled by Tone gate, not here. */
export function assessAudienceSafetyDeterministic(intent: string): AudienceSafetyResult | null {
  const hard = hardChecks(intent);
  if (hard) return hard;
  const heur = heuristics(intent);
  if (heur && heur.confidence >= 0.7) return heur;
  return null;
}

/**
 * Assess audience safety: hard checks → heuristics → API (caller does DB lookup first, then this returns or calls API).
 * When API is needed, caller should POST to /api/audience-safety/classify and pass result here or use getAudienceSafetyWithDb.
 */
export async function assessAudienceSafety(
  intent: string,
  intentLang: string,
  uiLocale: string,
  fetchClassify?: (body: { intent: string; intent_lang: string; ui_locale: string }) => Promise<AudienceSafetyResult>,
): Promise<AudienceSafetyResult> {
  const hard = hardChecks(intent);
  if (hard) return hard;

  const heur = heuristics(intent);
  if (heur && heur.confidence >= 0.75) return heur;

  if (fetchClassify) {
    try {
      const apiResult = await fetchClassify({ intent, intent_lang: intentLang, ui_locale: uiLocale });
      if (apiResult && ['all_ages', 'adult_only', 'blocked'].includes(apiResult.level)) return apiResult;
    } catch {
      /* fallback below */
    }
  }

  return { level: 'all_ages', reason_code: 'unknown', confidence: 0.5, notes_short: 'Uncertain; default all_ages.' };
}
