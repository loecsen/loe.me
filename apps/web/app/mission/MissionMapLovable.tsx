'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './MissionMapLovable.module.css';

type StepState = 'completed' | 'active' | 'locked';

type LevelInput = {
  id: string;
  title: string;
  summary?: string;
  steps: Array<{ id: string; title: string }>;
};

type ProgressLevelInput = {
  steps: Array<{ state: string }>;
};

type MissionMapLovableProps = {
  planTitle: string;
  levels: LevelInput[];
  progressLevels: ProgressLevelInput[];
  currentStepId: string | null;
  completedCount: number;
  totalCount: number;
  currentStepTitle: string | null;
  onStepClick: (levelId: string, stepId: string) => void;
  onOpenNotifications: () => void;
  onCloseMission: () => void;
};

const BG_IMAGES = [
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/842b0955-92b0-4ff2-ab71-6a78cda96902/SDXL_09_In_a_quaint_village_bordering_lush_countryside_a_woman_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/e75834a0-e0af-42a6-aace-2dfae638e36e/SDXL_09_In_a_large_park_a_woman_is_walking_with_a_child_Faces_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/d8f44f9f-10e9-42c2-9c88-273ddca2bbaf/Leonardo_Diffusion_XL_Flowers_SmellIn_summer_it_is_very_hotMan_2.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/b75adb61-17d1-4c4d-ab2c-1d8cad5af7f6/Leonardo_Diffusion_XL_young_and_smily_Students_chat_in_a_moder_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/4784287b-fd42-49ed-bf8d-fab754c6e4eb/Leonardo_Diffusion_XL_In_a_large_park_a_woman_is_walking_with_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/49e4ed6c-d4eb-4cd7-9ad2-f4c3a35365b7/SDXL_09_Two_people_chat_by_the_pool_during_an_evening_in_a_vil_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/6d221974-a02c-4cf5-b4b1-e750bb008af3/SDXL_09_Drawing_of_a_quaint_cottage_garden_in_Bath_a_woman_lov_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/3187a7e4-e8f8-49be-bd56-c7e5101380fb/SDXL_09_A_group_of_friends_enjoy_vibrant_parties_in_a_stylish_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/8002c11e-482d-4d67-ae9e-96b15f5e359f/SDXL_09_In_the_lush_gardens_of_Seattle_a_mans_hobby_has_blosso_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/3090c009-6de2-4cd0-b619-62b8339b7dca/SDXL_09_a_man_explores_a_new_imaginary_distant_planet_Faces_mu_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/0e60c218-f93f-41eb-b3ec-b18281829a47/SDXL_09_In_a_sunlit_Miami_beach_park_a_man_entertained_onlooke_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/f487ad24-cb07-4484-a5cf-f54df2350fc0/SDXL_09_Drawing_of_2_women_enjoy_the_warm_sunset_in_a_Chicago_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/fbdf2642-b9ca-4544-ba81-ebae28f0c605/Leonardo_Diffusion_XL_In_a_quaint_village_bordering_lush_count_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/112e3ca9-443c-40b5-b3aa-20cd10e5dabf/SDXL_09_In_a_sunny_countryside_near_Austin_a_woman_admires_a_m_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/b0771153-e4b4-47fc-a065-3b4c184009c0/SDXL_09_In_a_quaint_village_bordering_lush_countryside_a_woman_0.jpg',
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createSeededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function generateCurvePattern(totalSteps: number, seed: number): number[] {
  const rand = createSeededRandom(seed);
  const pattern: number[] = [];
  let currentPosition = 0;
  let step = 0;
  const maxOffset = 100;

  while (step < totalSteps) {
    const segmentLength = 3 + Math.floor(rand() * 4);
    const direction = currentPosition >= 0 ? -1 : 1;
    const targetPosition = direction * (40 + rand() * 60);

    for (let i = 0; i < segmentLength && step < totalSteps; i += 1) {
      const t = i / (segmentLength - 1 || 1);
      const eased = (1 - Math.cos(t * Math.PI)) / 2;
      let offset = currentPosition + (targetPosition - currentPosition) * eased;
      const prevOffset = pattern[pattern.length - 1];
      offset = Math.max(-maxOffset, Math.min(maxOffset, offset));
      if (prevOffset !== undefined && Math.abs(offset - prevOffset) < 15) {
        offset += (rand() > 0.5 ? 1 : -1) * 20;
      }
      pattern.push(offset);
      step += 1;
    }

    currentPosition = targetPosition;
  }

  return pattern;
}

export default function MissionMapLovable({
  planTitle,
  levels,
  progressLevels,
  currentStepId,
  completedCount,
  totalCount,
  currentStepTitle,
  onStepClick,
  onOpenNotifications,
  onCloseMission,
}: MissionMapLovableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeBgIndex, setActiveBgIndex] = useState(0);
  const [nextBgIndex, setNextBgIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimeoutRef = useRef<number | null>(null);

  const totalSteps = useMemo(
    () => levels.reduce((acc, level) => acc + level.steps.length, 0),
    [levels],
  );
  const curvePattern = useMemo(
    () => generateCurvePattern(totalSteps, hashString(`${planTitle}-${totalSteps}`)),
    [planTitle, totalSteps],
  );

  const stepStatusMap = useMemo(() => {
    const map = new Map<string, StepState>();
    levels.forEach((level, levelIndex) => {
      level.steps.forEach((step, stepIndex) => {
        const progressStep = progressLevels[levelIndex]?.steps?.[stepIndex];
        const isCompleted = progressStep?.state === 'completed';
        const isActive =
          step.id === currentStepId || progressStep?.state === 'in_progress' || progressStep?.state === 'available';
        map.set(step.id, isCompleted ? 'completed' : isActive ? 'active' : 'locked');
      });
    });
    return map;
  }, [levels, progressLevels, currentStepId]);

  const activeStepIndex = useMemo(() => {
    let index = 0;
    let found = 0;
    levels.forEach((level) => {
      level.steps.forEach((step) => {
        if (step.id === currentStepId) {
          found = index + 1;
        }
        index += 1;
      });
    });
    return found;
  }, [levels, currentStepId]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 2000);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sections = Array.from(container.querySelectorAll('[data-zone]'));
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const zoneIndex = Number((entry.target as HTMLElement).dataset.zone ?? 0);
          const newIndex = zoneIndex % BG_IMAGES.length;
          if (newIndex === activeBgIndex) return;
          setNextBgIndex(newIndex);
          window.setTimeout(() => {
            setActiveBgIndex(newIndex);
            setNextBgIndex(null);
          }, 700);
        });
      },
      { threshold: 0, rootMargin: '0px 0px -100px 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [activeBgIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const targetSelector =
      completedCount >= 3 && currentStepId ? `[data-step-id="${currentStepId}"]` : '[data-zone="0"]';
    const target = container.querySelector(targetSelector) as HTMLElement | null;
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [completedCount, currentStepId, levels]);

  return (
    <div className={styles.root}>
      <div className={styles.background}>
        <img className={styles.backgroundImg} src={BG_IMAGES[activeBgIndex]} alt="" />
        <img
          className={styles.backgroundImg}
          src={nextBgIndex != null ? BG_IMAGES[nextBgIndex] : BG_IMAGES[activeBgIndex]}
          alt=""
          style={{ opacity: nextBgIndex != null ? 1 : 0 }}
        />
        <div className={styles.backgroundOverlay} />
      </div>

      <div className={styles.scrollArea} ref={containerRef}>
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.headerIdentity}>
              <div className={styles.avatar}>
                <svg className={styles.avatarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20a8 8 0 0 1 16 0" />
                </svg>
              </div>
              <div className={styles.identityText}>
                <span className={styles.identityName}>{planTitle}</span>
              </div>
            </div>

            <div className={styles.headerStats}>
              <div className={styles.statItem}>
                <svg className={styles.statIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2c1.7 3.4 1.7 5.7 0 7.8-1.2 1.5-2.3 2.9-2.3 5.1a4.3 4.3 0 0 0 8.6 0c0-2.2-1.1-3.6-2.3-5.1C14.3 7.7 14.3 5.4 12 2z" />
                </svg>
                <span className={styles.statValue}>7</span>
              </div>
              <div className={styles.statItem}>
                <svg className={styles.statIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="m12 2 2.9 6 6.6.9-4.8 4.5 1.2 6.6L12 17l-5.9 3.1 1.2-6.6L2.5 8.9 9.1 8 12 2z" />
                </svg>
                <span className={styles.statValue}>100</span>
              </div>
              <span className={styles.statText}>
                {completedCount}/{totalCount} missions
              </span>
              <button className={styles.iconButton} type="button" onClick={onCloseMission} aria-label="Quitter">
                ✕
              </button>
            </div>
          </div>
          <div className={styles.headerRowBottom}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>

        {levels.map((level, levelIndex) => {
          const zoneStartIndex = levels.slice(0, levelIndex).reduce((acc, l) => acc + l.steps.length, 0);
          return (
            <section
              key={level.id}
              className={styles.zoneSection}
              id={`zone-${levelIndex}`}
              data-zone={levelIndex}
            >
              <div className={styles.zoneHeader}>
                <div className={styles.zoneBadge}>
                  <span className={styles.zoneTitle}>{level.title}</span>
                </div>
                {level.summary && <p className={styles.zoneObjective}>{level.summary}</p>}
              </div>

              <div className={styles.pathContainer}>
                {levelIndex === 0 && (
                  <div className={styles.marker}>
                    <div className={`${styles.markerBadge} ${styles.markerStart}`}>
                      <svg
                        className={styles.markerIcon}
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
                        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      </svg>
                      <span>DÉPART</span>
                    </div>
                  </div>
                )}

                <div className={styles.stepsContainer}>
                  {level.steps.map((step, stepIndex) => {
                    const globalIndex = zoneStartIndex + stepIndex;
                    const offset = curvePattern[globalIndex] ?? 0;
                    const status = stepStatusMap.get(step.id) ?? 'locked';
                    const isLocked = status === 'locked';
                    const isCompleted = status === 'completed';
                    const isActive = status === 'active';
                    const className = `${styles.stepButton} ${
                      isCompleted ? styles.stepCompleted : isActive ? styles.stepActive : styles.stepLocked
                    }`;
                    return (
                      <div key={step.id} className={styles.stepRow}>
                        <div
                          className={styles.stepContent}
                          style={{ transform: `translateX(${offset}px)` }}
                          data-step-id={step.id}
                        >
                          <button
                            type="button"
                            className={className}
                            onClick={() => {
                              if (isLocked) {
                                const label = activeStepIndex > 0 ? activeStepIndex : 1;
                                showToast(`Terminer l’étape ${label} pour débloquer`);
                                return;
                              }
                              onStepClick(level.id, step.id);
                            }}
                          >
                            {isLocked ? (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                            ) : (
                              globalIndex + 1
                            )}
                            {isCompleted && (
                              <div className={styles.starsContainer}>
                                <svg className={styles.star} viewBox="0 0 24 24">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <svg className={styles.star} viewBox="0 0 24 24">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <svg className={styles.star} viewBox="0 0 24 24">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              </div>
                            )}
                          </button>
                          <span
                            className={`${styles.stepLabel} ${
                              isCompleted ? styles.stepLabelCompleted : isActive ? styles.stepLabelActive : styles.stepLabelLocked
                            }`}
                          >
                            {step.title}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {levelIndex === levels.length - 1 && (
                  <div className={styles.marker}>
                    <div className={`${styles.markerBadge} ${styles.markerEnd}`}>
                      <svg
                        className={styles.markerIcon}
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                        <line x1="4" x2="4" y1="22" y2="15" />
                      </svg>
                      <span>ARRIVÉE</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className={styles.minimap} aria-hidden="true">
        <div className={styles.minimapZones}>
          {levels.map((level, levelIndex) => {
            const startIndex = levels.slice(0, levelIndex).reduce((acc, l) => acc + l.steps.length, 0);
            return (
              <div
                key={level.id}
                className={styles.minimapZone}
                onClick={() => {
                  const target = document.getElementById(`zone-${levelIndex}`);
                  target?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {level.steps.map((step, stepIndex) => {
                  const status = stepStatusMap.get(step.id) ?? 'locked';
                  const dotClass =
                    status === 'completed'
                      ? styles.dotCompleted
                      : status === 'active'
                        ? styles.dotActive
                        : styles.dotLocked;
                  return (
                    <div
                      key={`${step.id}-dot`}
                      className={`${styles.minimapDot} ${dotClass}`}
                      data-step={`${startIndex + stepIndex + 1}`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.bottomBar} role="navigation" aria-label="Navigation">
        <button className={styles.bottomNavItem} type="button">
          <svg className={styles.bottomNavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20a8 8 0 0 1 16 0" />
          </svg>
          <span className={styles.bottomNavLabel}>Profil</span>
        </button>
        <button className={styles.bottomNavItem} type="button">
          <svg className={styles.bottomNavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className={styles.bottomNavLabel}>Groups</span>
        </button>
        <button className={styles.bottomNavItem} type="button">
          <svg className={styles.bottomNavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" />
            <circle cx="12" cy="8" r="6" />
          </svg>
          <span className={styles.bottomNavLabel}>Badges</span>
        </button>
        <button className={styles.bottomNavItem} type="button" onClick={onOpenNotifications}>
          <svg className={styles.bottomNavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22a2.4 2.4 0 0 0 2.4-2.4h-4.8A2.4 2.4 0 0 0 12 22Zm6.7-6.6V10a6.7 6.7 0 1 0-13.4 0v5.4l-1.6 1.6a1 1 0 0 0 .7 1.7h15.2a1 1 0 0 0 .7-1.7l-1.6-1.6Z" />
          </svg>
          <span className={styles.bottomNavLabel}>Alertes</span>
        </button>
      </div>

      <div className={`${styles.toast} ${toastVisible ? styles.toastVisible : ''}`}>{toastMessage}</div>
    </div>
  );
}
