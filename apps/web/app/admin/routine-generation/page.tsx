'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

export default function AdminRoutineGenerationPage() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      router.replace('/');
    }
  }, [router]);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Génération de la routine</h1>
        <p className={styles.subtitle}>
          État des lieux et étapes de génération du plan de routine quotidienne (rituel). Dev-only.
        </p>
        <p>
          <Link href="/" className={styles.link}>
            ← Retour à l’accueil
          </Link>
        </p>
      </header>

      {/* État des lieux */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Ce qu’on génère actuellement</h2>
        <div className={styles.block}>
          <p>
            À partir d’une <strong>intention</strong> (ex. « Apprendre les bases de l’espagnol en 14 jours ») et d’un
            nombre de <strong>jours</strong> (7 à 21), l’API <code>POST /api/missions/generate</code> produit :
          </p>
          <ul className={styles.list}>
            <li>
              <strong>path</strong> (LearningPath) : titre du parcours, résumé, description, note de faisabilité,
              domainId/playbook, modes (ritualMode, validationMode, gatingMode), compétences, politique de ressources,
              <strong>niveaux</strong> (levels) avec <strong>titres de niveau</strong> et <strong>steps</strong> (id, title,
              competencyId, axis, effortType, durationMin, missionId).
            </li>
            <li>
              <strong>missionStubs</strong> : une entrée par step (id, stepId, dayIndex, title, summary, uniqueAngle,
              actionVerb, effortType, axis, estimatedMinutes, resources, imageSubject, etc.).
            </li>
            <li>
              <strong>Première mission complète</strong> : contenu (blocks: text, checklist, quiz) généré pour le premier
              stub uniquement. Les autres missions sont complétées à la demande (lazy) via <code>/api/missions/next</code>.
            </li>
          </ul>
          <p>
            Le tout est enregistré dans un <strong>rituel</strong> (ritual_*.json) avec path, missionStubs, missionsById
            (première mission), debugMeta (promptPlan, promptFull, etc.).
          </p>
        </div>
      </section>

      {/* Pipeline */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Étapes du pipeline (ordre)</h2>
        <ol className={styles.orderedList}>
          <li><strong>Actionability V2</strong> — <code>runActionabilityV2</code> : intention actionable ou clarification.</li>
          <li><strong>Safety V2</strong> — <code>runSafetyV2</code> : blocage si contenu non autorisé.</li>
          <li><strong>Safety gate</strong> — <code>runSafetyGate</code> : nettoyage / clarification.</li>
          <li><strong>Audience safety</strong> — <code>assessAudienceSafety</code> : niveau âge (all_ages / adult_only / blocked).</li>
          <li><strong>Realism gate</strong> — <code>runRealismGate</code> (si catégorie concernée) : objectif réaliste ou reformulation.</li>
          <li><strong>Enrichissement intention</strong> — <code>enrichIntention</code> (LLM) : goalHint, contextHint, validationPreference.</li>
          <li><strong>Contexte domaine</strong> — <code>inferDomainContext</code> ou clarification : domainId, domainProfile, domainPlaybookVersion.</li>
          <li><strong>Plan LLM</strong> — <code>buildPlanPrompt</code> + appel LLM (reasoning) : génération du JSON path + missionStubs.</li>
          <li><strong>Normalisation plan</strong> — <code>normalizeRitualPlan</code> : découpage en levels (stepsPerLevel), titres de niveau (ou « Semaine N »), autofill si steps manquants.</li>
          <li><strong>Normalisation stubs</strong> — <code>normalizeMissionStubsToTotal</code> : alignement stubs sur totalSteps, autofill « Jour N » si manquants.</li>
          <li><strong>Validation</strong> — <code>validateLearningPath</code> / <code>validateMissionStub</code> (Zod).</li>
          <li><strong>Première mission full</strong> — <code>generateMissionBlocks</code> + <code>buildMissionFull</code> : contenu (blocks) du premier stub.</li>
          <li><strong>Écriture rituel</strong> — writeJsonAtomic (ritual_*.json), appendNdjson (index rituals).</li>
        </ol>
      </section>

      {/* Constantes */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Paramètres et constantes</h2>
        <div className={styles.block}>
          <ul className={styles.list}>
            <li><strong>totalSteps</strong> = <code>days</code> (soumis), plafonné à 7 minimum (défaut 21).</li>
            <li><strong>stepsPerLevel</strong> = 7 (nombre de steps par niveau / « semaine »).</li>
            <li><strong>levelsCount</strong> = ceil(totalSteps / stepsPerLevel).</li>
            <li>Titres de niveau : fournis par le LLM dans <code>path.levels[].title</code>, sinon fallback <code>Semaine {1}</code> / <code>Week {1}</code> (locale).</li>
            <li>Titres de step manquants : <code>Jour {1}</code> / <code>Day {1}</code> (normalizeRitualPlan).</li>
          </ul>
        </div>
      </section>

      {/* Plan prompt */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Plan prompt (path + missionStubs)</h2>
        <div className={styles.block}>
          <p className={styles.meta}>
            <strong>Source</strong> : <code>apps/web/app/lib/prompts/planPrompt.ts</code> — <code>buildPlanPrompt</code>, version <code>PLAN_PROMPT_VERSION</code> (plan_v1.1).
          </p>
          <p className={styles.meta}>
            <strong>Variables d’entrée</strong> : userGoal, originalGoal (optionnel), days, userLang, playbooks (catalogue), domainLock (domainId, domainProfile, domainPlaybookVersion), goalHint, contextHint, validationPreference.
          </p>
          <p>
            Le prompt système décrit le JSON attendu (path avec id, pathTitle, pathSummary, pathDescription, feasibilityNote, domainId, levels[].id/title/steps[], missionStubs[] avec champs détaillés), les contraintes (DOMAIN LOCK, axis, effortType, watermark [[WM_PLAN_V1]], etc.).
          </p>
          <p>
            Une contrainte dynamique est injectée côté route : remplacer « 4 to 5 steps per level » par « Generate exactly N steps in total », « Group them into levels of 7 steps each », « Each step represents exactly one day ».
          </p>
          <p className={styles.note}>
            Prompt défini en code (pas de JSON éditable). Pour éditer : modifier <code>planPrompt.ts</code> ou ajouter plus tard une couche d’overrides en base.
          </p>
        </div>
      </section>

      {/* Mission full prompt */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Mission full prompt (contenu d’une mission)</h2>
        <div className={styles.block}>
          <p className={styles.meta}>
            <strong>Source</strong> : <code>apps/web/app/lib/prompts/missionFullPrompt.ts</code> — <code>buildMissionFullPrompt</code>, version <code>MISSION_FULL_PROMPT_VERSION</code> (mission_full_v1.1).
          </p>
          <p className={styles.meta}>
            <strong>Variables d’entrée</strong> : userGoal, days, userLang, playbook, mission (stub), validationMode, ritualMode, domainId.
          </p>
          <p>
            Produit des <strong>blocks</strong> (text, checklist, quiz) pour une mission. Utilisé pour la première mission au moment de la génération du plan, puis pour les missions suivantes (lazy).
          </p>
          <p className={styles.note}>
            Prompt défini en code. Édition : <code>missionFullPrompt.ts</code> ou overrides à venir.
          </p>
        </div>
      </section>

      {/* Niveaux et objectifs */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>6. Niveaux et objectifs (structure path)</h2>
        <div className={styles.block}>
          <p>Champs principaux du path utilisés pour l’affichage et la logique :</p>
          <ul className={styles.list}>
            <li><strong>pathTitle</strong> — Titre du parcours (ex. « Espagnol A1 en 14 jours »).</li>
            <li><strong>pathSummary</strong> — Une phrase, doit contenir le watermark [[WM_PLAN_V1]].</li>
            <li><strong>pathDescription</strong> — 2–4 phrases (ce qu’on fait, comment, pourquoi réaliste).</li>
            <li><strong>feasibilityNote</strong> — Ambitious/realistic + adaptation (2 phrases).</li>
            <li><strong>path.levels[]</strong> — Chaque niveau : id (level-1, …), <strong>title</strong> (nom du niveau, ex. « Semaine 1 » ou titre sémantique), steps[] (id, title, competencyId, axis, effortType, durationMin, missionId).</li>
            <li>Les <strong>objectifs par niveau</strong> ne sont pas un champ séparé : le titre du niveau et les titres des steps portent l’intention. pathDescription décrit l’ensemble du parcours.</li>
          </ul>
        </div>
      </section>

      {/* Fichiers */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>7. Fichiers concernés</h2>
        <div className={styles.block}>
          <ul className={styles.list}>
            <li><code>apps/web/app/api/missions/generate/route.ts</code> — Point d’entrée, pipeline, appels LLM et normalisation.</li>
            <li><code>apps/web/app/lib/prompts/planPrompt.ts</code> — Construction du prompt plan (system + user).</li>
            <li><code>apps/web/app/lib/prompts/missionFullPrompt.ts</code> — Construction du prompt mission full.</li>
            <li><code>apps/web/app/lib/rituals/normalizeRitualPlan.ts</code> — Normalisation levels/steps, titres Semaine/Jour.</li>
            <li><code>apps/web/app/lib/missions/generateMissionBlocks.ts</code> — Appel LLM + buildMissionFull pour les blocks.</li>
            <li><code>apps/web/app/lib/domains/infer.ts</code> — enrichIntention, inferDomainContext.</li>
            <li><code>apps/web/app/lib/domains/resolver.ts</code> — loadOverrides, resolvePlaybooks (catalogue playbooks).</li>
          </ul>
        </div>
      </section>

      <p className={styles.footer}>
        Enrichissements prévus : prompts éditables (overrides), prévisualisation d’un plan, export des paramètres par défaut.
      </p>
      <p className={styles.footer}>
        <strong>Scope prochain dev (UX instant + progressive)</strong> : routing /mission/slug-shortId, placeholder N nodes, encart « Préparation… », status + polling, animation pétales + popup. <strong>Hors scope pour l’instant</strong> : planification spiral (progressionPattern / revisitIntervalDays) — prévu plus tard.
      </p>
    </div>
  );
}
