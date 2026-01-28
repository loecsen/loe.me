export type RitualStatus = 'generating' | 'ready' | 'error' | 'completed';

export type RitualIndexItem = {
  ritualId: string;
  intention: string;
  days: number;
  status: RitualStatus;
  createdAt: string;
  updatedAt: string;
  lastViewedAt?: string;
  lastOpenedAt?: string;
  createdBy?: string | null;
  hidden?: boolean;
  clarification?: {
    originalIntention: string;
    chosenLabel: string;
    chosenDomainId: string;
    chosenIntention?: string;
    createdAt: string;
  };
  pathTitle?: string;
  pathSummary?: string;
  pathDescription?: string;
  feasibilityNote?: string;
  previewStubs?: Array<{
    title: string;
    summary: string;
    effortType: string;
    estimatedMinutes: number;
    dayIndex?: number;
  }>;
  imageStyleId?: string;
  imageStyleVersion?: number;
  imageStylePrompt?: string;
  debugMeta?: {
    domainId?: string;
    domainPlaybookVersion?: string;
    validationMode?: string;
    reason_code?: string;
    promptPlan?: { promptHash: string; promptVersion: string; latencyMs: number };
    promptFull?: { promptHash: string; promptVersion: string; latencyMs: number };
    stubsCount?: number;
    fullCount?: number;
    qualityWarnings?: string[];
    zodIssues?: unknown;
    axisMapped?: Array<{ from: string; to: string }>;
  };
};

export type RitualRecord = RitualIndexItem & {
  error?: string;
  errorDebug?: unknown;
  path?: unknown;
  missions?: unknown[];
  pathSource?: unknown;
  missionStubsSource?: unknown[];
  missionsByIdSource?: Record<string, unknown>;
};

export const RITUAL_INDEX_KEY = 'loe.ritual_index_v1';
export const RITUAL_PREFIX = 'loe.ritual.';
export const RITUAL_LOCK_PREFIX = 'loe.ritual_lock.';
export const RITUAL_ID_MAP_KEY = 'loe.ritual_id_map_v1';

export const buildRitualStorageKey = (ritualId: string) => `${RITUAL_PREFIX}${ritualId}`;
export const buildRitualLockKey = (ritualId: string) => `${RITUAL_LOCK_PREFIX}${ritualId}`;

export function getRitualIdMap(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(RITUAL_ID_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function setRitualIdMap(map: Record<string, string>): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(RITUAL_ID_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}
