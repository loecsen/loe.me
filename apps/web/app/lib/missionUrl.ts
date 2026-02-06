import { buildShortId, slugify } from './slugify';

type MissionUrlParams = {
  ritualId: string;
  intention: string;
  days: number;
  stepId?: string | null;
  mode?: string | null;
};

export const buildMissionUrl = ({ ritualId, intention, stepId, mode }: MissionUrlParams) => {
  const slugBase = slugify(intention) || 'rituel';
  const shortId = buildShortId(ritualId);
  const params = new URLSearchParams();
  if (stepId) params.set('step', stepId);
  if (mode) params.set('mode', mode);
  const hash = params.toString();
  return hash ? `/mission/${slugBase}-${shortId}#${hash}` : `/mission/${slugBase}-${shortId}`;
};
