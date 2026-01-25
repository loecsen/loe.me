type MissionWithContent = {
  blocks?: unknown;
  generatedAt?: string;
  contentStatus?: 'missing' | 'ready' | 'generating' | 'error';
};

type MissionDataLike = {
  missions?: MissionWithContent[];
};

const DEFAULT_FREE_DAYS = 7;
const DEFAULT_PAID_DAYS = 30;

const getTier = () => {
  if (typeof window === 'undefined') {
    return 'free';
  }
  const raw = window.localStorage.getItem('loe_plan_tier');
  return raw === 'paid' ? 'paid' : 'free';
};

const getPurgeDays = () => {
  const freeDays = Number(process.env.NEXT_PUBLIC_CONTENT_PURGE_DAYS_FREE ?? DEFAULT_FREE_DAYS);
  const paidDays = Number(process.env.NEXT_PUBLIC_CONTENT_PURGE_DAYS_PAID ?? DEFAULT_PAID_DAYS);
  const safeFree = Number.isFinite(freeDays) && freeDays > 0 ? freeDays : DEFAULT_FREE_DAYS;
  const safePaid = Number.isFinite(paidDays) && paidDays > 0 ? paidDays : DEFAULT_PAID_DAYS;
  return getTier() === 'paid' ? safePaid : safeFree;
};

export function purgeStaleMissionContent<T extends MissionDataLike>(
  state: T | null,
  lastActiveAt?: string | null,
) {
  if (!state?.missions || state.missions.length === 0) {
    return state;
  }
  if (!lastActiveAt) {
    return state;
  }
  const lastActiveMs = Number.isNaN(Date.parse(lastActiveAt)) ? 0 : Date.parse(lastActiveAt);
  if (!lastActiveMs) {
    return state;
  }
  const purgeMs = getPurgeDays() * 24 * 60 * 60 * 1000;
  if (Date.now() - lastActiveMs <= purgeMs) {
    return state;
  }
  const missions = state.missions.map((mission) => {
    if (!mission.blocks) {
      return mission;
    }
    const next = { ...mission };
    delete next.blocks;
    delete next.generatedAt;
    next.contentStatus = 'missing';
    return next;
  });
  return { ...state, missions };
}
