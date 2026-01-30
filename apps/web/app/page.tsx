'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { detectControllability } from './lib/actionability/controllability';
import styles from './page.module.css';

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
  } | null>(null);
  const [mockUIEnabled, setMockUIEnabled] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const intentionInputRef = useRef<HTMLTextAreaElement>(null);

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
    const inlineClarify = searchParams.get('inlineClarify') === '1';
    const safetyBlock = searchParams.get('safetyBlock') === '1';
    const intentionParam = searchParams.get('intention');
    const reasonCode = searchParams.get('reason_code');
    if (inlineClarify && intentionParam != null) {
      const decoded = decodeURIComponent(intentionParam);
      setIntention(decoded);
      setLastSubmittedIntent(decoded);
      setInlineHintSecondary(null);
      const hint =
        reasonCode === 'single_term'
          ? (t as { inlineClarifyHintSingleTerm?: string }).inlineClarifyHintSingleTerm ?? (t as { inlineClarifyHint?: string }).inlineClarifyHint
          : (t as { inlineClarifyHint?: string }).inlineClarifyHint;
      setInlineHint(hint ?? null);
      router.replace('/', { scroll: false });
    } else if (safetyBlock && intentionParam != null) {
      const decoded = decodeURIComponent(intentionParam);
      setIntention(decoded);
      setLastSubmittedIntent(decoded);
      setInlineHint((t as { safetyInlineMessage?: string }).safetyInlineMessage ?? null);
      setInlineHintSecondary((t as { safetyInlineSecondary?: string }).safetyInlineSecondary ?? null);
      router.replace('/', { scroll: false });
    }
  }, [searchParams, router, t]);

  const isFrench = locale?.startsWith('fr');
  const placeholderText = useMemo(
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

  const finalDays = useMemo(() => selectedDays ?? 14, [selectedDays]);
  const activeDayOption = useMemo(() => getNearestDayOption(finalDays), [finalDays]);
  const dayStage = dayStages[activeDayOption] ?? { icon: '🌿', label: 'Foundations' };
  const sliderProgress = (finalDays - 7) / (90 - 7);
  const daysTitle = isFrench
    ? 'Combien de jours avez-vous pour atteindre votre objectif ?'
    : 'How many days do you have to reach your goal?';
  const helperCopy = isFrench
    ? 'Ajoutez vos documents (optionnel). Nous pouvons bâtir le parcours à partir de vos contenus.'
    : 'Add your documents (optional). We can build your learning path from your own materials.';
  const addDocsCopy = isFrench ? '+ Ajouter des documents' : '+ Add documents';
  const aiBadgeCopy = isFrench ? '✨ Guidé par IA' : '✨ AI-powered';
  const daysUnitCopy = isFrench ? 'jours' : 'days';
  const ctaCopy = isFrench ? 'Créer mon parcours →' : 'Create my learning path →';

  const PENDING_REQUEST_KEY = 'loe.pending_ritual_request';
  const PENDING_RESULT_KEY = 'loe.pending_ritual_result';

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
  }) => {
    const { intentionToSend, days, category, ritualId, realismAck } = params;
    setIsSubmitting(true);
    setRealismPending(null);
    setShowConfirmationAdjustments(false);
    setStretchMessage(null);
    setAmbitionPending(null);
    setSubmitError(null);
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
        }),
      });
      const data = await res.json();
      const payload = data?.data ?? data;
      if (data?.blocked && data?.clarification?.mode === 'inline' && data?.clarification?.type === 'safety') {
        setLastSubmittedIntent(intentionToSend);
        setInlineHint((t as { safetyInlineMessage?: string }).safetyInlineMessage ?? null);
        setInlineHintSecondary((t as { safetyInlineSecondary?: string }).safetyInlineSecondary ?? null);
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
    setIsSubmitting(true);
    setSubmitError(null);
    setInlineHint(null);
    setInlineHintSecondary(null);
    setSuggestedRephrase(null);
    setRealismPending(null);
    setShowConfirmationAdjustments(false);
    setStretchMessage(null);
    setAmbitionPending(null);
    setTwoPathPending(null);
    setLastSubmitDebug(null);
    const ritualId = createRitualId();
    const trimmed = intention.trim();

    try {
      const actionabilityResult = runActionabilityV2(trimmed, finalDays);
      const gate = toGateResult(actionabilityResult);
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
        });
        setIsSubmitting(false);
        return;
      }

      if (gate.status === 'NOT_ACTIONABLE_INLINE') {
        setLastSubmittedIntent(trimmed);
        setInlineHint((t as { actionabilityNotActionableHint?: string }).actionabilityNotActionableHint ?? null);
        setLastSubmitDebug({
          branch: 'inline_hint',
          gateStatus: gate.status,
          reason_code: actionabilityResult.reason_code,
          lifeGoalHit: false,
        });
        setIsSubmitting(false);
        return;
      }

      if (gate.status === 'BORDERLINE') {
        const displayLang = getDisplayLanguage(trimmed, locale);
        const classifyRes = await fetch('/api/actionability/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: trimmed, timeframe_days: finalDays, display_lang: displayLang }),
        });
        const classifyData = (await classifyRes.json()) as {
          verdict?: string;
          reason_code?: string;
          category?: string | null;
          normalized_intent?: string;
          suggested_rephrase?: string | null;
        };
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
            setInlineHint((t as { safetyInlineMessage?: string }).safetyInlineMessage ?? null);
            setInlineHintSecondary((t as { safetyInlineSecondary?: string }).safetyInlineSecondary ?? null);
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
            });
            setIsSubmitting(false);
            router.push(`/mission?creating=1&ritualId=${ritualId}`);
            return;
          }
        }
        setLastSubmittedIntent(trimmed);
        if (classifyData.verdict === 'BLOCKED' || classifyData.reason_code === 'safety_no_suggestion' || classifyData.reason_code === 'blocked') {
          setInlineHint((t as { safetyInlineMessage?: string }).safetyInlineMessage ?? null);
          setInlineHintSecondary((t as { safetyInlineFallbackExample?: string }).safetyInlineFallbackExample ?? null);
          setSuggestedRephrase(null);
        } else {
          const controllability = detectControllability(trimmed);
          const useTwoPath =
            classifyData.category === 'WELLBEING' &&
            (classifyData.reason_code === 'ambiguous_goal' || controllability.controllability === 'PARTIALLY_EXTERNAL');
          if (useTwoPath) {
            setTwoPathPending({
              primary: (t as { wellbeingTwoPathsPrimary?: string }).wellbeingTwoPathsPrimary ?? '',
              optionA: {
                label: String((t as { wellbeingTwoPathsOptionA?: string }).wellbeingTwoPathsOptionA ?? '').replace('{days}', String(finalDays)),
                next_intent: (t as { wellbeingPathAIntent?: string }).wellbeingPathAIntent ?? '',
              },
              optionB: {
                label: String((t as { wellbeingTwoPathsOptionB?: string }).wellbeingTwoPathsOptionB ?? '').replace('{days}', String(finalDays)),
                next_intent: (t as { wellbeingPathBIntent?: string }).wellbeingPathBIntent ?? '',
              },
              ritualId,
              days: finalDays,
            });
            setInlineHint(null);
            setSuggestedRephrase(null);
          } else {
            const hint =
              classifyData.category === 'WELLBEING'
                ? ((t as { wellbeingRephraseHint?: string }).wellbeingRephraseHint ?? null)
                : ((t as { inlineNotActionablePrimary?: string }).inlineNotActionablePrimary ?? null);
            setInlineHint(hint);
            setSuggestedRephrase(classifyData.suggested_rephrase ?? null);
          }
          setInlineHintSecondary(null);
        }
        setLastSubmitDebug({
          branch: 'inline_hint',
          gateStatus: 'BORDERLINE',
          reason_code: classifyData.reason_code,
          lifeGoalHit: false,
          classifyVerdict: classifyData.verdict ?? undefined,
          classifyCategory: classifyData.category ?? undefined,
        });
        setIsSubmitting(false);
        return;
      }

      if (gate.status === 'ACTIONABLE' && categoryRequiresFeasibility(gate.category)) {
        const displayLang = getDisplayLanguage(trimmed, locale);
        const classifyRes = await fetch('/api/actionability/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: trimmed, timeframe_days: finalDays, display_lang: displayLang }),
        });
        const classifyData = (await classifyRes.json()) as {
          verdict?: string;
          reason_code?: string;
          category?: string | null;
          normalized_intent?: string;
          suggested_rephrase?: string | null;
        };
        if (classifyData.verdict === 'NEEDS_REPHRASE_INLINE') {
          setLastSubmittedIntent(trimmed);
          const controllability = detectControllability(trimmed);
          const useTwoPath =
            classifyData.category === 'WELLBEING' &&
            (classifyData.reason_code === 'ambiguous_goal' || controllability.controllability === 'PARTIALLY_EXTERNAL');
          if (useTwoPath) {
            setTwoPathPending({
              primary: (t as { wellbeingTwoPathsPrimary?: string }).wellbeingTwoPathsPrimary ?? '',
              optionA: {
                label: String((t as { wellbeingTwoPathsOptionA?: string }).wellbeingTwoPathsOptionA ?? '').replace('{days}', String(finalDays)),
                next_intent: (t as { wellbeingPathAIntent?: string }).wellbeingPathAIntent ?? '',
              },
              optionB: {
                label: String((t as { wellbeingTwoPathsOptionB?: string }).wellbeingTwoPathsOptionB ?? '').replace('{days}', String(finalDays)),
                next_intent: (t as { wellbeingPathBIntent?: string }).wellbeingPathBIntent ?? '',
              },
              ritualId,
              days: finalDays,
            });
            setInlineHint(null);
            setSuggestedRephrase(null);
          } else {
            const hint =
              classifyData.category === 'WELLBEING'
                ? ((t as { wellbeingRephraseHint?: string }).wellbeingRephraseHint ?? null)
                : ((t as { inlineNotActionablePrimary?: string }).inlineNotActionablePrimary ?? null);
            const suggestion =
              (classifyData.suggested_rephrase?.trim() || classifyData.normalized_intent?.trim()) || null;
            if (suggestion) {
              setInlineHint(hint);
              setSuggestedRephrase(suggestion);
            } else {
              setInlineHint((t as { classifyNoSuggestionMessage?: string }).classifyNoSuggestionMessage ?? null);
              setSuggestedRephrase(null);
            }
          }
          setInlineHintSecondary(null);
          setLastSubmitDebug({
            branch: 'inline_hint',
            gateStatus: gate.status,
            reason_code: actionabilityResult.reason_code,
            categoryInferred: gate.category,
            lifeGoalHit: false,
            classifyVerdict: classifyData.verdict,
            classifyReason: classifyData.reason_code,
            classifyCategory: classifyData.category ?? undefined,
          });
          setIsSubmitting(false);
          return;
        }
        if (classifyData.verdict === 'BLOCKED' || classifyData.reason_code === 'safety_no_suggestion' || classifyData.reason_code === 'blocked') {
          setLastSubmittedIntent(trimmed);
          setInlineHint((t as { safetyInlineMessage?: string }).safetyInlineMessage ?? null);
          setInlineHintSecondary((t as { safetyInlineFallbackExample?: string }).safetyInlineFallbackExample ?? null);
          setSuggestedRephrase(null);
          setLastSubmitDebug({
            branch: 'inline_hint',
            gateStatus: gate.status,
            reason_code: actionabilityResult.reason_code,
            categoryInferred: gate.category,
            lifeGoalHit: false,
            classifyVerdict: classifyData.verdict,
            classifyReason: classifyData.reason_code,
            classifyCategory: classifyData.category ?? undefined,
          });
          setIsSubmitting(false);
          return;
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
              gateStatus: gate.status,
              reason_code: actionabilityResult.reason_code,
              categoryInferred: gate.category,
              lifeGoalHit: false,
              classifyVerdict: classifyData.verdict,
              classifyReason: classifyData.reason_code,
              classifyCategory: classifyData.category ?? undefined,
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
            setInlineHint((t as { safetyInlineMessage?: string }).safetyInlineMessage ?? null);
            setInlineHintSecondary((t as { safetyInlineSecondary?: string }).safetyInlineSecondary ?? null);
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
              categoryInferred: gate.category,
              lifeGoalHit: false,
              classifyVerdict: classifyData.verdict,
              classifyReason: classifyData.reason_code,
              classifyCategory: classifyData.category ?? undefined,
            });
            setIsSubmitting(false);
            router.push(`/mission?creating=1&ritualId=${ritualId}`);
            return;
          }
        }
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
        setInlineHintSecondary(null);
        const reasonCode = payload.clarification?.reason_code;
        const hint =
          reasonCode === 'single_term'
            ? (t as { inlineClarifyHintSingleTerm?: string }).inlineClarifyHintSingleTerm ?? t.inlineClarifyHint
            : t.inlineClarifyHint;
        setInlineHint(hint);
        setLastSubmitDebug({
          branch: 'inline_hint',
          gateStatus: gate.status,
          reason_code: actionabilityResult.reason_code,
          lifeGoalHit: false,
        });
        setIsSubmitting(false);
        return;
      }
      if (data?.blocked && data?.clarification?.mode === 'inline' && data?.clarification?.type === 'safety') {
        setLastSubmittedIntent(trimmed);
        setInlineHint((t as { safetyInlineMessage?: string }).safetyInlineMessage ?? null);
        setInlineHintSecondary((t as { safetyInlineSecondary?: string }).safetyInlineSecondary ?? null);
        setLastSubmitDebug({
          branch: 'inline_hint',
          gateStatus: gate.status,
          reason_code: actionabilityResult.reason_code,
          lifeGoalHit: false,
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
            <div className={`${styles.card} ${styles.intentionCard}`}>
              <textarea
                ref={intentionInputRef}
                id="ritual-intention"
                className={styles.intentionInput}
                placeholder={placeholderText}
                value={intention}
                onChange={(event) => {
                  setIntention(event.target.value);
                  setInlineHint(null);
                  setInlineHintSecondary(null);
                  setSuggestedRephrase(null);
                  setRealismPending(null);
                  setShowConfirmationAdjustments(false);
                  setAmbitionPending(null);
                  setTwoPathPending(null);
                  setStretchMessage(null);
                  setLastSubmitDebug(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
                rows={3}
              />
              {(inlineHint || inlineHintSecondary || suggestedRephrase || realismPending || stretchMessage || ambitionPending) && (
                <>
                  {ambitionPending ? (
                    <div className={styles.ambitionBlock}>
                      <h3 className={styles.ambitionTitle}>
                        {(t as { ambitionConfirmTitle?: string }).ambitionConfirmTitle ?? "C'est très ambitieux !"}
                      </h3>
                      <p className={styles.ambitionBody}>
                        {(t as { ambitionConfirmBody?: string }).ambitionConfirmBody ?? "On peut essayer de construire un rituel à partir de ça. Tu confirmes ?"}
                      </p>
                      <div className={styles.ambitionActions}>
                        <button
                          type="button"
                          className={styles.ambitionPrimary}
                          onClick={() => {
                            proceedToMission({
                              intentionToSend: ambitionPending.intent,
                              days: ambitionPending.days,
                              ritualId: ambitionPending.ritualId,
                              category: undefined,
                              realismAck: false,
                            });
                            setAmbitionPending(null);
                          }}
                          disabled={isSubmitting}
                        >
                          {(t as { ambitionConfirmYes?: string }).ambitionConfirmYes ?? 'Oui, je confirme'}
                        </button>
                        <button
                          type="button"
                          className={styles.ambitionSecondary}
                          onClick={() => {
                            setAmbitionPending(null);
                            setInlineHint((t as { ambitionRefineHint?: string }).ambitionRefineHint ?? null);
                            setInlineHintSecondary(null);
                            setSuggestedRephrase(null);
                            intentionInputRef.current?.focus();
                          }}
                          disabled={isSubmitting}
                        >
                          {(t as { ambitionConfirmRefine?: string }).ambitionConfirmRefine ?? 'Je préfère préciser'}
                        </button>
                      </div>
                    </div>
                  ) : realismPending ? (
                    <div className={styles.realismBlock}>
                      {realismPending.needsConfirmation && !showConfirmationAdjustments ? (
                        <div className={styles.realismConfirmBlock}>
                          <h3 className={styles.realismConfirmTitle}>
                            {(t as { realismConfirmTitle?: string }).realismConfirmTitle ?? "C'est très ambitieux comme défi !"}
                          </h3>
                          <p className={styles.realismConfirmBody}>
                            {String((t as { realismConfirmBody?: string }).realismConfirmBody ?? '').replace('{days}', String(realismPending.days))}
                          </p>
                          <p className={styles.realismConfirmQuestion}>
                            {(t as { realismConfirmQuestion?: string }).realismConfirmQuestion ?? 'Tu confirmes vouloir te lancer ?'}
                          </p>
                          <div className={styles.realismConfirmActions}>
                            <button
                              type="button"
                              className={styles.realismConfirmPrimary}
                              onClick={() =>
                                proceedToMission({
                                  intentionToSend: realismPending.intentionToSend,
                                  days: realismPending.days,
                                  category: realismPending.category,
                                  ritualId: realismPending.ritualId,
                                  realismAck: true,
                                })
                              }
                              disabled={isSubmitting}
                            >
                              {(t as { realismConfirmYes?: string }).realismConfirmYes ?? 'Oui, je confirme'}
                            </button>
                            <button
                              type="button"
                              className={styles.realismConfirmSecondary}
                              onClick={() => setShowConfirmationAdjustments(true)}
                              disabled={isSubmitting}
                            >
                              {(t as { realismConfirmAdjust?: string }).realismConfirmAdjust ?? 'Je préfère ajuster'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {!realismPending.needsConfirmation ? (
                            <p className={styles.inlineClarifyMessage}>
                              {(t as { realismInlineMessage?: string }).realismInlineMessage
                                ? String((t as { realismInlineMessage }).realismInlineMessage).replace('{days}', String(realismPending.days))
                                : isFrench
                                  ? `Ça risque d'être trop ambitieux en ${realismPending.days} jours.`
                                  : `This might be too ambitious for ${realismPending.days} days.`}
                              {realismPending.why_short ? ` ${realismPending.why_short}` : ''}
                            </p>
                          ) : null}
                          <div className={styles.realismActions}>
                            <button
                              type="button"
                              className={realismPending.needsConfirmation && showConfirmationAdjustments ? styles.realismConfirmSecondary : styles.realismKeepButton}
                              onClick={() =>
                                proceedToMission({
                                  intentionToSend: realismPending.intentionToSend,
                                  days: realismPending.days,
                                  category: realismPending.category,
                                  ritualId: realismPending.ritualId,
                                  realismAck: true,
                                })
                              }
                              disabled={isSubmitting}
                            >
                              {(t as { realismKeepAnyway?: string }).realismKeepAnyway ?? (isFrench ? 'Garder quand même' : 'Keep anyway')}
                            </button>
                            {(!realismPending.needsConfirmation || showConfirmationAdjustments) && (
                              <>
                                <span className={styles.realismOr}>
                                  {(t as { realismOr?: string }).realismOr ?? (isFrench ? 'ou' : 'or')}
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
                                        onClick={() =>
                                          proceedToMission({
                                            intentionToSend: intention,
                                            days,
                                            category: realismPending.category,
                                            ritualId: realismPending.ritualId,
                                            realismAck: true,
                                          })
                                        }
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
                      {inlineHint && (
                        <p className={styles.inlineClarifyMessage}>{inlineHint}</p>
                      )}
                      {inlineHintSecondary && (
                        <p className={styles.inlineClarifyMessageSecondary}>{inlineHintSecondary}</p>
                      )}
                      {suggestedRephrase && (
                        <p className={styles.inlineClarifyMessageSecondary}>
                          {(t as { actionabilitySuggestionLabel?: string }).actionabilitySuggestionLabel ?? 'Suggestion: '}
                          <button
                            type="button"
                            className={styles.suggestedRephraseButton}
                            onClick={() => {
                              setIntention(suggestedRephrase);
                              setSuggestedRephrase(null);
                              setInlineHint(null);
                            }}
                          >
                            {suggestedRephrase}
                          </button>
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
              <div className={styles.cardFooter}>
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
            <p className={styles.helperText}>{helperCopy}</p>
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
              <span>{isSubmitting ? (isFrench ? 'Génération…' : 'Generating…') : ctaCopy}</span>
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
        {showDevTools && lastSubmitDebug && (
          <div className={styles.homeDebug} aria-live="polite">
            <div className={styles.homeDebugTitle}>Home branch (dev)</div>
            <pre className={styles.homeDebugPre}>
              {[
                `branch=${lastSubmitDebug.branch}`,
                lastSubmitDebug.gateStatus != null && `gate=${lastSubmitDebug.gateStatus} (${lastSubmitDebug.reason_code ?? '—'})`,
                lastSubmitDebug.categoryInferred != null && `categoryInferred=${lastSubmitDebug.categoryInferred}`,
                lastSubmitDebug.lifeGoalHit != null && `lifeGoal=${lastSubmitDebug.lifeGoalHit}${lastSubmitDebug.lifeGoalMarker ? ` marker=${lastSubmitDebug.lifeGoalMarker}` : ''}`,
                lastSubmitDebug.classifyVerdict != null && `classify=${lastSubmitDebug.classifyVerdict}${lastSubmitDebug.classifyReason ? ` reason=${lastSubmitDebug.classifyReason}` : ''}${lastSubmitDebug.classifyCategory ? ` category=${lastSubmitDebug.classifyCategory}` : ''}`,
              ]
                .filter(Boolean)
                .join('\n')}
            </pre>
          </div>
        )}
        </div>
        </section>
      </Container>

      <RitualHistory mockTabData={mockTabData} />
    </>
  );
}
