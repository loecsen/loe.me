export type ReasonCode =
  | 'sexual_minors'
  | 'sexual'
  | 'violence'
  | 'hate'
  | 'self_harm'
  | 'illegal_wrongdoing'
  | 'extremism'
  | 'other';

export type SafetyVerdict = { status: 'ok' } | { status: 'blocked'; reason_code: ReasonCode };
