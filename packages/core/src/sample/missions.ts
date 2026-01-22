import type { MissionBlueprintV2 } from '../models';

export function createSampleMissions_basic(): MissionBlueprintV2[] {
  return [
    {
      id: 'mission-foundations',
      title: 'Fondations Loe.me',
      summary: 'Poser l’intention et l’état d’esprit.',
      passCriteria: 'completion',
      blocks: [
        { type: 'text', text: 'Bienvenue dans votre mission. Prenez un moment pour respirer.' },
        {
          type: 'checklist',
          items: ['Définir une intention', 'Choisir un rythme', 'Préparer un espace calme'],
        },
      ],
    },
    {
      id: 'mission-focus',
      title: 'Focus calme',
      summary: 'Stabiliser l’attention.',
      passCriteria: 'completion',
      blocks: [
        { type: 'text', text: 'Identifiez une distraction majeure et réduisez-la.' },
        {
          type: 'media',
          mediaType: 'image',
          url: 'https://example.com/soft-focus.png',
          caption: 'Visualisation douce.',
        },
      ],
    },
    {
      id: 'mission-score',
      title: 'Auto-évaluation',
      summary: 'Mesurer la progression.',
      passCriteria: 'score',
      minScore: 80,
      blocks: [
        {
          type: 'quiz',
          question: 'Quelle action soutient le mieux votre mission ?',
          choices: ['Une action claire', 'Une liste infinie', 'Ignorer les signaux'],
          correctIndex: 0,
        },
      ],
    },
  ];
}
