import { normalizeParsedPayload } from '../../api/missions/generate/route';

const payload = {
  path: {
    id: 'path-1',
    pathTitle: 'Test',
    pathSummary: 'Summary [[WM_PLAN_V1]]',
    pathDescription: 'Two sentences. Still okay.',
    feasibilityNote: 'Realistic. Adapted.',
    domainId: 'fitness_sport',
    domainProfile: 'Fitness',
    domainPlaybookVersion: '1',
    ritualMode: 'progression',
    validationMode: 'automatic',
    gatingMode: 'soft',
    competencies: [{ id: 'comp-1', title: 'Basics', description: 'Core' }],
    resourcePolicy: { mode: 'prefer_cached', allowEnglishFallback: true, maxExternalLinksPerMission: 3 },
    budgetHints: { maxTokensPerMission: 420, maxSearchCallsPerMission: 1, imageGenerationMode: 'top_k', topKImages: 4 },
    levels: [
      {
        id: 'level-1',
        title: 'Level 1',
        steps: [
          {
            id: 'step-1-1',
            title: 'Read basics',
            competencyId: 'comp-1',
            axis: 'read',
            effortType: 'read',
            durationMin: 5,
            required: true,
            missionId: 'mission-1-1',
          },
        ],
      },
    ],
  },
  missionStubs: [],
};

const normalized = normalizeParsedPayload(payload as never);
const axis = normalized.payload.path?.levels?.[0]?.steps?.[0]?.axis;
if (axis !== 'understand') {
  throw new Error(`Expected axis understand, got ${axis}`);
}
