import type { LearningPathBlueprintV2, LearningPathState } from '../models';
import { buildInitialProgress } from '../logic/helpers';

export function createSamplePath_3levels_3_4_3(): LearningPathState {
  const blueprint: LearningPathBlueprintV2 = {
    id: 'loe-path-v2',
    title: 'Parcours Mission Engine V1',
    summary: 'Un parcours en 3 niveaux pour activer les fondamentaux.',
    levels: [
      {
        id: 'level-1',
        title: 'Stabiliser',
        steps: [
          {
            id: 'step-1-1',
            title: 'Intention claire',
            missionId: 'mission-foundations',
            required: true,
            passCriteria: 'completion',
          },
          {
            id: 'step-1-2',
            title: 'Ancrage quotidien',
            missionId: 'mission-focus',
            required: true,
            passCriteria: 'completion',
          },
          {
            id: 'step-1-3',
            title: 'État de flow',
            missionId: 'mission-focus',
            required: true,
            passCriteria: 'completion',
          },
        ],
      },
      {
        id: 'level-2',
        title: 'Approfondir',
        steps: [
          {
            id: 'step-2-1',
            title: 'Rituel du matin',
            missionId: 'mission-foundations',
            required: true,
            passCriteria: 'completion',
          },
          {
            id: 'step-2-2',
            title: 'Alignement valeurs',
            missionId: 'mission-focus',
            required: true,
            passCriteria: 'completion',
          },
          {
            id: 'step-2-3',
            title: 'Priorité unique',
            missionId: 'mission-score',
            required: true,
            passCriteria: 'score',
          },
          {
            id: 'step-2-4',
            title: 'Visualisation',
            missionId: 'mission-focus',
            required: false,
            passCriteria: 'completion',
          },
        ],
      },
      {
        id: 'level-3',
        title: 'Souverain',
        steps: [
          {
            id: 'step-3-1',
            title: 'Vision claire',
            missionId: 'mission-foundations',
            required: true,
            passCriteria: 'completion',
          },
          {
            id: 'step-3-2',
            title: 'Décisions alignées',
            missionId: 'mission-focus',
            required: true,
            passCriteria: 'completion',
          },
          {
            id: 'step-3-3',
            title: 'Auto-évaluation finale',
            missionId: 'mission-score',
            required: true,
            passCriteria: 'score',
          },
        ],
      },
    ],
  };

  return {
    blueprint,
    progress: buildInitialProgress(blueprint),
  };
}
