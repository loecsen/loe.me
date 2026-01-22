# Audit – packages/core

## Ce qui existe

- **Modèles V2**: `LearningPathBlueprintV2`, `Level`, `Step`, `MissionBlueprintV2`, `Block` et états (`StepState`, `LevelState`, `PassCriteria`) dans `src/models.ts`.
- **Gating & états**: `recomputeStates` applique un gating strict basé sur les steps requis du niveau précédent et conserve `failed`/`completed`.
- **Fonctions pures**: `validatePath`, `recomputeStates`, `getNextAvailableStep`, `canOpenStep`, `markStepStarted`, `markStepCompleted`, `markStepFailed` dans `src/logic/*`.
- **Remediation**: structure `RemediationPlan` appliquée lors de `markStepFailed`.
- **Samples**: `createSamplePath_3levels_3_4_3` et `createSampleMissions_basic` dans `src/sample/*`.
- **Tests**: tests Vitest sur le gating et transitions dans `src/__tests__/logic.test.ts`.

## Ce qui manquait

- **Test de gating “required only”**: vérification que les steps optionnels n’empêchent pas l’ouverture du niveau suivant.

## Ce qui était incorrect vs specs

- **Rien de bloquant**: les règles suivantes sont déjà respectées dans l’implémentation actuelle :
  - max 5 steps par niveau (validation)
  - gating strict (niveau N+1 verrouillé tant que les steps requis de N ne sont pas complétés)
  - échec d’un step ne débloque pas le niveau suivant
  - mises à jour immuables (clonage avant mutation)

## Actions correctives appliquées

- Ajout d’un test pour confirmer que seuls les steps requis bloquent le niveau suivant.
