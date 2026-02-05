/**
 * Default controllable angles for the Supportive Controllability block.
 * Category-aware; labels via i18n keys (UI locale applied by caller).
 * All code/comments in English.
 */

import type { CategoryId } from './categories';

export type ControllableAngle = {
  label_key: string;
  intent: string;
  days?: number;
};

/** Generic angle label keys (i18n). */
export const ANGLE_LABEL_KEYS = {
  prepPlan: 'controllabilityAnglePrepPlan',
  skills: 'controllabilityAngleSkills',
  habits: 'controllabilityAngleHabits',
  opportunity: 'controllabilityAngleOpportunity',
  processEmotions: 'controllabilityAngleProcessEmotions',
  confidence: 'controllabilityAngleConfidence',
  communication: 'controllabilityAngleCommunication',
  reachBasics: 'controllabilityAngleReachBasics',
  practiceDaily: 'controllabilityAnglePracticeDaily',
  shipProject: 'controllabilityAngleShipProject',
  draftDaily: 'controllabilityAngleDraftDaily',
} as const;

/**
 * Returns 2–4 controllable angles for the given category.
 * intent/lang: same language as user intent (for intent strings).
 * locale: UI locale (caller uses it for t(label_key)); we use it only if we need to pick language-specific intent templates.
 */
export function getDefaultControllableAngles(
  category: CategoryId,
  _locale: string,
  _intent: string,
  days: number,
  intentLang: string,
): ControllableAngle[] {
  const lang = intentLang?.split('-')[0]?.toLowerCase() ?? 'en';
  const isFr = lang === 'fr';
  const isEs = lang === 'es';
  const isDe = lang === 'de';
  const isIt = lang === 'it';
  const intentStr = (fr: string, es: string, de: string, it: string, en: string) =>
    isFr ? fr : isEs ? es : isDe ? de : isIt ? it : en;

  switch (category) {
    case 'WELLBEING':
      return [
        {
          label_key: ANGLE_LABEL_KEYS.processEmotions,
          intent: intentStr('Mieux vivre mes émotions et me recentrer', 'Procesar mis emociones y recentrarme', 'Meine Gefühle verarbeiten und mich zentrieren', 'Vivere meglio le mie emozioni e centrarmi', 'Process my emotions and recenter'),
          days,
        },
        {
          label_key: ANGLE_LABEL_KEYS.confidence,
          intent: intentStr('Rebâtir ma confiance en moi au quotidien', 'Reconstruir mi confianza día a día', 'Mein Selbstvertrauen Tag für Tag aufbauen', 'Ricostruire la mia fiducia giorno per giorno', 'Rebuild my confidence day by day'),
          days,
        },
        {
          label_key: ANGLE_LABEL_KEYS.communication,
          intent: intentStr('Améliorer ma communication et mes limites', 'Mejorar mi comunicación y mis límites', 'Kommunikation und Grenzen verbessern', 'Migliorare comunicazione e limiti', 'Improve my communication and boundaries'),
          days,
        },
      ];
    case 'LEARN':
      return [
        {
          label_key: ANGLE_LABEL_KEYS.reachBasics,
          intent: intentStr('Atteindre les bases (niveau A1/A2) en X', 'Alcanzar lo básico (A1/A2) en X', 'Grundlagen (A1/A2) erreichen', 'Raggiungere le basi (A1/A2)', 'Reach A1/A2 basics in X'),
          days,
        },
        {
          label_key: ANGLE_LABEL_KEYS.practiceDaily,
          intent: intentStr('Pratiquer X chaque jour de façon réaliste', 'Practicar X cada día de forma realista', 'X täglich realistisch üben', 'Praticare X ogni giorno in modo realistico', 'Practice X daily in a realistic way'),
          days,
        },
        {
          label_key: ANGLE_LABEL_KEYS.prepPlan,
          intent: intentStr('Me préparer avec un plan quotidien', 'Prepararme con un plan diario', 'Mit einem täglichen Plan vorbereiten', 'Prepararmi con un piano quotidiano', 'Build a daily preparation plan'),
          days,
        },
      ];
    case 'CREATE':
      return [
        {
          label_key: ANGLE_LABEL_KEYS.shipProject,
          intent: intentStr('Livrer un petit projet concret', 'Entregar un proyecto pequeño concreto', 'Ein kleines konkretes Projekt liefern', 'Consegnare un piccolo progetto concreto', 'Ship a small concrete project'),
          days,
        },
        {
          label_key: ANGLE_LABEL_KEYS.draftDaily,
          intent: intentStr('Écrire / créer un peu chaque jour', 'Escribir / crear un poco cada día', 'Täglich ein wenig schreiben oder erstellen', 'Scrivere / creare un po\' ogni giorno', 'Draft or create a little every day'),
          days,
        },
      ];
    case 'PERFORM':
    case 'CHALLENGE':
      return [
        {
          label_key: ANGLE_LABEL_KEYS.prepPlan,
          intent: intentStr('Construire un plan de préparation quotidien', 'Construir un plan de preparación diario', 'Einen täglichen Vorbereitungsplan erstellen', 'Costruire un piano di preparazione quotidiano', 'Build a daily preparation plan'),
          days,
        },
        {
          label_key: ANGLE_LABEL_KEYS.skills,
          intent: intentStr('Améliorer les compétences qui comptent pour cet objectif', 'Mejorar las habilidades que importan para este objetivo', 'Die Fähigkeiten für dieses Ziel verbessern', 'Migliorare le competenze per questo obiettivo', 'Improve the skills that matter for this goal'),
          days,
        },
        {
          label_key: ANGLE_LABEL_KEYS.opportunity,
          intent: intentStr('Me préparer pour l\'opportunité (candidature / entretien)', 'Prepararme para la oportunidad (aplicación / entrevista)', 'Auf die Gelegenheit vorbereiten (Bewerbung / Vorstellungsgespräch)', 'Prepararmi per l\'opportunità (candidatura / colloquio)', 'Prepare for the opportunity (application / interview)'),
          days,
        },
      ];
    case 'SOCIAL':
      return [
        {
          label_key: ANGLE_LABEL_KEYS.communication,
          intent: intentStr('Améliorer ma communication et mes limites', 'Mejorar mi comunicación y mis límites', 'Kommunikation und Grenzen verbessern', 'Migliorare comunicazione e limiti', 'Improve my communication and boundaries'),
          days,
        },
        {
          label_key: ANGLE_LABEL_KEYS.habits,
          intent: intentStr('Renforcer mes habitudes et ma régularité', 'Fortalecer mis hábitos y mi consistencia', 'Gewohnheiten und Regelmäßigkeit stärken', 'Rafforzare abitudini e costanza', 'Strengthen my habits and consistency'),
          days,
        },
      ];
    default:
      return [
        {
          label_key: ANGLE_LABEL_KEYS.prepPlan,
          intent: intentStr('Construire un plan d\'action quotidien', 'Construir un plan de acción diario', 'Einen täglichen Aktionsplan erstellen', 'Costruire un piano d\'azione quotidiano', 'Build a daily action plan'),
          days,
        },
        {
          label_key: ANGLE_LABEL_KEYS.skills,
          intent: intentStr('Améliorer ce que je peux contrôler', 'Mejorar lo que puedo controlar', 'Verbessern, was ich kontrollieren kann', 'Migliorare ciò che posso controllare', 'Improve what I can control'),
          days,
        },
      ];
  }
}
