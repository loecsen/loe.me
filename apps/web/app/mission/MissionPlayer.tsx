'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { MissionFull, MissionStub } from '@loe/core';
import { useI18n } from '../components/I18nProvider';

type PlayerBlock =
  | { type: 'context'; text: string }
  | { type: 'quiz'; question: string; choices: string[]; correctIndex?: number }
  | { type: 'input_text'; label: string }
  | { type: 'checklist'; items: string[] }
  | { type: 'feedback'; text: string }
  | { type: 'media'; url: string; caption?: string };

type MissionView = {
  stepTitle: string;
  levelLabel: string;
  mission?: MissionEntry;
  status?: 'idle' | 'generating' | 'ready' | 'error';
  debugMeta?: {
    domainId?: string;
    domainPlaybookVersion?: string;
    validationMode?: string;
    promptPlan?: { promptHash: string; promptVersion: string; latencyMs: number };
    promptFull?: { promptHash: string; promptVersion: string; latencyMs: number };
    stubsCount?: number;
    fullCount?: number;
    qualityWarnings?: string[];
    zodIssues?: unknown;
    axisMapped?: Array<{ from: string; to: string }>;
    lastOutcome?: string;
    remediationApplied?: boolean;
    progressCount?: number;
    lastEffortTypes?: string[];
  };
  mode?: 'auto' | 'manual' | 'unknown';
  requestedStepId?: string | null;
  manualMismatch?: { requestedStepId: string; returnedStepId?: string };
  progressLabel?: string;
  progressRatio?: number;
};

type MissionEntry = MissionStub & {
  blocks?: MissionFull['blocks'];
  effortType?: string;
  estimatedMinutes?: number;
  stepId?: string;
};

type MissionPlayerProps = {
  open: boolean;
  missionView: MissionView | null;
  onClose: () => void;
  onComplete: (result?: { score?: number }) => void;
  onRetry?: () => void;
  onOutcome?: (payload: {
    outcome: 'success' | 'fail' | 'partial' | 'skipped';
    score?: number;
    notes?: string;
    quiz?: { questionId?: string; selectedIndex?: number; correct?: boolean };
  }) => Promise<boolean | void> | boolean | void;
  outcomeError?: string | null;
};

function ensureBlockCount(blocks: PlayerBlock[], noteLabel: string, feedbackText: string) {
  const result = [...blocks];
  if (result.length < 3) {
    result.push({ type: 'input_text', label: noteLabel });
  }
  if (result.length < 3) {
    result.push({ type: 'feedback', text: feedbackText });
  }
  return result.slice(0, 5);
}

