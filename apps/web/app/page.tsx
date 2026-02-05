'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Container } from '@loe/ui';
import { useI18n } from './components/I18nProvider';
import RitualHistory from './components/RitualHistory';
import { getMockHomeData } from './PourLaMaquette/getMockHomeData';
import { runActionabilityV2, toGateResult, getDisplayLanguage, inferCategoryFromIntent } from './lib/actionability';
import { runSoftRealism } from './lib/actionability/realism';
import { categoryRequiresFeasibility } from './lib/category';
import type { RealismAdjustment } from './lib/actionability/realism';
import { needsAmbitionConfirmation, isLifeGoalOrRoleAspiration } from './lib/actionability/ambitionConfirmation';
import { detectControllability, detectControllabilityLegacy } from './lib/actionability/controllability';
import { getDefaultControllableAngles } from './lib/taxonomy/angles';
import type { Category } from './lib/category';
import { GateCopy } from './lib/gates/copy';
import { getClassifyInlineMessage } from './lib/gates/classifyMessage';
import { tryLexiconAutobootstrap } from './lib/lexicon/autobootstrap';
import { decideUiOutcome } from './lib/decision/uiOutcome';
import { resolveCopyVariant } from './lib/gates/copyVariant';
import { PipelinePromptsEditor } from './components/PipelinePromptsEditor';
import styles from './page.module.css';

const CONTROLLABILITY_CONFIDENCE_THRESHOLD = 0.75;

/** V2 by default. FORCE_LEGACY=1 → legacy only. FORCE_V2=1 → force V2 (override). */
const USE_V2 =
  process.env.NEXT_PUBLIC_FORCE_LEGACY === '1'
    ? false
    : process.env.NEXT_PUBLIC_FORCE_V2 === '1'
      ? true
      : true;

type GoalClarification = {
  context: string;
  comfort: string;
  deadline_days: number;
  notes?: string;
};

const DEFAULT_GOAL_CLARIFICATION: GoalClarification = {
  context: 'general',
  comfort: 'essential',
  deadline_days: 14,
};

/** True if V2 result has at least one user-facing output (blocked, clarification, angles, realism, ambition, proceed). Never fallback for cosmetic reasons. */
function isRenderableDecisionResult(
  result: { outcome?: string; payload?: Record<string, unknown> } | null,
): boolean {
  if (!result || typeof result.outcome !== 'string') return false;
  const o = result.outcome;
  if (o === 'BLOCKED_SAFETY' || o === 'PROCEED_TO_GENERATE' || o === 'ASK_CLARIFICATION' || o === 'CONFIRM_AMBITION' || o === 'ASK_USER_CHOOSE_CATEGORY' || o === 'REALISM_ADJUST' || o === 'PLAYFUL_OR_NONSENSE') return true;
  if (o === 'SHOW_ANGLES') return ((result.payload?.angles as unknown[])?.length ?? 0) >= 1;
  return false;
}

/** Localize gate message for display: use uiLocale (t) when available, else EN (GateCopy). */
function gateMessage(
  t: Record<string, string>,
  key: keyof typeof GateCopy,
  ...args: unknown[]
): string {
  const i18nKeys: Partial<Record<keyof typeof GateCopy, string>> = {
    safetyBlockedMessage: 'safetyInlineMessage',
    safetyBlockedSecondary: 'safetyInlineFallbackExample',
    noSuggestionHint: 'noSuggestionHint',
    actionabilityNotActionableHint: 'actionabilityNotActionableHint',
    controllabilitySupportTitle: 'controllabilitySupportTitle',
    controllabilitySupportBody: 'controllabilitySupportBody',
    ambitionConfirmTitle: 'ambitionConfirmTitle',
    ambitionConfirmBody: 'ambitionConfirmBody',
    ambitionConfirmYes: 'ambitionConfirmYes',
    ambitionConfirmRefine: 'ambitionConfirmRefine',
    ambitionRefineHint: 'ambitionRefineHint',
    realismConfirmTitle: 'realismConfirmTitle',
    realismConfirmBody: 'realismConfirmBody',
    realismConfirmQuestion: 'realismConfirmQuestion',
    realismConfirmYes: 'realismConfirmYes',
    realismConfirmAdjust: 'realismConfirmAdjust',
    realismInlineMessage: 'realismInlineMessage',
    realismKeepAnyway: 'realismKeepAnyway',
    realismOr: 'realismOr',
    inlineNotActionablePrimary: 'inlineNotActionablePrimary',
    wellbeingRephraseHint: 'wellbeingRephraseHint',
    wellbeingTwoPathsPrimary: 'wellbeingTwoPathsPrimary',
    wellbeingTwoPathsOptionA: 'wellbeingTwoPathsOptionA',
    wellbeingTwoPathsOptionB: 'wellbeingTwoPathsOptionB',
    controllabilityKeepOriginal: 'controllabilityKeepOriginal',
    controllabilityImproveChancesTemplate: 'controllabilityImproveChancesTemplate',
    controllabilitySupportTitleExternal: 'controllabilitySupportTitleExternal',
    controllabilitySupportBodyExternal: 'controllabilitySupportBodyExternal',
    controllabilitySupportTitleUnclear: 'controllabilitySupportTitleUnclear',
    controllabilitySupportBodyUnclear: 'controllabilitySupportBodyUnclear',
    suggestionLabel: 'suggestionLabel',
    humorResponse: 'humorResponse',
  };
  const i18nKey = i18nKeys[key];
  if (i18nKey && t[i18nKey]) {
    const days = args[0] != null ? String(args[0]) : '';
    return String(t[i18nKey]).replace(/\{days\}/g, days);
  }
  const fn = GateCopy[key] as (...a: unknown[]) => string;
  return fn(...args);
}

/** Localize classify inline message (EN from getClassifyInlineMessage) for display in uiLocale. */
function localizeClassifyMessage(enStr: string, t: Record<string, string>): string {
  if (enStr === GateCopy.safetyBlockedMessage()) return t.safetyInlineMessage ?? enStr;
  if (enStr === GateCopy.safetyBlockedSecondary()) return t.safetyInlineFallbackExample ?? enStr;
  if (enStr === GateCopy.noSuggestionHint()) return t.noSuggestionHint ?? enStr;
  return enStr;
}

/** Canonical "not actionable" hint texts (EN). Used to never show them when gate is ACTIONABLE. */
const NOT_ACTIONABLE_HINT_EN = GateCopy.actionabilityNotActionableHint();
const NOT_ACTIONABLE_PRIMARY_EN = GateCopy.inlineNotActionablePrimary();

function isNotActionableHint(hint: string | null, t?: Record<string, string>): boolean {
  if (!hint) return false;
  if (hint === NOT_ACTIONABLE_HINT_EN || hint === NOT_ACTIONABLE_PRIMARY_EN) return true;
  if (t && (hint === (t as Record<string, string>).actionabilityNotActionableHint || hint === (t as Record<string, string>).inlineNotActionablePrimary)) return true;
  return false;
}

const dayOptions = [7, 14, 30, 60, 90] as const;
const dayStages: Record<number, { icon: string; label: string }> = {
  7: { icon: '🌱', label: 'Discovery' },
  14: { icon: '🌿', label: 'Foundations' },
  30: { icon: '🌳', label: 'Real progress' },
  60: { icon: '🌲', label: 'Solid level' },
  90: { icon: '🏔️', label: 'Strong autonomy' },
};

const getNearestDayOption = (value: number) => {
  return dayOptions.reduce((closest, option) =>
    Math.abs(option - value) < Math.abs(closest - value) ? option : closest,
  );
};

