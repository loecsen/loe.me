'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Container } from '@loe/ui';
import { useI18n } from './components/I18nProvider';
import RitualHistory from './components/RitualHistory';
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

  useEffect(() => {
    const inlineClarify = searchParams.get('inlineClarify') === '1';
    const intentionParam = searchParams.get('intention');
    const reasonCode = searchParams.get('reason_code');
    if (inlineClarify && intentionParam != null) {
      const decoded = decodeURIComponent(intentionParam);
      setIntention(decoded);
      setLastSubmittedIntent(decoded);
      const hint =
        reasonCode === 'single_term'
          ? (t as { inlineClarifyHintSingleTerm?: string }).inlineClarifyHintSingleTerm ?? (t as { inlineClarifyHint?: string }).inlineClarifyHint
          : (t as { inlineClarifyHint?: string }).inlineClarifyHint;
      setInlineHint(hint ?? null);
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
  const intentionTitle = isFrench
    ? 'Que voulez-vous apprendre ou améliorer ?'
    : 'What do you want to learn or progress on?';
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!intention.trim() || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setInlineHint(null);
    const ritualId = createRitualId();
    try {
      const res = await fetch('/api/missions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intention: intention.trim(),
          days: finalDays,
          locale,
          ritualId,
        }),
      });
      const data = await res.json();
      const payload = data?.data ?? data;
      if (payload?.needsClarification && payload?.clarification?.mode === 'inline') {
        setLastSubmittedIntent(intention.trim());
        const reasonCode = payload.clarification?.reason_code;
        const hint =
          reasonCode === 'single_term'
            ? (t as { inlineClarifyHintSingleTerm?: string }).inlineClarifyHintSingleTerm ?? t.inlineClarifyHint
            : t.inlineClarifyHint;
        setInlineHint(hint);
        setIsSubmitting(false);
        return;
      }
      if (data?.blocked) {
        setSubmitError(data.reason_code ?? 'blocked');
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
          intention: intention.trim(),
          days: finalDays,
          locale,
        });
        if (ok && typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(payload));
          } catch {
            /* ignore */
          }
        }
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
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>{intentionTitle}</h2>
            <div className={`${styles.card} ${styles.intentionCard}`}>
              <textarea
                id="ritual-intention"
                className={styles.intentionInput}
                placeholder={placeholderText}
                value={intention}
                onChange={(event) => setIntention(event.target.value)}
                rows={3}
              />
              {inlineHint && (
                <>
                  {lastSubmittedIntent && (
                    <p className={styles.lastSubmitted}>
                      {t.lastSubmittedLabel} {lastSubmittedIntent}
                    </p>
                  )}
                  <p className={styles.inlineClarifyMessage}>{inlineHint}</p>
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
          </div>
        </div>
        </section>
      </Container>

      <RitualHistory />
    </>
  );
}