export default function MissionPlayer({
  open,
  missionView,
  onClose,
  onComplete,
  onRetry,
  onOutcome,
  outcomeError,
}: MissionPlayerProps) {
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [savedOutcome, setSavedOutcome] = useState(false);
  const [overrideMission, setOverrideMission] = useState<MissionFull | null>(null);
  const [localOutcomeError, setLocalOutcomeError] = useState<string | null>(null);
  const [showRetryPrompt, setShowRetryPrompt] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const autoFetchRef = useRef(false);
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const showDebug = searchParams.get('debug') === '1';

  useEffect(() => {
    if (missionView?.mission?.id) {
      setOverrideMission(null);
      setLocalOutcomeError(null);
      setShowRetryPrompt(false);
    }
  }, [missionView?.mission?.id]);

  const displayedMission = overrideMission ?? missionView?.mission;
  const displayedStepId = (displayedMission as { stepId?: string } | null)?.stepId;

  const blocks = useMemo<PlayerBlock[]>(() => {
    if (!displayedMission) {
      return [];
    }
    const sourceBlocks = displayedMission.blocks ?? [];
    if (sourceBlocks.length === 0) {
      return [];
    }
    const mapped = sourceBlocks.map((block) => {
      switch (block.type) {
        case 'text':
          return { type: 'context', text: block.text } as PlayerBlock;
        case 'quiz':
          return {
            type: 'quiz',
            question: block.question,
            choices: block.choices,
            correctIndex: block.correctIndex,
          } as PlayerBlock;
        case 'checklist':
          return { type: 'checklist', items: block.items } as PlayerBlock;
        case 'media':
          return { type: 'media', url: block.url, caption: block.caption } as PlayerBlock;
        default:
          return { type: 'context', text: t.playerFallback } as PlayerBlock;
      }
    });

    return ensureBlockCount(mapped, t.playerNoteLabel, t.playerFeedback);
  }, [displayedMission, t.playerFeedback, t.playerNoteLabel]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !displayedMission) {
      return;
    }
    console.log('[MissionPlayer]', {
      mode: missionView?.mode ?? 'unknown',
      requestedStepId: missionView?.requestedStepId ?? null,
      currentMissionId: displayedMission.id,
      returnedMissionId: displayedMission.id,
      returnedStepId: displayedStepId,
    });
  }, [missionView, displayedMission, displayedStepId]);

  if (!open) {
    autoFetchRef.current = false;
    return null;
  }

  const missionReady = Boolean(displayedMission?.blocks?.length);
  const isGenerating = missionView?.status === 'generating' || (!missionReady && missionView?.status !== 'error');
  const isError = missionView?.status === 'error';

  if (!missionReady) {
    if (!autoFetchRef.current && onRetry && !isError) {
      autoFetchRef.current = true;
      onRetry();
    }
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-panel modal-panel-player">
          <div className="modal-header">
            <div>
              <span className="modal-label">{missionView?.levelLabel ?? t.missionLevelPrefix}</span>
              <h2>
                {(missionView?.progressLabel ?? t.missionStepPrefix) +
                  ' — ' +
                  (missionView?.stepTitle ?? t.missionTitle)}
              </h2>
              <p className="modal-subtitle">{missionView?.mission?.title ?? 'Loe.me'}</p>
              <div
                style={{
                  height: 4,
                  background: 'rgba(0,0,0,0.08)',
                  borderRadius: 999,
                  overflow: 'hidden',
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round((missionView?.progressRatio ?? 0) * 100)}%`,
                    background: 'rgba(0,0,0,0.45)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {missionView?.mission?.effortType && (
                  <span className="chip chip-pill">{missionView.mission.effortType}</span>
                )}
                {missionView?.mission?.estimatedMinutes && (
                  <span className="chip chip-pill">
                    {missionView.mission.estimatedMinutes} min
                  </span>
                )}
                {missionView?.debugMeta?.validationMode && (
                  <span className="chip chip-pill">
                    {missionView.debugMeta.validationMode}
                  </span>
                )}
              </div>
            </div>
            <button className="text-button" onClick={onClose}>
              {t.playerClose}
            </button>
          </div>
          {showDebug && missionView?.debugMeta ? null : null}
          <div className="modal-content modal-content-player">
            <div className="player-block player-block-loading">
              {isGenerating ? 'Generating this mission…' : t.missionGenerateError}
            </div>
            <div className="player-block player-block-skeleton" />
            <div className="player-block player-block-skeleton" />
            {isError && (
              <button className="primary-button" onClick={onRetry} type="button">
                {t.missionRetry}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const score = (() => {
    const quizBlock = blocks.find((block) => block.type === 'quiz') as
      | PlayerBlock
      | undefined;
    if (!quizBlock || quizBlock.type !== 'quiz') {
      return undefined;
    }
    if (quizAnswer === null || quizBlock.correctIndex === undefined) {
      return undefined;
    }
    return quizAnswer === quizBlock.correctIndex ? 100 : 0;
  })();

  const handleOutcome = async (outcome: 'success' | 'fail' | 'partial' | 'skipped') => {
    if (!displayedMission) {
      return;
    }
    if (savingOutcome) {
      return;
    }
    setSavingOutcome(true);
    setLocalOutcomeError(null);
    try {
      const quizBlock = blocks.find((block) => block.type === 'quiz') as
        | PlayerBlock
        | undefined;
      const correctIndex = quizBlock && quizBlock.type === 'quiz' ? quizBlock.correctIndex : undefined;
      const quiz =
        quizAnswer !== null
          ? {
              questionId: quizBlock?.type === 'quiz' ? quizBlock.question : undefined,
              selectedIndex: quizAnswer,
              correct: typeof correctIndex === 'number' ? quizAnswer === correctIndex : undefined,
            }
          : undefined;
      const normalizedOutcome = outcome === 'partial' ? 'fail' : outcome;
      if (normalizedOutcome === 'fail') {
        setShowRetryPrompt(true);
        return;
      }
      const ok = await onOutcome?.({
        outcome: normalizedOutcome,
        score: typeof score === 'number' ? score / 100 : undefined,
        notes: note.trim() ? note.trim() : undefined,
        quiz,
      });
      if (ok !== false) {
        setSavedOutcome(true);
        setTimeout(() => setSavedOutcome(false), 1500);
      }
      if (normalizedOutcome === 'success') {
        setShowSuccessToast(true);
        setShowConfetti(true);
        setTimeout(() => setShowSuccessToast(false), 1800);
        setTimeout(() => setShowConfetti(false), 1600);
      }
    } finally {
      setSavingOutcome(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-panel-player">
        <div className="modal-header">
            <div>
              <span className="modal-label">{missionView?.levelLabel ?? t.missionLevelPrefix}</span>
              <h2>
                {(missionView?.progressLabel ?? t.missionStepPrefix) +
                  ' — ' +
                  (missionView?.stepTitle ?? t.missionTitle)}
              </h2>
              <p className="modal-subtitle">{missionView?.mission?.title ?? 'Loe.me'}</p>
              <div
                style={{
                  height: 4,
                  background: 'rgba(0,0,0,0.08)',
                  borderRadius: 999,
                  overflow: 'hidden',
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round((missionView?.progressRatio ?? 0) * 100)}%`,
                    background: 'rgba(0,0,0,0.45)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {missionView?.mission?.effortType && (
                  <span className="chip chip-pill">{missionView.mission.effortType}</span>
                )}
                {missionView?.mission?.estimatedMinutes && (
                  <span className="chip chip-pill">
                    {missionView.mission.estimatedMinutes} min
                  </span>
                )}
                {missionView?.debugMeta?.validationMode && (
                  <span className="chip chip-pill">
                    {missionView.debugMeta.validationMode}
                  </span>
                )}
              </div>
            </div>
          <button className="text-button" onClick={onClose}>
            {t.playerClose}
          </button>
        </div>

        <div className="modal-content modal-content-player">
          {showDebug && missionView?.manualMismatch ? (
            <div className="player-block">
              <strong>
                On reste sur l’étape {missionView.manualMismatch.returnedStepId ?? '—'} car la
                dernière tentative est en échec. (Ajuster / Continuer)
              </strong>
            </div>
          ) : null}
          {(outcomeError ?? localOutcomeError) ? (
            <div className="player-block">
              <strong>Impossible de générer la tentative suivante.</strong>
              <div style={{ opacity: 0.8 }}>{outcomeError ?? localOutcomeError}</div>
            </div>
          ) : null}
          {showSuccessToast ? (
            <div className="player-block">
              <strong>Bravo ! Mission du jour est terminée.</strong>
            </div>
          ) : null}
          {showRetryPrompt ? (
            <div className="player-block">
              <strong>Dommage. Tu veux réessayer ?</strong>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setShowRetryPrompt(false);
                    setQuizAnswer(null);
                    setNote('');
                  }}
                >
                  Réessayer
                </button>
                <button type="button" className="ghost-button" onClick={onClose}>
                  Fermer
                </button>
              </div>
            </div>
          ) : null}
          {showConfetti ? (
            <div style={{ fontSize: 22, textAlign: 'center', marginBottom: 10 }}>
              🎉 🎉 🎉
            </div>
          ) : null}
          {blocks.map((block, index) => {
            switch (block.type) {
              case 'context':
                return (
                  <div key={index} className="player-block player-block-text">
                    <p>{block.text}</p>
                  </div>
                );
              case 'quiz':
                return (
                  <div key={index} className="player-block">
                    <h3>{block.question}</h3>
                    <div className="quiz-options">
                      {block.choices.map((choice, choiceIndex) => (
                        <button
                          key={choice}
                          className={`quiz-option ${
                            quizAnswer === choiceIndex ? 'quiz-option-active' : ''
                          }`}
                          onClick={() => setQuizAnswer(choiceIndex)}
                          type="button"
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              case 'input_text':
                return (
                  <div key={index} className="player-block">
                    <label className="input-label" htmlFor="mission-note">
                      {block.label}
                    </label>
                    <textarea
                      id="mission-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={3}
                    />
                  </div>
                );
              case 'checklist':
                return (
                  <div key={index} className="player-block">
                  <h3>{t.playerChecklist}</h3>
                    <ul className="checklist">
                      {block.items.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                );
              case 'feedback':
                return (
                  <div key={index} className="player-block feedback-block">
                    {block.text}
                  </div>
                );
              case 'media':
                return (
                  <div key={index} className="player-block">
                    <img src={block.url} alt={block.caption ?? t.playerAlt} />
                    {block.caption && <p className="media-caption">{block.caption}</p>}
                  </div>
                );
              default:
                return null;
            }
          })}

        </div>

        <div className="modal-footer modal-footer-player">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <div style={{ fontWeight: 600 }}>Comment ça s'est passé ?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="primary-button"
                type="button"
                disabled={savingOutcome || showRetryPrompt}
                onClick={() => handleOutcome('success')}
              >
                ✅ Success
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={savingOutcome || showRetryPrompt}
                onClick={() => handleOutcome('fail')}
              >
                ❌ Failed
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={savingOutcome || showRetryPrompt}
                onClick={() => handleOutcome('skipped')}
              >
                ⏭ Skip
              </button>
              {savingOutcome && <span style={{ opacity: 0.6 }}>Saving…</span>}
              {savedOutcome && !savingOutcome && <span style={{ opacity: 0.7 }}>Saved ✓</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