const MOCK_UI_STORAGE_KEY = 'loe_mock_ui';
const showDevTools =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === '1';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const [intention, setIntention] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(14);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSubmittedIntent, setLastSubmittedIntent] = useState('');
  const [inlineHint, setInlineHint] = useState<string | null>(null);
  const [inlineHintSecondary, setInlineHintSecondary] = useState<string | null>(null);
  const [suggestedRephrase, setSuggestedRephrase] = useState<string | null>(null);
  const [suggestedRewrites, setSuggestedRewrites] = useState<
    Array<{ label: string; next_intent: string }> | null
  >(null);
  const [lastRitualId, setLastRitualId] = useState<string | null>(null);
  const [realismPending, setRealismPending] = useState<{
    intentionToSend: string;
    days: number;
    category?: string;
    ritualId: string;
    why_short?: string;
    adjustments: RealismAdjustment[];
    needsConfirmation?: boolean;
  } | null>(null);
  const [showConfirmationAdjustments, setShowConfirmationAdjustments] = useState(false);
  const [stretchMessage, setStretchMessage] = useState<string | null>(null);
  const [ambitionPending, setAmbitionPending] = useState<{
    intent: string;
    days: number;
    ritualId: string;
    marker?: string;
  } | null>(null);
  const [twoPathPending, setTwoPathPending] = useState<{
    primary: string;
    optionA: { label: string; next_intent: string };
    optionB: { label: string; next_intent: string };
    ritualId: string;
    days: number;
  } | null>(null);
  const [controllabilityPending, setControllabilityPending] = useState<{
    primary: string;
    secondary?: string;
    angles: Array<{ label: string; intent: string; days?: number }>;
    ritualId: string;
    days: number;
    originalIntent: string;
    rewrittenIntent?: string | null;
    /** When true, rewrittenIntent already includes days (v2); do not append suffix. */
    reformulationIncludesDays?: boolean;
    /** Centralized copy variant (from resolveCopyVariant). */
    copyVariant?: string;
    title_key?: string;
    body_key?: string;
    debug_why?: string;
  } | null>(null);
  /** Confirm step: show guide title, objectives, Oui / Je précise (from proceed payload). */
  const [confirmBeforeProceed, setConfirmBeforeProceed] = useState<{
    intentionToSend: string;
    originalIntent: string;
    ritualId: string;
    days: number;
    category?: string;
    /** When true, intentionToSend already includes days (v2); do not append suffix. */
    reformulationIncludesDays?: boolean;
    /** Short guide-style title (no days) for confirmation screen. */
    guide_title?: string;
    /** Up to 3 objectives in intent language. */
    objectives?: string[];
  } | null>(null);
  type ClarifyOption = { key: string; label: string };
  type ClarifySection = {
    id: 'context' | 'comfort';
    label: string;
    type: 'single';
    options: ClarifyOption[];
    default: string;
  };
  type ClarifyContract = {
    template_key: string;
    prompt_version: string;
    lang: string;
    days: number;
    sections: ClarifySection[];
    trace?: { cache: string; hash: string; timing_ms: number; judge: string; prompt_id: string };
  };
  type ClarifyDraft = {
    context: string;
    comfort: string;
  };
  const [clarifyModalOpen, setClarifyModalOpen] = useState(false);
  const [clarifyModalLoading, setClarifyModalLoading] = useState(false);
  const [clarifyModalError, setClarifyModalError] = useState<string | null>(null);
  const [clarifyModalFallback, setClarifyModalFallback] = useState(false);
  const [clarifyModalData, setClarifyModalData] = useState<ClarifyContract | null>(null);
  const [clarifyModalKey, setClarifyModalKey] = useState<string | null>(null);
  const [clarifyDraft, setClarifyDraft] = useState<ClarifyDraft>({
    context: DEFAULT_GOAL_CLARIFICATION.context,
    comfort: DEFAULT_GOAL_CLARIFICATION.comfort,
  });
  const [clarifyTrace, setClarifyTrace] = useState<ClarifyContract['trace'] | null>(null);
  const clarifyAbortRef = useRef<AbortController | null>(null);
  const clarifyRequestIdRef = useRef(0);
  const [clarifyApplied, setClarifyApplied] = useState<GoalClarification | null>(null);
  const [rephrasePlaceholderActive, setRephrasePlaceholderActive] = useState(false);
  /** Reformulation (demande du moment) pour affichage dans Prompts du pipeline et sous la demande. */
  const [lastSubmitReformulation, setLastSubmitReformulation] = useState<{
    text: string;
    days: number;
    /** When true, text already includes days (v2); do not append suffix. */
    includesDays?: boolean;
  } | null>(null);
  const [audienceSafetyLevel, setAudienceSafetyLevel] = useState<'all_ages' | 'adult_only' | null>(null);
  const [lastSubmitDebug, setLastSubmitDebug] = useState<{
    branch: string;
    gateStatus?: string;
    reason_code?: string;
    categoryInferred?: string;
    lifeGoalHit?: boolean;
    lifeGoalMarker?: string;
    classifyVerdict?: string;
    classifyReason?: string;
    classifyCategory?: string;
    engine?: 'v2' | 'legacy';
    fallback_to_legacy?: boolean;
    fallback_reason?: string;
    controllabilityLevel?: string;
    generateNeedsClarification?: boolean;
    copy_variant?: string;
    copy_why?: string;
    tone?: string | null;
    /** Similarity/fingerprint cache (V2). */
    fingerprint?: string;
    similarity_hit?: boolean;
    matched_record_id?: string;
  } | null>(null);
  const [lastSubmitPromptTrace, setLastSubmitPromptTrace] = useState<
    { prompt_name: string; response: string }[] | null
  >(null);
  const [mockUIEnabled, setMockUIEnabled] = useState(false);
  const [siteLlm, setSiteLlm] = useState<{
    provider: string;
    model: string | null;
    base_url: string | null;
    source?: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const intentionInputRef = useRef<HTMLTextAreaElement>(null);
  /** Idée (chip Inspiration) utilisée pour ce parcours : on ne retire le chip que quand le rituel est créé complètement. */
  const pendingIdeaIdRef = useRef<string | null>(null);
  const [ideaIdUsedForRitual, setIdeaIdUsedForRitual] = useState<string | null>(null);

  /** Dev-only: log who set inline hint/suggestion so we can trace stale UI. */
  const setInlineHintDbg = (value: string | null, tag: string) => {
    if (showDevTools && value != null) console.log('[setInlineHint]', tag, value?.slice(0, 80));
    setInlineHint(value);
  };
  const setInlineHintSecondaryDbg = (value: string | null, tag: string) => {
    if (showDevTools && value != null) console.log('[setInlineHintSecondary]', tag, value?.slice(0, 80));
    setInlineHintSecondary(value);
  };
  const setSuggestedRephraseDbg = (value: string | null, tag: string) => {
    if (showDevTools && value != null) console.log('[setSuggestedRephrase]', tag, value?.slice(0, 80));
    setSuggestedRephrase(value);
    if (value == null) setSuggestedRewrites(null);
  };

  useEffect(() => {
    if (!showDevTools) return;
    const fromUrl = searchParams.get('mock') === '1';
    if (fromUrl) {
      setMockUIEnabled(true);
      return;
    }
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(MOCK_UI_STORAGE_KEY) : null;
      setMockUIEnabled(stored === '1');
    } catch {
      setMockUIEnabled(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!showDevTools) return;
    fetch('/api/dev/llm/current')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.provider === 'string') {
          setSiteLlm({
            provider: data.provider,
            model: data.model ?? null,
            base_url: data.base_url ?? null,
            source: data.source ?? undefined,
          });
        }
      })
      .catch(() => setSiteLlm(null));
  }, []);

  const handleMockUIToggle = () => {
    const next = !mockUIEnabled;
    setMockUIEnabled(next);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MOCK_UI_STORAGE_KEY, next ? '1' : '0');
      }
    } catch {
      // ignore
    }
  };

  const mockTabData =
    (mockUIEnabled || process.env.NEXT_PUBLIC_USE_MOCKS === '1')
      ? getMockHomeData().tabs
      : null;

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS !== '1' && !lastSubmitDebug) return;
    if (!lastSubmitDebug) return;
    if (lastSubmitDebug.gateStatus === 'ACTIONABLE' && inlineHint && isNotActionableHint(inlineHint, t as Record<string, string>)) {
      console.error('[Home] ACTIONABLE branch but inlineHint is not-actionable; intent may be stale.', {
        branch: lastSubmitDebug.branch,
        gateStatus: lastSubmitDebug.gateStatus,
        reason_code: lastSubmitDebug.reason_code,
      });
    }
  }, [lastSubmitDebug, inlineHint, t]);

  useEffect(() => {
    const inlineClarify = searchParams.get('inlineClarify') === '1';
    const safetyBlock = searchParams.get('safetyBlock') === '1';
    const intentionParam = searchParams.get('intention');
    const reasonCode = searchParams.get('reason_code');
    if (inlineClarify && intentionParam != null) {
      const decoded = decodeURIComponent(intentionParam);
      setIntention(decoded);
      setLastSubmittedIntent(decoded);
      setInlineHintSecondaryDbg(null, 'url:inlineClarify');
      const hint =
        reasonCode === 'single_term'
          ? (t as { inlineClarifyHintSingleTerm?: string }).inlineClarifyHintSingleTerm ?? (t as { inlineClarifyHint?: string }).inlineClarifyHint
          : (t as { inlineClarifyHint?: string }).inlineClarifyHint;
      setInlineHintDbg(hint ?? null, 'url:inlineClarify');
      router.replace('/', { scroll: false });
    } else if (safetyBlock && intentionParam != null) {
      const decoded = decodeURIComponent(intentionParam);
      setIntention(decoded);
      setLastSubmittedIntent(decoded);
      setInlineHintDbg(GateCopy.safetyBlockedMessage(), 'url:safetyBlock');
      setInlineHintSecondaryDbg(GateCopy.safetyBlockedSecondary(), 'url:safetyBlock');
      router.replace('/', { scroll: false });
    }
  }, [searchParams, router, t]);

  const isFrench = locale?.startsWith('fr');
  const defaultPlaceholderLines = useMemo(
    () =>
      isFrench
        ? [
            'Parler italien au restaurant',
            'Créer une routine de concentration',
            'Me préparer à un entretien en anglais',
          ].join('\n')
        : [
            'Speak Italian at a restaurant',
            'Build a focus routine',
            'Prepare for an English interview',
          ].join('\n'),
    [isFrench],
  );
  const placeholderText = rephrasePlaceholderActive ? ((t as Record<string, string>).homePlaceholderProjet ?? '') : defaultPlaceholderLines;

  /** Reformulation + jours pour affichage (ex. "Jouer aux échecs en 14 jours"). Toujours majuscule en début (style titre). */
  const formatReformulationWithDays = useCallback(
    (text: string, days: number) => {
      let base = (text ?? '').trim();
      if (base) base = base.charAt(0).toUpperCase() + base.slice(1);
      const suffix = ((t as Record<string, string>).reformulationDaysSuffix ?? 'in {days} days').replace('{days}', String(days));
      return base ? `${base} ${suffix}` : suffix;
    },
    [t],
  );
  /** Affiche la reformulation : si alreadyIncludesDays (v2), texte tel quel (avec majuscule) ; sinon formatReformulationWithDays. */
  const formatReformulationDisplay = useCallback(
    (text: string, days: number, alreadyIncludesDays?: boolean) => {
      const base = (text ?? '').trim();
      if (!base) return alreadyIncludesDays ? '' : ((t as Record<string, string>).reformulationDaysSuffix ?? 'in {days} days').replace('{days}', String(days));
      const capped = base.charAt(0).toUpperCase() + base.slice(1);
      return alreadyIncludesDays ? capped : formatReformulationWithDays(text, days);
    },
    [t, formatReformulationWithDays],
  );

  /** Titre court type guide (sans jours), pour l’écran de confirmation. */
  const deriveGuideTitle = useCallback((intentionToSend: string): string => {
    let s = (intentionToSend ?? '').trim();
    s = s.replace(/\s+en\s+\d+\s+jours?\s*$/i, '').replace(/\s+in\s+\d+\s+days?\s*$/i, '');
    s = s.replace(/\s+d'?ici\s+\d+\s+jours?\s*$/i, '').replace(/\s+within\s+\d+\s+days?\s*$/i, '');
    s = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return (intentionToSend ?? '').trim();
    const lowered = s.toLowerCase();
    const verbPrefixes = [
      'faire ',
      'apprendre ',
      'devenir ',
      'ameliorer ',
      'améliorer ',
      'maitriser ',
      'maîtriser ',
      'reussir a ',
      'réussir a ',
      'reussir à ',
      'réussir à ',
      'savoir ',
    ];
    for (const prefix of verbPrefixes) {
      if (lowered.startsWith(prefix)) {
        s = s.slice(prefix.length);
        break;
      }
    }
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) return (intentionToSend ?? '').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, []);

  const inferClarifyDomain = useCallback((intent: string, category?: string): string => {
    const lower = (intent ?? '').toLowerCase();
    const languageHint = /(anglais|english|espagnol|spanish|allemand|german|italien|italian|portugais|portuguese|su[eé]dois|swedish|turc|turkish|japonais|japanese|chinois|mandarin|arabe|arabic|russe|russian|langue|language)\b/i;
    const musicHint = /(guitare|piano|musique|morceau|chanson|chant|solfege|solf[eè]ge|accords?)\b/i;
    const fitnessHint = /(fitness|muscu|musculation|course|courir|running|yoga|pilates|marathon|sport|entrainement)\b/i;
    const codingHint = /(code|coder|programmer|python|javascript|typescript|sql|dev|developper|développer)\b/i;
    if (languageHint.test(lower)) return 'language';
    if (musicHint.test(lower)) return 'music';
    if (fitnessHint.test(lower)) return 'fitness';
    if (codingHint.test(lower)) return 'coding';
    if (category === 'LEARN') return 'learning';
    if (category === 'WELLBEING') return 'wellbeing';
    return 'general';
  }, []);

  const buildClientFallback = useCallback(
    (lang: string, days: number): ClarifyContract => {
      const base = (lang ?? 'en').split('-')[0]?.toLowerCase() ?? 'en';
      const fallback = {
        fr: {
          contextLabel: 'Contexte',
          comfortLabel: 'Niveau vise',
          notesLabel: 'Precisions',
          notesPlaceholder: 'Ex : contraintes, materiel, preference…',
          optionsContext: [
            { key: 'travel', label: 'Voyage' },
            { key: 'study', label: 'Etudes' },
            { key: 'conversation', label: 'Conversation' },
            { key: 'work', label: 'Travail' },
          ],
          optionsComfort: [
            { key: 'essential', label: 'Essentiel' },
            { key: 'comfortable', label: 'A l aise' },
            { key: 'fluent', label: 'Fluide' },
          ],
        },
        en: {
          contextLabel: 'Context',
          comfortLabel: 'Target level',
          notesLabel: 'Notes',
          notesPlaceholder: 'e.g., constraints, materials, preferences…',
          optionsContext: [
            { key: 'travel', label: 'Travel' },
            { key: 'study', label: 'Study' },
            { key: 'conversation', label: 'Conversation' },
            { key: 'work', label: 'Work' },
          ],
          optionsComfort: [
            { key: 'essential', label: 'Essential' },
            { key: 'comfortable', label: 'Comfortable' },
            { key: 'fluent', label: 'Fluent' },
          ],
        },
      }[base] ?? {
        contextLabel: 'Context',
        comfortLabel: 'Target level',
        notesLabel: 'Notes',
        notesPlaceholder: 'e.g., constraints, materials, preferences…',
        optionsContext: [
          { key: 'travel', label: 'Travel' },
          { key: 'study', label: 'Study' },
          { key: 'conversation', label: 'Conversation' },
          { key: 'work', label: 'Work' },
        ],
        optionsComfort: [
          { key: 'essential', label: 'Essential' },
          { key: 'comfortable', label: 'Comfortable' },
          { key: 'fluent', label: 'Fluent' },
        ],
      };
      return {
        template_key: 'general_fallback',
        prompt_version: 'clarify_chips_v1',
        lang: base,
        days,
        sections: [
          {
            id: 'context',
            label: fallback.contextLabel,
            type: 'single',
            options: fallback.optionsContext,
            default: fallback.optionsContext[0]?.key ?? 'travel',
          },
          {
            id: 'comfort',
            label: fallback.comfortLabel,
            type: 'single',
            options: fallback.optionsComfort,
            default: fallback.optionsComfort[0]?.key ?? 'essential',
          },
        ],
        trace: {
          cache: 'bypass',
          hash: '',
          timing_ms: 0,
          judge: 'clarifyChips',
          prompt_id: 'clarify_chips_v1',
        },
      };
    },
    [],
  );

  const getSectionById = useCallback((data: ClarifyContract | null, id: ClarifySection['id']) => {
    return data?.sections?.find((section) => section.id === id) ?? null;
  }, []);

  const getSectionDefault = useCallback((section: ClarifySection | null, fallback: string) => {
    if (!section) return fallback;
    return section.default ?? section.options?.[0]?.key ?? fallback;
  }, []);


  const openClarifyModal = useCallback(async () => {
    if (!confirmBeforeProceed) return;
    const intent = confirmBeforeProceed.intentionToSend;
    const intentLang = getDisplayLanguage(intent, locale ?? 'en');
    const domain = inferClarifyDomain(intent, confirmBeforeProceed.category);
    const intentKey = `${intent}::${confirmBeforeProceed.days}::${intentLang}::${domain}`;
    setClarifyModalOpen(true);
    setClarifyModalError(null);

    if (clarifyModalData && clarifyModalKey === intentKey) {
      setClarifyModalFallback(clarifyModalData.trace?.cache === 'bypass');
      setClarifyTrace(clarifyModalData.trace ?? null);
      const contextSection = getSectionById(clarifyModalData, 'context');
      const comfortSection = getSectionById(clarifyModalData, 'comfort');
      setClarifyDraft({
        context: clarifyApplied?.context ?? getSectionDefault(contextSection, DEFAULT_GOAL_CLARIFICATION.context),
        comfort: clarifyApplied?.comfort ?? getSectionDefault(comfortSection, DEFAULT_GOAL_CLARIFICATION.comfort),
      });
      return;
    }

    clarifyAbortRef.current?.abort();
    const controller = new AbortController();
    clarifyAbortRef.current = controller;
    const requestId = ++clarifyRequestIdRef.current;
    const startedAt = Date.now();

    setClarifyModalLoading(true);
    setClarifyModalFallback(false);
    setClarifyModalKey(intentKey);
    setClarifyModalData(null);
    setClarifyTrace(null);

    try {
      const res = await fetch('/api/decision/clarify-chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          intent,
          domain,
          lang: intentLang,
          days: confirmBeforeProceed.days,
          ui_locale: locale ?? 'en',
        }),
      });
      const data = (await res.json()) as ClarifyContract;
      const elapsed = Date.now() - startedAt;
      if (elapsed < 200) {
        await new Promise((resolve) => setTimeout(resolve, 200 - elapsed));
      }
      if (clarifyRequestIdRef.current !== requestId) return;
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error ?? 'error');
      }
      if (!data?.sections?.length) {
        throw new Error('invalid_data');
      }
      setClarifyModalData(data);
      setClarifyTrace(data.trace ?? null);
      setClarifyModalFallback(data.trace?.cache === 'bypass');
      const contextSection = getSectionById(data, 'context');
      const comfortSection = getSectionById(data, 'comfort');
      setClarifyDraft({
        context: clarifyApplied?.context ?? getSectionDefault(contextSection, DEFAULT_GOAL_CLARIFICATION.context),
        comfort: clarifyApplied?.comfort ?? getSectionDefault(comfortSection, DEFAULT_GOAL_CLARIFICATION.comfort),
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      if (clarifyRequestIdRef.current !== requestId) return;
      const fallback = buildClientFallback(intentLang, confirmBeforeProceed.days);
      setClarifyModalData(fallback);
      setClarifyTrace(fallback.trace ?? null);
      setClarifyModalFallback(true);
      setClarifyModalError(err instanceof Error ? err.message : 'error');
      const contextSection = getSectionById(fallback, 'context');
      const comfortSection = getSectionById(fallback, 'comfort');
      setClarifyDraft({
        context: clarifyApplied?.context ?? getSectionDefault(contextSection, DEFAULT_GOAL_CLARIFICATION.context),
        comfort: clarifyApplied?.comfort ?? getSectionDefault(comfortSection, DEFAULT_GOAL_CLARIFICATION.comfort),
      });
    } finally {
      if (clarifyRequestIdRef.current === requestId) {
        setClarifyModalLoading(false);
      }
    }
  }, [
    clarifyApplied,
    clarifyModalData,
    clarifyModalKey,
    buildClientFallback,
    confirmBeforeProceed,
    getSectionById,
    getSectionDefault,
    inferClarifyDomain,
    locale,
  ]);

  const closeClarifyModal = useCallback(() => {
    clarifyAbortRef.current?.abort();
    setClarifyModalOpen(false);
    setClarifyModalError(null);
    setClarifyModalLoading(false);
  }, []);

  useEffect(() => {
    if (!confirmBeforeProceed) return;
    setClarifyApplied(null);
    setClarifyDraft({
      context: DEFAULT_GOAL_CLARIFICATION.context,
      comfort: DEFAULT_GOAL_CLARIFICATION.comfort,
    });
    setClarifyModalOpen(false);
    setClarifyModalLoading(false);
    setClarifyModalError(null);
    setClarifyModalFallback(false);
    setClarifyModalData(null);
    setClarifyModalKey(null);
    setClarifyTrace(null);
    clarifyAbortRef.current?.abort();
  }, [confirmBeforeProceed]);

  const applyClarifyUpdate = () => {
    if (!confirmBeforeProceed) return;
    const next: GoalClarification = {
      context: clarifyDraft.context,
      comfort: clarifyDraft.comfort,
      deadline_days: confirmBeforeProceed.days,
    };
    setClarifyApplied(next);
    setClarifyModalOpen(false);
    setConfirmBeforeProceed((prev) =>
      prev ? { ...prev, days: next.deadline_days } : prev,
    );
    proceedToMission({
      intentionToSend: confirmBeforeProceed.intentionToSend,
      days: next.deadline_days,
      category: confirmBeforeProceed.category,
      ritualId: confirmBeforeProceed.ritualId,
      realismAck: false,
      goalClarification: next,
    });
    setConfirmBeforeProceed(null);
  };

  const finalDays = useMemo(() => selectedDays ?? 14, [selectedDays]);
  const activeDayOption = useMemo(() => getNearestDayOption(finalDays), [finalDays]);

  /** When gate is ACTIONABLE, never show inline hint/suggestion block (defensive invariant). */
  const allowInlineHint = lastSubmitDebug?.gateStatus !== 'ACTIONABLE';

  /** When gate is ACTIONABLE, never show the "not actionable" hint (defensive guard). */
  const effectiveInlineHint = useMemo(() => {
    if (lastSubmitDebug?.gateStatus === 'ACTIONABLE' && isNotActionableHint(inlineHint, t as Record<string, string>)) return null;
    return inlineHint;
  }, [lastSubmitDebug?.gateStatus, inlineHint, t]);
  const dayStage = dayStages[activeDayOption] ?? { icon: '🌿', label: 'Foundations' };
  const sliderProgress = (finalDays - 7) / (90 - 7);
  const daysTitle = t.homeDaysQuestion;
  const helperCopy = t.homeDocsHelper;
  const addDocsCopy = t.homeAddDocs;
  const aiBadgeCopy = isFrench ? '✨ Guidé par IA' : '✨ AI-powered';
  const daysUnitCopy = isFrench ? 'jours' : 'days';
  const ctaCopy = isFrench ? 'Créer mon parcours →' : 'Create my learning path →';

  const PENDING_REQUEST_KEY = 'loe.pending_ritual_request';
  const PENDING_RESULT_KEY = 'loe.pending_ritual_result';

  /** Centralized reset of UI messages/hints. Call at start of submit, when intent changes, and just before proceedToMission. */
  const resetUiMessages = () => {
    setSubmitError(null);
    setInlineHint(null);
    setInlineHintSecondary(null);
    setSuggestedRephrase(null);
    setSuggestedRewrites(null);
    setRealismPending(null);
    setShowConfirmationAdjustments(false);
    setStretchMessage(null);
    setAmbitionPending(null);
    setTwoPathPending(null);
    setControllabilityPending(null);
    setConfirmBeforeProceed(null);
    setRephrasePlaceholderActive(false);
    setLastSubmitReformulation(null);
    setAudienceSafetyLevel(null);
    setLastSubmitDebug(null);
  };

  const createRitualId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `ritual_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  };

  const storePendingRequest = (payload: {
    ritualId: string;
    intention: string;
    days: number;
    locale?: string;
    category?: string;
    clarification?: {
      originalIntention: string;
      chosenLabel: string;
      chosenDomainId: string;
      createdAt: string;
    };
  }) => {
    if (typeof window === 'undefined') return false;
    try {
      window.sessionStorage.setItem(PENDING_REQUEST_KEY, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  };

  const proceedToMission = async (params: {
    intentionToSend: string;
    days: number;
    category?: string;
    ritualId: string;
    realismAck: boolean;
    goalClarification?: GoalClarification;
  }) => {
    const { intentionToSend, days, category, ritualId, realismAck, goalClarification } = params;
    resetUiMessages();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/missions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intention: intentionToSend,
          days,
          locale,
          ritualId,
          category,
          realism_acknowledged: realismAck,
          goal_clarification: goalClarification,
        }),
      });
      const data = await res.json();
      const payload = data?.data ?? data;
      if (data?.blocked && data?.clarification?.mode === 'inline' && data?.clarification?.type === 'safety') {
        setLastSubmittedIntent(intentionToSend);
        setInlineHintDbg((t as Record<string, string>).safetyInlineMessage ?? GateCopy.safetyBlockedMessage(), 'proceedToMission:safety');
        setInlineHintSecondaryDbg((t as Record<string, string>).safetyInlineFallbackExample ?? GateCopy.safetyBlockedSecondary(), 'proceedToMission:safety');
        setIsSubmitting(false);
        return;
      }
      if (data?.blocked) {
        setSubmitError(data.block_reason ?? data.reason_code ?? 'blocked');
        setIsSubmitting(false);
        return;
      }
      if (!res.ok) {
        setSubmitError(data?.details ?? data?.error ?? 'error');
        setIsSubmitting(false);
        return;
      }
      if (payload?.needsClarification && payload?.clarification?.mode === 'inline' && USE_V2) {
        if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
          console.warn(
            '[Home V2] generate returned needsClarification after PROCEED_TO_GENERATE — engine bug; do not show generic action+result hint.',
            { intentionToSend: intentionToSend.slice(0, 60) },
          );
        }
        setLastSubmittedIntent(intentionToSend);
        const tRec = t as Record<string, string>;
        setInlineHintDbg(
          payload.clarification?.question ?? tRec.inlineClarifyHint ?? 'Please clarify your goal.',
          'proceedToMission:needsClarification_v2',
        );
        setInlineHintSecondaryDbg(null, 'proceedToMission:needsClarification_v2');
        setLastSubmitDebug({
          branch: 'proceedToMission:needsClarification_v2',
          gateStatus: 'ACTIONABLE',
          categoryInferred: payload?.category ?? category,
          engine: 'v2',
          fallback_to_legacy: false,
          generateNeedsClarification: true,
        });
        setIsSubmitting(false);
        return;
      }
      if (payload?.path && payload?.missionStubs) {
        const ok = storePendingRequest({
          ritualId,
          intention: intentionToSend,
          days,
          locale,
          category: payload?.category ?? category,
        });
        if (ok && typeof window !== 'undefined') {
          try {
            const toStore = { ...payload, debugTrace: data?.debugTrace };
            window.sessionStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(toStore));
          } catch {
            /* ignore */
          }
        }
        const ideaIdToMark = pendingIdeaIdRef.current;
        if (ideaIdToMark) {
          pendingIdeaIdRef.current = null;
          setIdeaIdUsedForRitual(ideaIdToMark);
          setTimeout(() => setIdeaIdUsedForRitual(null), 500);
        }
        setIsSubmitting(false);
        router.push(`/mission?creating=1&ritualId=${ritualId}`);
      } else {
        setSubmitError('Impossible de lancer la génération.');
        setIsSubmitting(false);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'error');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!intention.trim() || isSubmitting) {
      return;
    }
    resetUiMessages();
    setIsSubmitting(true);
    setLastSubmitPromptTrace(null);
    const ritualId = createRitualId();
    setLastRitualId(ritualId);
    const trimmed = intention.trim();

    let usedLegacyBecauseFallback = false;
    let fallbackReason: string | null = null;

    if (USE_V2) {
      try {
        const res = await fetch('/api/decision/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: trimmed, days: finalDays, ui_locale: locale ?? 'en' }),
        });
        if (!res.ok) {
          usedLegacyBecauseFallback = true;
          fallbackReason = 'api_error';
        } else {
          const result = (await res.json()) as {
            outcome: string;
            payload: Record<string, unknown> & { privacy_blocked?: boolean; error_key?: string };
            debug?: { branch?: string; category?: string; fingerprint?: string; similarity_hit?: boolean; matched_record_id?: string };
            prompt_trace?: { prompt_name: string; response: string }[];
          };
          setLastSubmitPromptTrace(result.prompt_trace ?? null);
          if (result.payload?.privacy_blocked === true) {
            setControllabilityPending(null);
            setSuggestedRephrase(null);
            setInlineHintDbg((t as Record<string, string>).privacyUserMessage ?? 'Please do not share confidential information.', 'privacy_blocked');
            setInlineHintSecondaryDbg(null, 'privacy_blocked');
            setLastSubmitDebug({ branch: 'privacy_blocked', gateStatus: 'BLOCKED', engine: 'v2' });
            setIsSubmitting(false);
            return;
          }
          if (!isRenderableDecisionResult(result)) {
            usedLegacyBecauseFallback = true;
            fallbackReason = 'no_usable_outcome';
          } else {
            setLastSubmittedIntent(trimmed);
            let audienceSafetyLevel: 'all_ages' | 'adult_only' | 'blocked' = 'all_ages';
            try {
              const assessRes = await fetch('/api/audience-safety/assess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intent: trimmed, days: finalDays, ui_locale: locale ?? 'en' }),
              });
              const assessData = (await assessRes.json()) as { level?: string };
              audienceSafetyLevel = (assessData?.level as 'all_ages' | 'adult_only' | 'blocked') ?? 'all_ages';
              if (audienceSafetyLevel === 'blocked') {
                setControllabilityPending(null);
                setSuggestedRephrase(null);
                setInlineHintDbg((t as Record<string, string>).safetyInlineMessage ?? GateCopy.safetyBlockedMessage(), 'audience_safety:blocked');
                setInlineHintSecondaryDbg((t as Record<string, string>).safetyInlineFallbackExample ?? GateCopy.safetyBlockedSecondary(), 'audience_safety:blocked');
                setLastSubmitDebug({ branch: 'audience_safety_blocked', gateStatus: 'BLOCKED', engine: 'v2', fallback_to_legacy: false });
                setIsSubmitting(false);
                return;
              }
              if (audienceSafetyLevel === 'adult_only') setAudienceSafetyLevel('adult_only');
            } catch {
              setAudienceSafetyLevel(null);
            }
            let toneResult: string | null = null;
            try {
              const intentLang = getDisplayLanguage(trimmed, locale);
              const toneRes = await fetch('/api/tone/assess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  intent: trimmed,
                  days: finalDays,
                  ui_locale: locale ?? 'en',
                  intent_lang: intentLang,
                }),
              });
              const toneData = (await toneRes.json()) as { tone?: string };
              toneResult = typeof toneData.tone === 'string' ? toneData.tone : null;
            } catch {
              /* use null => decideUiOutcome will use decision only */
            }
            const resolved = decideUiOutcome({
              decisionOutcome: result.outcome,
              decisionPayload: result.payload as Record<string, unknown>,
              decisionDebug: result.debug ?? undefined,
              audienceSafetyLevel: audienceSafetyLevel ?? null,
              tone: toneResult ?? undefined,
            });
            if (resolved.ui_outcome === 'blocked') {
              setControllabilityPending(null);
              setSuggestedRephrase(null);
              setInlineHintDbg((t as Record<string, string>).safetyInlineMessage ?? GateCopy.safetyBlockedMessage(), 'engine:blocked');
              setInlineHintSecondaryDbg((t as Record<string, string>).safetyInlineFallbackExample ?? GateCopy.safetyBlockedSecondary(), 'engine:blocked');
              setLastSubmitDebug({
                branch: (result.debug?.branch as string) ?? 'engine_blocked',
                gateStatus: 'BLOCKED',
                reason_code: (result.payload as { reason_code?: string })?.reason_code,
                engine: 'v2',
                fallback_to_legacy: false,
                tone: resolved.tone,
                fingerprint: result.debug?.fingerprint,
                similarity_hit: result.debug?.similarity_hit,
                matched_record_id: result.debug?.matched_record_id,
              });
              setIsSubmitting(false);
              return;
            }
            if (resolved.ui_outcome === 'show_angles') {
              const pl = result.payload as {
                primary?: string;
                secondary?: string;
                angles?: Array<{ label: string; next_intent: string; days?: number }>;
                original_intent?: string;
                rewritten_intent?: string | null;
                reformulation_includes_days?: boolean;
              };
              const anglesFromResolved = resolved.suggestions?.angles ?? pl.angles ?? [];
              const angles = anglesFromResolved.slice(0, 4).map((a) => ({
                label: String((t as Record<string, string>)[a.label] ?? a.label).replace('{days}', String(a.days ?? finalDays)),
                intent: a.next_intent,
                days: a.days,
              }));
              const ctrl = detectControllability(trimmed, locale ?? 'en', (resolved.category ?? undefined) as Category | undefined);
              const copyResult = resolveCopyVariant({
                audience_safety_level: audienceSafetyLevel ?? null,
                tone: resolved.tone ?? null,
                ui_outcome: resolved.ui_outcome,
                controllability_reason_code: ctrl.reason_code ?? null,
                classify_reason_code: null,
              });
              const tRec = t as Record<string, string>;
              const reformulationText = (pl.rewritten_intent ?? pl.original_intent ?? trimmed).trim();
              setLastSubmitReformulation({
                text: reformulationText,
                days: finalDays,
                includesDays: pl.reformulation_includes_days === true,
              });
              setControllabilityPending({
                primary: tRec[copyResult.title_key] ?? copyResult.title_key,
                secondary: tRec[copyResult.body_key] ?? copyResult.body_key,
                angles,
                ritualId,
                days: finalDays,
                originalIntent: pl.original_intent ?? trimmed,
                rewrittenIntent: pl.rewritten_intent ?? undefined,
                reformulationIncludesDays: pl.reformulation_includes_days === true,
                copyVariant: copyResult.variant,
                title_key: copyResult.title_key,
                body_key: copyResult.body_key,
                debug_why: copyResult.debug_why,
              });
              setInlineHint(null);
              setInlineHintSecondary(null);
              setSuggestedRephrase(null);
              setLastSubmitDebug({
                branch: (result.debug?.branch as string) ?? 'engine_angles',
                gateStatus: 'ACTIONABLE',
                categoryInferred: resolved.category ?? result.debug?.category,
                engine: 'v2',
                fallback_to_legacy: false,
                tone: resolved.tone,
                copy_variant: copyResult.variant,
                copy_why: copyResult.debug_why,
                fingerprint: result.debug?.fingerprint,
                similarity_hit: result.debug?.similarity_hit,
                matched_record_id: result.debug?.matched_record_id,
              });
              setIsSubmitting(false);
              return;
            }
            if (resolved.ui_outcome === 'proceed') {
              const pl = result.payload as {
                days?: number;
                category?: string;
                rewritten_intent?: string;
                reformulation_includes_days?: boolean;
                guide_title?: string;
                objectives?: string[];
              };
              const intentionToSend = pl.rewritten_intent?.trim() || trimmed;
              const days = pl.days ?? finalDays;
              setLastSubmitReformulation({
                text: intentionToSend,
                days,
                includesDays: pl.reformulation_includes_days === true,
              });
              setConfirmBeforeProceed({
                intentionToSend,
                originalIntent: trimmed,
                ritualId,
                days,
                category: pl.category,
                reformulationIncludesDays: pl.reformulation_includes_days === true,
                guide_title: pl.guide_title,
                objectives: pl.objectives?.length ? pl.objectives : undefined,
              });
              setIsSubmitting(false);
              return;
            }
            if (resolved.ui_outcome === 'needs_clarify') {
              const pl = result.payload as { clarify_question?: string; suggested_rewrites?: Array<{ label: string; next_intent: string }> };
              setInlineHintDbg(null, 'engine:ask_clarification'); /* ne pas afficher la clarify_question, seulement les suggestions */
              setInlineHintSecondaryDbg(null, 'engine:ask_clarification');
              if (pl.suggested_rewrites?.length) {
                setSuggestedRewrites(pl.suggested_rewrites);
                setSuggestedRephraseDbg(pl.suggested_rewrites[0]?.next_intent ?? null, 'engine:ask_clarification');
              } else {
                setSuggestedRewrites(null);
                setSuggestedRephraseDbg(null, 'engine:ask_clarification');
              }
              setLastSubmitDebug({
                branch: (result.debug?.branch as string) ?? 'engine_ask_clarification',
                gateStatus: 'BORDERLINE',
                categoryInferred: resolved.category ?? result.debug?.category,
                engine: 'v2',
                fallback_to_legacy: false,
                tone: resolved.tone,
                fingerprint: result.debug?.fingerprint,
                similarity_hit: result.debug?.similarity_hit,
                matched_record_id: result.debug?.matched_record_id,
              });
              setIsSubmitting(false);
              return;
            }
            if (resolved.ui_outcome === 'show_ambition_confirm') {
              const pl = result.payload as { intent?: string; days?: number; marker?: string };
              setAmbitionPending({
                intent: pl.intent ?? trimmed,
                days: pl.days ?? finalDays,
                ritualId,
                marker: pl.marker,
              });
              setLastSubmitDebug({
                branch: (result.debug?.branch as string) ?? 'engine_confirm_ambition',
                gateStatus: 'BORDERLINE',
                categoryInferred: resolved.category ?? result.debug?.category,
                engine: 'v2',
                fallback_to_legacy: false,
                tone: resolved.tone,
                fingerprint: result.debug?.fingerprint,
                similarity_hit: result.debug?.similarity_hit,
                matched_record_id: result.debug?.matched_record_id,
              });
              setIsSubmitting(false);
              return;
            }
            if (resolved.ui_outcome === 'choose_category') {
              const pl = result.payload as { suggestions?: Array<{ category: string; label_key: string }> };
              const first = pl.suggestions?.[0];
              const hint = first
                ? (t as Record<string, string>)[first.label_key] ?? first.label_key
                : (t as Record<string, string>).inlineClarifyHint ?? 'Choose a category that best fits your goal.';
              setInlineHintDbg(hint, 'engine:choose_category');
              setInlineHintSecondaryDbg(null, 'engine:choose_category');
              setLastSubmitDebug({
                branch: (result.debug?.branch as string) ?? 'engine_choose_category',
                gateStatus: 'BORDERLINE',
                categoryInferred: resolved.category ?? result.debug?.category,
                engine: 'v2',
                fallback_to_legacy: false,
                tone: resolved.tone,
                fingerprint: result.debug?.fingerprint,
                similarity_hit: result.debug?.similarity_hit,
                matched_record_id: result.debug?.matched_record_id,
              });
              setIsSubmitting(false);
              return;
            }
            if (resolved.ui_outcome === 'playful_nonsense') {
              const hint = (t as Record<string, string>).humorResponse ?? GateCopy.humorResponse();
              setInlineHintDbg(hint, 'engine:playful_nonsense');
              setInlineHintSecondaryDbg(null, 'engine:playful_nonsense');
              setLastSubmitDebug({
                branch: (result.debug?.branch as string) ?? 'engine_playful_nonsense',
                gateStatus: 'BORDERLINE',
                categoryInferred: resolved.category ?? result.debug?.category,
                engine: 'v2',
                fallback_to_legacy: false,
                tone: resolved.tone,
                fingerprint: result.debug?.fingerprint,
                similarity_hit: result.debug?.similarity_hit,
                matched_record_id: result.debug?.matched_record_id,
              });
              setIsSubmitting(false);
              return;
            }
            if (resolved.ui_outcome === 'show_realism_adjust') {
              const pl = result.payload as {
                why_short?: string;
                adjustments?: Array<{ label: string; next_intent: string; next_days?: number }>;
                intentionToSend?: string;
                days?: number;
                category?: string;
              };
              const intentionToSend = pl.intentionToSend?.trim() ?? trimmed;
              const adjustments: RealismAdjustment[] = (pl.adjustments ?? []).map((a) => ({
                type: 'reduce_scope' as const,
                label: a.label,
                next_intent: a.next_intent,
                next_days: a.next_days,
              }));
              setRealismPending({
                intentionToSend,
                days: pl.days ?? finalDays,
                category: pl.category,
                ritualId,
                why_short: pl.why_short ?? '',
                adjustments,
                needsConfirmation: false,
              });
              setLastSubmitDebug({
                branch: (result.debug?.branch as string) ?? 'engine_realism_adjust',
                gateStatus: 'BORDERLINE',
                categoryInferred: pl.category ?? resolved.category,
                engine: 'v2',
                fallback_to_legacy: false,
                tone: resolved.tone,
                fingerprint: result.debug?.fingerprint,
                similarity_hit: result.debug?.similarity_hit,
                matched_record_id: result.debug?.matched_record_id,
              });
              setIsSubmitting(false);
              return;
            }
          }
        }
      } catch {
        usedLegacyBecauseFallback = true;
        fallbackReason = 'exception';
      }
      if (usedLegacyBecauseFallback && showDevTools && typeof window !== 'undefined') {
        console.warn('[decision_engine_fallback]', fallbackReason);
      }
    }

    const legacyDebugExtras = {
      engine: 'legacy' as const,
      fallback_to_legacy: usedLegacyBecauseFallback,
      fallback_reason: fallbackReason ?? undefined,
    };

    try {
      const actionabilityResult = runActionabilityV2(trimmed, finalDays);
      const gate = toGateResult(actionabilityResult);

      try {
        const assessRes = await fetch('/api/audience-safety/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: trimmed, days: finalDays, ui_locale: locale ?? 'en' }),
        });
        const assessData = (await assessRes.json()) as { level?: string };
        if (assessData?.level === 'blocked') {
          setLastSubmittedIntent(trimmed);
          setControllabilityPending(null);
          setSuggestedRephrase(null);
          setInlineHintDbg((t as Record<string, string>).safetyInlineMessage ?? GateCopy.safetyBlockedMessage(), 'audience_safety:blocked:legacy');
          setInlineHintSecondaryDbg((t as Record<string, string>).safetyInlineFallbackExample ?? GateCopy.safetyBlockedSecondary(), 'audience_safety:blocked:legacy');
          setLastSubmitDebug({ branch: 'audience_safety_blocked', gateStatus: 'BLOCKED', ...legacyDebugExtras });
          setIsSubmitting(false);
          return;
        }
        if (assessData?.level === 'adult_only') setAudienceSafetyLevel('adult_only');
      } catch {
        setAudienceSafetyLevel(null);
      }

      if (gate.status === 'NOT_ACTIONABLE_INLINE') {
        setLastSubmittedIntent(trimmed);
        setInlineHintDbg(gateMessage(t as Record<string, string>, 'actionabilityNotActionableHint'), 'NOT_ACTIONABLE_INLINE');
        setLastSubmitDebug({
          branch: 'inline_hint',
          gateStatus: gate.status,
          reason_code: actionabilityResult.reason_code,
          lifeGoalHit: false,
          ...legacyDebugExtras,
        });
        setIsSubmitting(false);
        return;
      }

      const lifeGoalResult = isLifeGoalOrRoleAspiration(trimmed);

      if (lifeGoalResult.hit) {
        setLastSubmittedIntent(trimmed);
        setAmbitionPending({ intent: trimmed, days: finalDays, ritualId, marker: lifeGoalResult.marker });
        setLastSubmitDebug({
          branch: 'life_goal_confirm',
          gateStatus: gate.status,
          reason_code: actionabilityResult.reason_code,
          lifeGoalHit: true,
          lifeGoalMarker: lifeGoalResult.marker,
          ...legacyDebugExtras,
        });
        setIsSubmitting(false);
        return;
      }

      const categoryInferred = (gate.category ?? inferCategoryFromIntent(trimmed)) as Category | undefined;
      const ctrl = detectControllability(trimmed, locale, categoryInferred);

      if (ctrl.level === 'low' && ctrl.confidence >= CONTROLLABILITY_CONFIDENCE_THRESHOLD) {
        const categoryForAngles = categoryInferred ?? 'WELLBEING';
        const intentLang = getDisplayLanguage(trimmed, locale);
        const defaultAngles = getDefaultControllableAngles(
          categoryForAngles,
          locale,
          trimmed,
          finalDays,
          intentLang,
        );
        const angles = defaultAngles.map((a) => ({
          label: String((t as Record<string, string>)[a.label_key] ?? a.label_key).replace('{days}', String(a.days ?? finalDays)),
          intent: a.intent,
          days: a.days,
        }));
        const copyResultLegacy = resolveCopyVariant({
          audience_safety_level: null,
          tone: undefined,
          ui_outcome: 'show_angles',
          controllability_reason_code: ctrl.reason_code ?? null,
          classify_reason_code: null,
        });
        const tRecLegacy = t as Record<string, string>;
        setLastSubmittedIntent(trimmed);
        setControllabilityPending({
          primary: tRecLegacy[copyResultLegacy.title_key] ?? copyResultLegacy.title_key,
          secondary: tRecLegacy[copyResultLegacy.body_key] ?? copyResultLegacy.body_key,
          angles,
          ritualId,
          days: finalDays,
          originalIntent: trimmed,
          rewrittenIntent: undefined,
          copyVariant: copyResultLegacy.variant,
          title_key: copyResultLegacy.title_key,
          body_key: copyResultLegacy.body_key,
          debug_why: copyResultLegacy.debug_why,
        });
        setLastSubmitDebug({
          branch: 'controllability_support',
          gateStatus: gate.status,
          reason_code: ctrl.reason_code,
          categoryInferred: categoryForAngles,
          controllabilityLevel: ctrl.level,
          copy_variant: copyResultLegacy.variant,
          copy_why: copyResultLegacy.debug_why,
          ...legacyDebugExtras,
        });
        setIsSubmitting(false);
        return;
      }

      if (ctrl.level === 'medium' || ctrl.confidence < CONTROLLABILITY_CONFIDENCE_THRESHOLD) {
        const intentLang = getDisplayLanguage(trimmed, locale);
        const lookupRes = await fetch('/api/db/decision/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: trimmed,
            days: finalDays,
            ui_locale: locale,
            intent_lang: intentLang,
            category: categoryInferred,
            requires_feasibility: categoryInferred ? categoryRequiresFeasibility(categoryInferred) : false,
            gate: 'controllability',
          }),
        });
        const lookupData = (await lookupRes.json()) as {
          found?: boolean;
          fresh?: boolean;
          record?: {
            suggestions?: { angles?: Array<{ label: string; intent: string; days?: number }>; rewritten_intent?: string | null };
          };
        };
        if (lookupData.found && lookupData.fresh && lookupData.record?.suggestions?.angles?.length) {
          const angles = lookupData.record.suggestions.angles.slice(0, 4).map((a) => ({
            label: a.label,
            intent: a.intent,
            days: a.days,
          }));
          const copyResultDb = resolveCopyVariant({
            audience_safety_level: null,
            tone: undefined,
            ui_outcome: 'show_angles',
            controllability_reason_code: ctrl.reason_code ?? null,
            classify_reason_code: null,
          });
          const tRecDb = t as Record<string, string>;
          setLastSubmittedIntent(trimmed);
          setControllabilityPending({
            primary: tRecDb[copyResultDb.title_key] ?? copyResultDb.title_key,
            secondary: tRecDb[copyResultDb.body_key] ?? copyResultDb.body_key,
            angles,
            ritualId,
            days: finalDays,
            originalIntent: trimmed,
            rewrittenIntent: lookupData.record.suggestions.rewritten_intent ?? null,
            copyVariant: copyResultDb.variant,
            title_key: copyResultDb.title_key,
            body_key: copyResultDb.body_key,
            debug_why: copyResultDb.debug_why,
          });
          setLastSubmitDebug({
            branch: 'controllability_support_db',
            gateStatus: gate.status,
            reason_code: 'cached',
            categoryInferred,
            controllabilityLevel: ctrl.level,
            copy_variant: copyResultDb.variant,
            copy_why: copyResultDb.debug_why,
            ...legacyDebugExtras,
          });
          setIsSubmitting(false);
          return;
        }
        const checkRes = await fetch('/api/controllability/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: trimmed,
            timeframe_days: finalDays,
            locale,
            category_hint: categoryInferred,
          }),
        });
        const checkData = (await checkRes.json()) as {
          level?: string;
          reason_code?: string;
          confidence?: number;
          rewritten_intent?: string | null;
          angles?: Array<{ label: string; intent: string; days?: number }>;
        };
        if (checkData.level === 'low') {
          const angles = (checkData.angles ?? []).slice(0, 4).map((a) => ({
            label: a.label,
            intent: a.intent,
            days: a.days,
          }));
          try {
            await fetch('/api/db/decision/upsert-from-controllability', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                intent: trimmed,
                days: finalDays,
                ui_locale: locale,
                intent_lang: intentLang,
                category: categoryInferred,
                level: checkData.level,
                reason_code: checkData.reason_code,
                confidence: checkData.confidence,
                rewritten_intent: checkData.rewritten_intent,
                angles: checkData.angles,
              }),
            });
          } catch {
            /* persist best-effort */
          }
          const copyResultLlm = resolveCopyVariant({
            audience_safety_level: null,
            tone: undefined,
            ui_outcome: 'show_angles',
            controllability_reason_code: checkData.reason_code ?? null,
            classify_reason_code: null,
          });
          const tRecLlm = t as Record<string, string>;
          setLastSubmittedIntent(trimmed);
          setControllabilityPending({
            primary: tRecLlm[copyResultLlm.title_key] ?? copyResultLlm.title_key,
            secondary: tRecLlm[copyResultLlm.body_key] ?? copyResultLlm.body_key,
            angles,
            ritualId,
            days: finalDays,
            originalIntent: trimmed,
            rewrittenIntent: checkData.rewritten_intent ?? null,
            copyVariant: copyResultLlm.variant,
            title_key: copyResultLlm.title_key,
            body_key: copyResultLlm.body_key,
            debug_why: copyResultLlm.debug_why,
          });
          setLastSubmitDebug({
            branch: 'controllability_support_llm',
            gateStatus: gate.status,
            reason_code: checkData.reason_code,
            categoryInferred,
            controllabilityLevel: ctrl.level,
            copy_variant: copyResultLlm.variant,
            copy_why: copyResultLlm.debug_why,
            ...legacyDebugExtras,
          });
          setIsSubmitting(false);
          return;
        }
      }

      if (gate.status === 'BORDERLINE') {
        const intentLang = getDisplayLanguage(trimmed, locale);
        const classifyRes = await fetch('/api/actionability/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: trimmed,
            timeframe_days: finalDays,
            display_lang: intentLang,
            ui_locale: locale,
          }),
        });
        const classifyData = (await classifyRes.json()) as {
          verdict?: string;
          reason_code?: string;
          category?: string | null;
          normalized_intent?: string;
          suggested_rephrase?: string | null;
          realism?: string;
          realism_why_short?: string;
          realism_adjustments?: RealismAdjustment[];
          privacy_blocked?: boolean;
        };
        if (classifyData.privacy_blocked === true || classifyData.reason_code === 'privacy_blocked') {
          setInlineHintDbg((t as Record<string, string>).privacyUserMessage ?? 'Please do not share confidential information.', 'BORDERLINE:privacy_blocked');
          setInlineHintSecondaryDbg(null, 'BORDERLINE:privacy_blocked');
          setLastSubmitDebug({ branch: 'privacy_blocked', gateStatus: 'BLOCKED', reason_code: 'privacy_blocked', lifeGoalHit: false });
          setIsSubmitting(false);
          return;
        }
        try {
          await fetch('/api/db/decision/upsert-from-classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              intent: trimmed,
              days: finalDays,
              ui_locale: locale,
              intent_lang: intentLang,
              category: categoryInferred,
              category_from_classify: classifyData.category,
              verdict: classifyData.verdict,
              reason_code: classifyData.reason_code,
              normalized_intent: classifyData.normalized_intent,
              suggested_rephrase: classifyData.suggested_rephrase,
              realism: classifyData.realism,
              realism_why_short: classifyData.realism_why_short,
              realism_adjustments: classifyData.realism_adjustments,
            }),
          });
        } catch {
          /* persist best-effort */
        }
        if (classifyData.verdict === 'ACTIONABLE') {
          const intentionToSend = classifyData.normalized_intent?.trim() || trimmed;
          const realismLevel = (classifyData as { realism?: string }).realism;
          const realismWhy = (classifyData as { realism_why_short?: string }).realism_why_short;
          const realismAdjustments = (classifyData as { realism_adjustments?: RealismAdjustment[] }).realism_adjustments ?? [];
          if (realismLevel === 'unrealistic' && realismAdjustments.length > 0) {
            setLastSubmittedIntent(trimmed);
            setRealismPending({
              intentionToSend,
              days: finalDays,
              category: classifyData.category ?? undefined,
              ritualId,
              why_short: realismWhy,
              adjustments: realismAdjustments,
              needsConfirmation: needsAmbitionConfirmation(trimmed),
            });
            setLastSubmitDebug({
              branch: 'realism_pending',
              gateStatus: 'BORDERLINE',
              reason_code: classifyData.reason_code,
              lifeGoalHit: false,
              classifyVerdict: classifyData.verdict,
              classifyCategory: classifyData.category ?? undefined,
              ...legacyDebugExtras,
            });
            setIsSubmitting(false);
            return;
          }
          if (realismLevel === 'stretch' && realismWhy) {
            setStretchMessage(realismWhy);
          }
          const res = await fetch('/api/missions/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              intention: intentionToSend,
              days: finalDays,
              locale,
              ritualId,
              category: classifyData.category ?? undefined,
              realism_acknowledged: false,
            }),
          });
          const data = await res.json();
          const payload = data?.data ?? data;
          if (data?.blocked && data?.clarification?.mode === 'inline' && data?.clarification?.type === 'safety') {
            setLastSubmittedIntent(trimmed);
            setInlineHintDbg((t as Record<string, string>).safetyInlineMessage ?? GateCopy.safetyBlockedMessage(), 'BORDERLINE:generate:safety');
            setInlineHintSecondaryDbg((t as Record<string, string>).safetyInlineFallbackExample ?? GateCopy.safetyBlockedSecondary(), 'BORDERLINE:generate:safety');
            setIsSubmitting(false);
            return;
          }
          if (data?.blocked) {
            setSubmitError(data.block_reason ?? data.reason_code ?? 'blocked');
            setIsSubmitting(false);
            return;
          }
          if (!res.ok) {
            setSubmitError(data?.details ?? data?.error ?? 'error');
            setIsSubmitting(false);
            return;
          }
          if (payload?.path && payload?.missionStubs) {
            const ok = storePendingRequest({
              ritualId,
              intention: intentionToSend,
              days: finalDays,
              locale,
              category: payload?.category,
            });
            if (ok && typeof window !== 'undefined') {
              try {
                const toStore = { ...payload, debugTrace: data?.debugTrace };
                window.sessionStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(toStore));
              } catch {
                /* ignore */
              }
            }
            setLastSubmitDebug({
              branch: 'proceed',
              gateStatus: 'BORDERLINE',
              reason_code: classifyData.reason_code,
              lifeGoalHit: false,
              classifyVerdict: classifyData.verdict,
              classifyCategory: classifyData.category ?? undefined,
              ...legacyDebugExtras,
            });
            setIsSubmitting(false);
            router.push(`/mission?creating=1&ritualId=${ritualId}`);
            return;
          }
        }
        setLastSubmittedIntent(trimmed);
        const inlineMessage = getClassifyInlineMessage(classifyData);
        const tRec = t as Record<string, string>;
        if (inlineMessage) {
          setInlineHintDbg(localizeClassifyMessage(inlineMessage.hint, tRec), 'BORDERLINE:classify:inlineMessage');
          setInlineHintSecondaryDbg(inlineMessage.secondary ? localizeClassifyMessage(inlineMessage.secondary, tRec) : null, 'BORDERLINE:classify:inlineMessage');
          setSuggestedRephraseDbg(inlineMessage.suggestedRephrase, 'BORDERLINE:classify:inlineMessage');
        } else {
          const controllability = detectControllabilityLegacy(trimmed);
          const useTwoPath =
            classifyData.category === 'WELLBEING' &&
            (classifyData.reason_code === 'ambiguous_goal' || controllability.controllability === 'PARTIALLY_EXTERNAL');
          if (useTwoPath) {
            setTwoPathPending({
              primary: gateMessage(tRec, 'wellbeingTwoPathsPrimary'),
              optionA: {
                label: gateMessage(tRec, 'wellbeingTwoPathsOptionA', finalDays),
                next_intent: GateCopy.wellbeingPathAIntent(),
              },
              optionB: {
                label: gateMessage(tRec, 'wellbeingTwoPathsOptionB', finalDays),
                next_intent: GateCopy.wellbeingPathBIntent(),
              },
              ritualId,
              days: finalDays,
            });
            setInlineHint(null);
            setSuggestedRephrase(null);
          } else {
            const noSuggestion = classifyData.reason_code === 'safety_no_suggestion' || !classifyData.suggested_rephrase?.trim();
            if (noSuggestion) {
              setInlineHintDbg(gateMessage(tRec, 'noSuggestionHint'), 'BORDERLINE:classify:noSuggestion');
              setSuggestedRephrase(null);
            } else {
              const hint =
                classifyData.category === 'WELLBEING'
                  ? gateMessage(tRec, 'wellbeingRephraseHint')
                  : gateMessage(tRec, 'inlineNotActionablePrimary');
              setInlineHintDbg(hint, 'BORDERLINE:classify:rephrase');
              setSuggestedRephraseDbg(classifyData.suggested_rephrase ?? null, 'BORDERLINE:classify:rephrase');
            }
          }
          setInlineHintSecondaryDbg(null, 'BORDERLINE:classify');
        }
        setLastSubmitDebug({
          branch: 'inline_hint',
          gateStatus: 'BORDERLINE',
          reason_code: classifyData.reason_code,
          lifeGoalHit: false,
          classifyVerdict: classifyData.verdict ?? undefined,
          classifyCategory: classifyData.category ?? undefined,
          ...legacyDebugExtras,
        });
        setIsSubmitting(false);
        return;
      }

      const intentionToSend = trimmed;
      const softRealism = runSoftRealism(trimmed, finalDays, gate.category, locale);
      if (softRealism.level === 'unrealistic' && softRealism.adjustments.length > 0) {
        setLastSubmittedIntent(trimmed);
        setRealismPending({
          intentionToSend,
          days: finalDays,
          category: gate.category,
          ritualId,
          why_short: softRealism.why_short,
          adjustments: softRealism.adjustments,
          needsConfirmation: needsAmbitionConfirmation(trimmed),
        });
        setLastSubmitDebug({
          branch: 'realism_pending',
          gateStatus: gate.status,
          reason_code: actionabilityResult.reason_code,
          lifeGoalHit: false,
          ...legacyDebugExtras,
        });
        setIsSubmitting(false);
        return;
      }
      if (softRealism.level === 'stretch' && softRealism.why_short) {
        setStretchMessage(softRealism.why_short);
      }
      const res = await fetch('/api/missions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intention: intentionToSend,
          days: finalDays,
          locale,
          ritualId,
          category: gate.category ?? undefined,
          realism_acknowledged: false,
        }),
      });
      const data = await res.json();
      const payload = data?.data ?? data;
      if (payload?.needsClarification && payload?.clarification?.mode === 'inline') {
        setLastSubmittedIntent(trimmed);
        setInlineHintSecondaryDbg(null, 'generate:needsClarification');
        const reasonCode = payload.clarification?.reason_code;
        const tRec = t as Record<string, string>;
        const hint =
          gate.status === 'ACTIONABLE'
            ? tRec.inlineClarifyHintSingleTerm ?? tRec.inlineClarifyHint
            : reasonCode === 'single_term'
              ? tRec.inlineClarifyHintSingleTerm ?? tRec.inlineClarifyHint
              : tRec.inlineClarifyHint;
        setInlineHintDbg(hint, 'generate:needsClarification');
        const branch = gate.status === 'ACTIONABLE' ? 'clarification_requested' : 'inline_hint';
        setLastSubmitDebug({
          branch,
          gateStatus: gate.status,
          reason_code: actionabilityResult.reason_code,
          lifeGoalHit: false,
          categoryInferred,
          generateNeedsClarification: true,
          ...legacyDebugExtras,
        });
        setIsSubmitting(false);
        return;
      }
      if (data?.blocked && data?.clarification?.mode === 'inline' && data?.clarification?.type === 'safety') {
        setLastSubmittedIntent(trimmed);
        setInlineHintDbg((t as Record<string, string>).safetyInlineMessage ?? GateCopy.safetyBlockedMessage(), 'generate:safety');
        setInlineHintSecondaryDbg((t as Record<string, string>).safetyInlineFallbackExample ?? GateCopy.safetyBlockedSecondary(), 'generate:safety');
        const branch = gate.status === 'ACTIONABLE' ? 'safety_inline' : 'inline_hint';
        setLastSubmitDebug({
          branch,
          gateStatus: gate.status,
          reason_code: actionabilityResult.reason_code,
          lifeGoalHit: false,
          ...legacyDebugExtras,
        });
        setIsSubmitting(false);
        return;
      }
      if (data?.blocked) {
        setSubmitError(data.block_reason ?? data.reason_code ?? 'blocked');
        setIsSubmitting(false);
        return;
      }
      if (!res.ok) {
        setSubmitError(data?.details ?? data?.error ?? 'error');
        setIsSubmitting(false);
        return;
      }
      if (payload?.path && payload?.missionStubs) {
        const ok = storePendingRequest({
          ritualId,
          intention: intentionToSend,
          days: finalDays,
          locale,
          category: payload?.category,
        });
        if (ok && typeof window !== 'undefined') {
          try {
            const toStore = { ...payload, debugTrace: data?.debugTrace };
            window.sessionStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(toStore));
          } catch {
            /* ignore */
          }
        }
        setLastSubmitDebug({
          branch: 'proceed',
          gateStatus: gate.status,
          reason_code: actionabilityResult.reason_code,
          lifeGoalHit: false,
          ...legacyDebugExtras,
        });
        setIsSubmitting(false);
        router.push(`/mission?creating=1&ritualId=${ritualId}`);
        return;
      }
      setSubmitError('Impossible de lancer la génération.');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'error');
    }
    setIsSubmitting(false);
    tryLexiconAutobootstrap(trimmed, locale ?? 'en', (trace) => {
      if (showDevTools && typeof window !== 'undefined' && (window as unknown as { __loeDebugTrace?: unknown[] }).__loeDebugTrace) {
        (window as unknown as { __loeDebugTrace: unknown[] }).__loeDebugTrace.push(trace);
      }
    });
  };

  return (
    <>
      <Container>
        <section className={`home-shell ${styles.homeShell}`}>
          <div className={styles.homeContainer}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>{t.homeTagline}</h1>
          <p className={styles.heroSubtitle}>{t.homeHeroTitle}</p>
        </div>
        <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.section}>
            <div
              className={`${styles.card} ${styles.intentionCard} ${
                confirmBeforeProceed ? styles.intentionCardConfirm : ''
              }`}
            >
              {!confirmBeforeProceed && (
                <textarea
                  ref={intentionInputRef}
                  id="ritual-intention"
                  className={styles.intentionInput}
                  placeholder={placeholderText}
                  value={intention}
                  onChange={(event) => {
                    setIntention(event.target.value);
                    if (rephrasePlaceholderActive) setRephrasePlaceholderActive(false);
                    resetUiMessages();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      formRef.current?.requestSubmit();
                    }
                  }}
                  rows={3}
                />
              )}
              {(confirmBeforeProceed ||
                ambitionPending ||
                (controllabilityPending && lastSubmitDebug?.gateStatus !== 'BLOCKED') ||
                realismPending ||
                stretchMessage ||
                (allowInlineHint && (effectiveInlineHint || inlineHintSecondary || suggestedRephrase)) ||
                ((lastSubmitDebug?.branch === 'clarification_requested' || lastSubmitDebug?.branch === 'safety_inline') &&
                  (effectiveInlineHint || inlineHintSecondary || suggestedRephrase))) && (
                <>
                  {audienceSafetyLevel === 'adult_only' && (
                    <p className={styles.audienceSafetyBadge} role="status">
                      Adults only: private/friends
                    </p>
                  )}
                  {confirmBeforeProceed ? (
                    <div className={styles.confirmBlock}>
                      <h2 className={styles.confirmGuideTitle}>
                        {confirmBeforeProceed.guide_title ?? deriveGuideTitle(confirmBeforeProceed.intentionToSend)}
                      </h2>
                      <div className={styles.confirmObjectivesBox}>
                        <span className={styles.confirmObjectivesIcon} aria-hidden>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </span>
                        <span className={styles.confirmObjectivesText}>
                          <span className={styles.confirmObjectivesIntro}>
                            {((t as Record<string, string>).inDaysYouWillKnow ?? 'In {days} days, you will know: ').replace('{days}', String(confirmBeforeProceed.days))}
                          </span>
                          <span className={styles.confirmObjectivesList}>
                            {confirmBeforeProceed.objectives?.length
                              ? confirmBeforeProceed.objectives.join(', ')
                              : (confirmBeforeProceed.guide_title ?? deriveGuideTitle(confirmBeforeProceed.intentionToSend))}
                          </span>
                        </span>
                      </div>
                      <p className={styles.confirmObjectiveQuestion}>
                        {(t as Record<string, string>).confirmObjectiveQuestion ?? "Is this what you want to achieve?"}
                      </p>
                      <div className={styles.confirmActions}>
                        <button
                          type="button"
                          className={styles.confirmYesButton}
                          onClick={() => {
                            proceedToMission({
                              intentionToSend: confirmBeforeProceed.intentionToSend,
                              days: confirmBeforeProceed.days,
                              category: confirmBeforeProceed.category,
                              ritualId: confirmBeforeProceed.ritualId,
                              realismAck: false,
                              goalClarification: clarifyApplied ?? undefined,
                            });
                            setConfirmBeforeProceed(null);
                          }}
                          disabled={isSubmitting}
                        >
                          <svg className={styles.confirmYesIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{(t as Record<string, string>).confirmYes ?? 'Yes'}</span>
                        </button>
                        <button
                          type="button"
                          className={styles.confirmRefineButton}
                          onClick={() => {
                            setIntention('');
                            setConfirmBeforeProceed(null);
                            setClarifyModalOpen(false);
                            setClarifyModalData(null);
                            setClarifyModalError(null);
                            setClarifyModalFallback(false);
                          }}
                          disabled={isSubmitting}
                        >
                          <span>{(t as Record<string, string>).clarifyCancel ?? 'Annuler'}</span>
                        </button>
                      </div>
                    </div>
                  ) : ambitionPending ? (
                    <div className={styles.ambitionBlock}>
                      <h3 className={styles.controllabilityTitle}>
                        {(t as Record<string, string>).needPrecisionsTitle ?? 'Precisions needed'}
                      </h3>
                      <h3 className={styles.ambitionTitle}>
                        {gateMessage(t as Record<string, string>, 'ambitionConfirmTitle')}
                      </h3>
                      <p className={styles.ambitionBody}>
                        {gateMessage(t as Record<string, string>, 'ambitionConfirmBody')}
                      </p>
                      <div className={styles.ambitionActions}>
                        <button
                          type="button"
                          className={styles.ambitionPrimary}
                          onClick={() => {
                            setConfirmBeforeProceed({
                              intentionToSend: ambitionPending.intent,
                              originalIntent: ambitionPending.intent,
                              ritualId: ambitionPending.ritualId,
                              days: ambitionPending.days,
                              category: undefined,
                            });
                            setAmbitionPending(null);
                            setIntention('');
                          }}
                          disabled={isSubmitting}
                        >
                          {gateMessage(t as Record<string, string>, 'ambitionConfirmYes')}
                        </button>
                        <button
                          type="button"
                          className={styles.ambitionSecondary}
                          onClick={() => {
                            setAmbitionPending(null);
                            setInlineHintDbg(gateMessage(t as Record<string, string>, 'ambitionRefineHint'), 'ambition:refine');
                            setInlineHintSecondaryDbg(null, 'ambition:refine');
                            setSuggestedRephraseDbg(null, 'ambition:refine');
                            intentionInputRef.current?.focus();
                          }}
                          disabled={isSubmitting}
                        >
                          {gateMessage(t as Record<string, string>, 'ambitionConfirmRefine')}
                        </button>
                      </div>
                    </div>
                  ) : controllabilityPending && lastSubmitDebug?.gateStatus !== 'BLOCKED' ? (
                    <div className={styles.controllabilityBlock}>
                      <p className={styles.confirmReformulation}>
                        {(t as Record<string, string>).yourProjectLabel ?? 'Your project: '}
                        {formatReformulationDisplay(
                          controllabilityPending.rewrittenIntent ?? controllabilityPending.originalIntent,
                          controllabilityPending.days,
                          controllabilityPending.reformulationIncludesDays,
                        )}
                      </p>
                      <h3 className={styles.controllabilityTitle}>
                        {(t as Record<string, string>).needPrecisionsTitle ?? controllabilityPending.primary}
                      </h3>
                      <p className={styles.controllabilityBody}>
                        {controllabilityPending.secondary ?? (t as Record<string, string>).controllabilitySupportBody}
                      </p>
                      <div className={styles.controllabilityChips}>
                        {controllabilityPending.angles.map((angle, idx) => (
                          <button
                            key={`angle-${idx}`}
                            type="button"
                            className={styles.controllabilityChip}
                            onClick={() => {
                              const days = angle.days ?? controllabilityPending.days;
                              setLastSubmitReformulation({ text: angle.intent, days });
                              setConfirmBeforeProceed({
                                intentionToSend: angle.intent,
                                originalIntent: controllabilityPending.originalIntent,
                                ritualId: controllabilityPending.ritualId,
                                days,
                                category: undefined,
                              });
                              setControllabilityPending(null);
                              setIntention(angle.label);
                            }}
                            disabled={isSubmitting}
                          >
                            {angle.label}
                          </button>
                        ))}
                      </div>
                      {controllabilityPending.copyVariant !== 'support_playful_nonsense' && (
                        <button
                          type="button"
                          className={styles.controllabilityKeepOriginal}
                          onClick={() => {
                            const intentionToSend =
                              controllabilityPending.rewrittenIntent?.trim() ||
                              controllabilityPending.originalIntent;
                            const days = controllabilityPending.days;
                            setLastSubmitReformulation({
                              text: intentionToSend,
                              days,
                              includesDays: controllabilityPending.reformulationIncludesDays,
                            });
                            setConfirmBeforeProceed({
                              intentionToSend,
                              originalIntent: controllabilityPending.originalIntent,
                              ritualId: controllabilityPending.ritualId,
                              days,
                              category: undefined,
                              reformulationIncludesDays: controllabilityPending.reformulationIncludesDays,
                            });
                            setControllabilityPending(null);
                            setIntention(intentionToSend);
                          }}
                          disabled={isSubmitting}
                        >
                          {gateMessage(t as Record<string, string>, 'controllabilityKeepOriginal')}
                        </button>
                      )}
                    </div>
                  ) : realismPending ? (
                    <div className={styles.realismBlock}>
                      <h3 className={styles.controllabilityTitle}>
                        {(t as Record<string, string>).needPrecisionsTitle ?? 'Precisions needed'}
                      </h3>
                      {realismPending.needsConfirmation && !showConfirmationAdjustments ? (
                        <div className={styles.realismConfirmBlock}>
                          <h3 className={styles.realismConfirmTitle}>
                            {gateMessage(t as Record<string, string>, 'realismConfirmTitle')}
                          </h3>
                          <p className={styles.realismConfirmBody}>
                            {gateMessage(t as Record<string, string>, 'realismConfirmBody', realismPending.days)}
                          </p>
                          <p className={styles.realismConfirmQuestion}>
                            {gateMessage(t as Record<string, string>, 'realismConfirmQuestion')}
                          </p>
                          <div className={styles.realismConfirmActions}>
                            <button
                              type="button"
                              className={styles.realismConfirmPrimary}
                              onClick={() => {
                                setConfirmBeforeProceed({
                                  intentionToSend: realismPending.intentionToSend,
                                  originalIntent: lastSubmittedIntent || realismPending.intentionToSend,
                                  ritualId: realismPending.ritualId,
                                  days: realismPending.days,
                                  category: realismPending.category,
                                });
                                setRealismPending(null);
                                setIntention('');
                              }}
                              disabled={isSubmitting}
                            >
                              {gateMessage(t as Record<string, string>, 'realismConfirmYes')}
                            </button>
                            <button
                              type="button"
                              className={styles.realismConfirmSecondary}
                              onClick={() => setShowConfirmationAdjustments(true)}
                              disabled={isSubmitting}
                            >
                              {gateMessage(t as Record<string, string>, 'realismConfirmAdjust')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {!realismPending.needsConfirmation ? (
                            <p className={styles.inlineClarifyMessage}>
                              {gateMessage(t as Record<string, string>, 'realismInlineMessage', realismPending.days)}
                              {realismPending.why_short ? ` ${realismPending.why_short}` : ''}
                            </p>
                          ) : null}
                          <div className={styles.realismActions}>
                            <button
                              type="button"
                              className={realismPending.needsConfirmation && showConfirmationAdjustments ? styles.realismConfirmSecondary : styles.realismKeepButton}
                              onClick={() => {
                                setConfirmBeforeProceed({
                                  intentionToSend: realismPending.intentionToSend,
                                  originalIntent: lastSubmittedIntent || realismPending.intentionToSend,
                                  ritualId: realismPending.ritualId,
                                  days: realismPending.days,
                                  category: realismPending.category,
                                });
                                setRealismPending(null);
                                setIntention('');
                              }}
                              disabled={isSubmitting}
                            >
                              {gateMessage(t as Record<string, string>, 'realismKeepAnyway')}
                            </button>
                            {(!realismPending.needsConfirmation || showConfirmationAdjustments) && (
                              <>
                                <span className={styles.realismOr}>
                                  {gateMessage(t as Record<string, string>, 'realismOr')}
                                </span>
                                <div className={styles.realismAdjustOptions}>
                                  {realismPending.adjustments.slice(0, 3).map((adj, idx) => {
                                    const intention =
                                      adj.type === 'reduce_scope'
                                        ? adj.next_intent
                                        : (adj.next_intent ?? realismPending.intentionToSend);
                                    const days =
                                      adj.type === 'increase_duration' ? adj.next_days : realismPending.days;
                                    return (
                                      <button
                                        key={`${adj.type}-${idx}`}
                                        type="button"
                                        className={styles.realismAdjustButton}
                                        onClick={() => {
                                          setConfirmBeforeProceed({
                                            intentionToSend: intention,
                                            originalIntent: lastSubmittedIntent || realismPending.intentionToSend,
                                            ritualId: realismPending.ritualId,
                                            days,
                                            category: realismPending.category,
                                          });
                                          setRealismPending(null);
                                          setIntention('');
                                        }}
                                        disabled={isSubmitting}
                                      >
                                        {adj.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : stretchMessage ? (
                    <p className={styles.realismStretchMessage}>{stretchMessage}</p>
                  ) : (
                    <>
                      {(lastSubmitDebug?.branch === 'engine_ask_clarification' || lastSubmitDebug?.branch === 'engine_choose_category') && (
                        <h3 className={styles.controllabilityTitle}>
                          {(t as Record<string, string>).needPrecisionsTitle ?? 'Precisions needed'}
                        </h3>
                      )}
                      {effectiveInlineHint && (
                        <p className={styles.inlineClarifyMessage}>{effectiveInlineHint}</p>
                      )}
                      {inlineHintSecondary && (
                        <p className={styles.inlineClarifyMessageSecondary}>{inlineHintSecondary}</p>
                      )}
                      {suggestedRewrites?.length ? (
                        <div className={styles.inlineClarifyMessageSecondary}>
                          <span className={styles.suggestedRephraseLabel}>
                            {gateMessage(t as Record<string, string>, 'suggestionLabel')}
                          </span>
                          <div className={styles.suggestedRephraseList}>
                            {suggestedRewrites.map((rewrite) => (
                              <button
                                key={rewrite.next_intent}
                                type="button"
                                className={styles.suggestedRephraseButton}
                                onClick={() => {
                                setIntention(rewrite.next_intent);
                                setSuggestedRephraseDbg(null, 'user:useSuggestion');
                                setInlineHintDbg(null, 'user:useSuggestion');
                                const ritualId = lastRitualId ?? createRitualId();
                                setLastRitualId(ritualId);
                                setConfirmBeforeProceed({
                                  intentionToSend: rewrite.next_intent,
                                  originalIntent: rewrite.next_intent,
                                  ritualId,
                                  days: finalDays,
                                });
                                }}
                              >
                                {rewrite.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              className={styles.suggestedRephraseButton}
                              onClick={() => {
                                setSuggestedRewrites(null);
                                setSuggestedRephraseDbg(null, 'user:keepOriginal');
                              }}
                            >
                              {(t as Record<string, string>).clarifyKeepOriginal ?? 'Keep my request'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        suggestedRephrase && (
                          <p className={styles.inlineClarifyMessageSecondary}>
                            {gateMessage(t as Record<string, string>, 'suggestionLabel')}
                            <button
                              type="button"
                              className={styles.suggestedRephraseButton}
                              onClick={() => {
                              setIntention(suggestedRephrase);
                              setSuggestedRephraseDbg(null, 'user:useSuggestion');
                              setInlineHintDbg(null, 'user:useSuggestion');
                              const ritualId = lastRitualId ?? createRitualId();
                              setLastRitualId(ritualId);
                              setConfirmBeforeProceed({
                                intentionToSend: suggestedRephrase,
                                originalIntent: suggestedRephrase,
                                ritualId,
                                days: finalDays,
                              });
                              }}
                            >
                              {suggestedRephrase}
                            </button>
                          </p>
                        )
                      )}
                    </>
                  )}
                </>
              )}
              <div
                className={`${styles.cardFooter} ${confirmBeforeProceed ? styles.cardFooterConfirm : ''}`}
              >
                <button className={styles.addDocs} type="button" disabled>
                  {addDocsCopy}
                </button>
                <span className={styles.aiBadge}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={styles.aiIcon}
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                    <path d="M20 3v4" />
                    <path d="M22 5h-4" />
                    <path d="M4 17v2" />
                    <path d="M5 18H3" />
                  </svg>
                  <span>{aiBadgeCopy.replace('✨ ', '')}</span>
                </span>
              </div>
            </div>
            {!confirmBeforeProceed && <p className={styles.helperText}>{helperCopy}</p>}
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>{daysTitle}</h2>
            <div className={`${styles.card} ${styles.daysCard}`}>
              <div className={styles.daysHero}>
                <span className={`${styles.daysValue} ${styles.fontSerif}`}>{finalDays}</span>
                <span className={styles.daysUnit}>{daysUnitCopy}</span>
              </div>
              <div className={styles.daysStage}>
                {dayStage.icon} {dayStage.label}
              </div>
              <input
                className={styles.slider}
                type="range"
                min={7}
                max={90}
                step={1}
                value={finalDays}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  setSelectedDays(nextValue);
                }}
                style={{ '--progress': `${sliderProgress * 100}%` } as React.CSSProperties}
                aria-label="Durée du rituel en jours"
              />
              <div className={styles.pills}>
                {dayOptions.map((days) => {
                  const stage = dayStages[days];
                  const isActive = activeDayOption === days;
                  return (
                    <button
                      key={days}
                      type="button"
                      className={`${styles.pill} ${isActive ? styles.pillActive : ''}`}
                      onClick={() => setSelectedDays(days)}
                    >
                      <span className={styles.pillDays}>{days}d</span>
                      <span className={styles.pillLabel}>{stage?.label ?? 'Foundations'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {submitError && <p className="creating-error">{submitError}</p>}

          <div className={styles.ctaRow}>
            <Button
              variant="cta"
              type="submit"
              disabled={!intention.trim() || isSubmitting}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.ctaIcon}
                aria-hidden="true"
                focusable="false"
              >
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                <path d="M20 3v4" />
                <path d="M22 5h-4" />
                <path d="M4 17v2" />
                <path d="M5 18H3" />
              </svg>
              <span>{isSubmitting ? ((t as Record<string, string>).homeThinking ?? 'Thinking…') : ctaCopy}</span>
            </Button>
          </div>
        </form>

        <div className="home-admin-link">
          <a href="/admin/images?key=1">Retour à l’admin images</a>
          {' · '}
          <a href="/admin/domains?key=1">Admin domains</a>
          {' · '}
          <a href="/admin/safety?key=1">Admin safety</a>
          {showDevTools && (
            <>
              {' · '}
              <a href="/admin/rules">Admin rules</a>
              {' · '}
              <a href="/admin/messages">Messages selon les scénarios</a>
              {' · '}
              <a href="/admin/knowledge">Knowledge (dev DB)</a>
              {' · '}
              <a href="/admin/eval">Eval Harness</a>
              {' · '}
              <a href="/admin/prompts">Admin Prompts</a>
              {' · '}
              <a href="/admin/lexicon">Language Packs</a>
              {' · '}
              <a href="/admin/idea-routines">Suggestions rituels</a>
              {' · '}
              <a href="/admin/llm">LLM Playground</a>
              {' · '}
              <button
                type="button"
                className={styles.mockUiToggle}
                onClick={handleMockUIToggle}
                aria-pressed={mockUIEnabled}
              >
                Mock UI: {mockUIEnabled ? 'ON' : 'OFF'}
              </button>
            </>
          )}
        </div>
        {showDevTools && siteLlm && (
          <p className={styles.homeDebugLegend} style={{ marginTop: 0 }}>
            site_llm={siteLlm.provider} · {siteLlm.model ?? '—'} · {siteLlm.base_url == null || siteLlm.base_url === '' ? 'default' : 'custom'}
            {siteLlm.source != null && siteLlm.source !== '' ? ` · ${siteLlm.source}` : ''}
          </p>
        )}
        {showDevTools && lastSubmitDebug && (
          <div className={styles.homeDebug} aria-live="polite">
            <div className={styles.homeDebugTitle}>Home branch (dev)</div>
            <p className={styles.homeDebugLegend}>
              Steps: V2 → /api/decision/resolve (exact cache → similarity → safety → category → tone → category_analysis → controllability → realism → proceed → objectives_preview). Inline refine → /api/decision/clarify-chips (context + level chips). Legacy → actionability → life goal? → controllability (low? show angles) → BORDERLINE? classify → generate. If generate returns needsClarification → clarification_requested. category=— when not set.
            </p>
            <pre className={styles.homeDebugPre}>
              {[
                `engine=${lastSubmitDebug.engine ?? '—'}`,
                `fallback_to_legacy=${lastSubmitDebug.fallback_to_legacy ?? false}`,
                lastSubmitDebug.fallback_reason != null && `fallback_reason=${lastSubmitDebug.fallback_reason}`,
                `ui_branch_id=${lastSubmitDebug.branch}`,
                lastSubmitDebug.gateStatus != null && `gateStatus=${lastSubmitDebug.gateStatus} (${lastSubmitDebug.reason_code ?? '—'})`,
                lastSubmitDebug.categoryInferred != null && `category=${lastSubmitDebug.categoryInferred}`,
                lastSubmitDebug.lifeGoalHit != null && `lifeGoal=${lastSubmitDebug.lifeGoalHit}${lastSubmitDebug.lifeGoalMarker ? ` marker=${lastSubmitDebug.lifeGoalMarker}` : ''}`,
                lastSubmitDebug.controllabilityLevel != null && `controllabilityLevel=${lastSubmitDebug.controllabilityLevel}`,
                lastSubmitDebug.classifyVerdict != null && `classifyVerdict=${lastSubmitDebug.classifyVerdict}${lastSubmitDebug.classifyReason ? ` reason=${lastSubmitDebug.classifyReason}` : ''}${lastSubmitDebug.classifyCategory ? ` category=${lastSubmitDebug.classifyCategory}` : ''}`,
                lastSubmitDebug.generateNeedsClarification === true && 'generateNeedsClarification=true',
                lastSubmitDebug.copy_variant != null && `copy_variant=${lastSubmitDebug.copy_variant}`,
                lastSubmitDebug.copy_why != null && `copy_why=${lastSubmitDebug.copy_why}`,
                lastSubmitDebug.fingerprint != null && `fingerprint=${lastSubmitDebug.fingerprint}`,
                lastSubmitDebug.similarity_hit === true && 'similarity_hit=true',
                lastSubmitDebug.matched_record_id != null && `matched_record_id=${lastSubmitDebug.matched_record_id}`,
                clarifyTrace?.cache && `clarify_cache=${clarifyTrace.cache}`,
                clarifyModalData?.template_key && `clarify_template=${clarifyModalData.template_key}`,
                clarifyTrace?.timing_ms != null && `clarify_timing_ms=${clarifyTrace.timing_ms}`,
              ]
                .filter(Boolean)
                .join('\n')}
            </pre>
          </div>
        )}
        {showDevTools && (
          <PipelinePromptsEditor
            className={styles.homeDebug}
            promptTrace={lastSubmitPromptTrace}
            reformulationDisplay={
              lastSubmitReformulation
                ? ((t as Record<string, string>).yourProjectLabel ?? '') +
                  formatReformulationDisplay(
                    lastSubmitReformulation.text,
                    lastSubmitReformulation.days,
                    lastSubmitReformulation.includesDays,
                  )
                : null
            }
          />
        )}
        </div>
        </section>
      </Container>


      <RitualHistory
        mockTabData={mockTabData}
        uiLocale={locale ?? 'en'}
        onPrefillIntent={(intent, days, ideaId) => {
          setIntention(intent);
          setSelectedDays(days);
          if (ideaId != null) pendingIdeaIdRef.current = ideaId;
          document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
          intentionInputRef.current?.focus();
        }}
        ideaIdUsedForRitual={ideaIdUsedForRitual}
        onJoinCommunityRitual={(ritual) => {
          const ritualId =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `comm-${ritual.id}`;
          proceedToMission({
            intentionToSend: ritual.title,
            days: ritual.days,
            category: ritual.category as Category,
            ritualId,
            realismAck: false,
          });
        }}
      />
    </>
  );
}
