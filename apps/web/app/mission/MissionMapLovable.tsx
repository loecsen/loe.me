'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
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
  preparing?: boolean;
  preparingStatus?: 'pending' | 'ready' | 'error';
  onStepClick: (levelId: string, stepId: string) => void;
  onOpenNotifications: () => void;
  onCloseMission: () => void;
};

const BG_IMAGES = [
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/1331d11b-9e1b-4281-ace4-2e1270f0ef52/Default_un_homme_malade_est_dans_son_lit_on_voir_la_mer_de_sa_0.jpg',
  'https://cdn.leonardo.ai/users/7319327d-11c2-493f-9613-0de3fd12b792/generations/731ce422-6bfd-4fd2-9bf2-0d685dbd382d/SDXL_09_A_man_leisurely_paddled_a_canoe_across_the_serene_lake_0.jpg',
];

const BG_IMAGES_PROXY = BG_IMAGES.map(
  (url) => `/api/images/proxy?url=${encodeURIComponent(url)}`,
);

const PLACEHOLDER_LABEL = 'Mission en création…';

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
  preparing,
  preparingStatus,
  onStepClick,
  onOpenNotifications,
  onCloseMission,
}: MissionMapLovableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathContainerRef = useRef<HTMLDivElement | null>(null);
  const stepsContainerRef = useRef<HTMLDivElement | null>(null);
  const colorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeBgIndex, setActiveBgIndex] = useState(0);
  const [nextBgIndex, setNextBgIndex] = useState<number | null>(null);
  const [nextBgReady, setNextBgReady] = useState(false);
  const [whichLayerOn, setWhichLayerOn] = useState(0);
  const [layerIndices, setLayerIndices] = useState<[number, number]>([0, 0]);
  const bgLoadedRef = useRef<Set<number>>(new Set([0]));
  const nextBgIndexRef = useRef<number | null>(null);
  const isTransitioningRef = useRef(false);
  const zoneVisibilityRef = useRef<Map<Element, { ratio: number; index: number }>>(new Map());
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [pathData, setPathData] = useState({ d: '', width: 0, height: 0 });
  const [barGradientTop, setBarGradientTop] = useState({
    start: 'rgba(40, 44, 52, 0.65)',
    end: 'rgba(40, 44, 52, 0.36)',
  });
  const [barGradientBottom, setBarGradientBottom] = useState({
    start: 'rgba(40, 44, 52, 0.65)',
    end: 'rgba(40, 44, 52, 0.36)',
  });
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
    let foundFirstIncomplete = false;
    levels.forEach((level, levelIndex) => {
      level.steps.forEach((step, stepIndex) => {
        const progressStep = progressLevels[levelIndex]?.steps?.[stepIndex];
        const isCompleted = progressStep?.state === 'completed';
        if (isCompleted) {
          map.set(step.id, 'completed');
        } else if (!foundFirstIncomplete) {
          foundFirstIncomplete = true;
          map.set(step.id, 'active');
        } else {
          map.set(step.id, 'locked');
        }
      });
    });
    return map;
  }, [levels, progressLevels]);

  const activeStepIndex = useMemo(() => {
    let index = 0;
    for (const level of levels) {
      for (const step of level.steps) {
        index += 1;
        if (stepStatusMap.get(step.id) === 'active') return index;
      }
    }
    return 1;
  }, [levels, stepStatusMap]);

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
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) {
        showToast(detail.message);
      }
    };
    window.addEventListener('loe:mission:toast', handler as EventListener);
    return () => window.removeEventListener('loe:mission:toast', handler as EventListener);
  }, []);

  const handleStepClick = (levelId: string, stepId: string, isLocked: boolean) => {
    if (isLocked) {
      const label = activeStepIndex > 0 ? activeStepIndex : 1;
      showToast(`Terminer l’étape ${label} pour débloquer`);
      return;
    }
    onStepClick(levelId, stepId);
  };

  const extractBarGradientFromImageUrl = (url: string) => {
    const refHeight = 100;
    const topPx = 85;
    const bottomPx = 65;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return;
        const scale = refHeight / h;
        const cw = Math.round(w * scale);
        const ch = refHeight;
        const topRows = Math.max(1, Math.round((topPx / h) * ch));
        const bottomRows = Math.max(1, Math.round((bottomPx / h) * ch));

        if (!colorCanvasRef.current) {
          colorCanvasRef.current = document.createElement('canvas');
        }
        const canvas = colorCanvasRef.current;
        canvas.width = cw;
        canvas.height = ch;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;

        context.drawImage(img, 0, 0, cw, ch);

        const sample = (y: number, rows: number) => {
          const data = context.getImageData(0, y, cw, rows).data;
          let r = 0;
          let g = 0;
          let b = 0;
          const n = (data.length / 4) | 0;
          for (let i = 0; i < n; i += 1) {
            r += data[i * 4];
            g += data[i * 4 + 1];
            b += data[i * 4 + 2];
          }
          return {
            r: Math.round(r / n),
            g: Math.round(g / n),
            b: Math.round(b / n),
          };
        };

        const top = sample(0, topRows);
        const bottom = sample(ch - bottomRows, bottomRows);

        setBarGradientTop({
          start: `rgba(${top.r}, ${top.g}, ${top.b}, 0.58)`,
          end: `rgba(${top.r}, ${top.g}, ${top.b}, 0.27)`,
        });
        setBarGradientBottom({
          start: `rgba(${bottom.r}, ${bottom.g}, ${bottom.b}, 0.58)`,
          end: `rgba(${bottom.r}, ${bottom.g}, ${bottom.b}, 0.27)`,
        });
      } catch {
        // Canvas tainted (CORS) : on garde la valeur par défaut.
      }
    };
    const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(url)}`;
    const proxySeparator = proxyUrl.includes('?') ? '&' : '?';
    img.src = `${proxyUrl}${proxySeparator}_t=${Date.now()}`;
  };

  const getBgSrc = (index: number) => BG_IMAGES_PROXY[index];

  const preloadBg = (index: number) => {
    if (bgLoadedRef.current.has(index)) {
      return;
    }
    const img = new Image();
    img.onload = () => {
      bgLoadedRef.current.add(index);
      if (nextBgIndexRef.current === index) {
        setNextBgReady(true);
      }
    };
    img.src = getBgSrc(index);
  };

  useEffect(() => {
    extractBarGradientFromImageUrl(BG_IMAGES[activeBgIndex]);
    const nextIndex = (activeBgIndex + 1) % BG_IMAGES.length;
    preloadBg(nextIndex);
  }, [activeBgIndex]);

  useEffect(() => {
    if (nextBgIndex == null) return;
    const off = 1 - whichLayerOn;
    setLayerIndices((prev) => {
      const next: [number, number] = [...prev];
      next[off] = nextBgIndex;
      return next;
    });
  }, [nextBgIndex, whichLayerOn]);

  useEffect(() => {
    if (nextBgIndex == null) return;
    nextBgIndexRef.current = nextBgIndex;
    const isLoaded = bgLoadedRef.current.has(nextBgIndex);
    setNextBgReady(isLoaded);
    if (!isLoaded) {
      preloadBg(nextBgIndex);
    }
  }, [nextBgIndex]);

  useEffect(() => {
    if (nextBgIndex == null || !nextBgReady) return;
    if (!isTransitioningRef.current) {
      isTransitioningRef.current = true;
    }
    const targetIndex = nextBgIndex;
    requestAnimationFrame(() => {
      setWhichLayerOn(1 - whichLayerOn);
      setActiveBgIndex(targetIndex);
      setNextBgIndex(null);
      setNextBgReady(false);
      isTransitioningRef.current = false;
    });
  }, [nextBgIndex, nextBgReady, whichLayerOn]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sections = Array.from(container.querySelectorAll('[data-zone]'));
    if (!sections.length) return;
    zoneVisibilityRef.current.clear();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const zoneIndex = Number((entry.target as HTMLElement).dataset.zone ?? 0);
          const newIndex = zoneIndex % BG_IMAGES.length;
          if (!entry.isIntersecting) {
            zoneVisibilityRef.current.delete(entry.target);
            return;
          }
          zoneVisibilityRef.current.set(entry.target, { ratio: entry.intersectionRatio, index: newIndex });
        });
        if (isTransitioningRef.current) return;
        // Dès qu'une zone "suivante" apparaît en bas, on bascule : on prend la zone d'index max (la plus bas à l'écran)
        let bestIndex: number | null = null;
        zoneVisibilityRef.current.forEach((value) => {
          if (bestIndex === null || value.index > bestIndex) {
            bestIndex = value.index;
          }
        });
        if (bestIndex === null) return;
        if (bestIndex === activeBgIndex || bestIndex === nextBgIndex) return;
        setNextBgIndex(bestIndex);
      },
      { threshold: 0, rootMargin: '0px 0px 150px 0px' },
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

  useEffect(() => {
    const container = pathContainerRef.current;
    if (!container) return;

    const updatePath = () => {
      const rect = container.getBoundingClientRect();
      const getCenter = (element: Element | null) => {
        if (!element) return null;
        const elementRect = element.getBoundingClientRect();
        return {
          x: elementRect.left - rect.left + elementRect.width / 2,
          y: elementRect.top - rect.top + elementRect.height / 2,
        };
      };

      const startMarker = container.querySelector('[data-path-start="true"]');
      const endMarker = container.querySelector('[data-path-end="true"]');
      const stepNodes = Array.from(container.querySelectorAll('[data-step-id]'));
      const stepPoints = stepNodes
        .map((node) => {
          const button = node.querySelector('button');
          return getCenter(button);
        })
        .filter((point): point is { x: number; y: number } => Boolean(point));
      const points = [
        getCenter(startMarker),
        ...stepPoints,
        getCenter(endMarker),
      ].filter((point): point is { x: number; y: number } => Boolean(point));

      if (!points.length) {
        setPathData({ d: '', width: rect.width, height: rect.height });
        return;
      }

      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const next = points[i];
        const midY = (prev.y + next.y) / 2;
        d += ` C ${prev.x} ${midY} ${next.x} ${midY} ${next.x} ${next.y}`;
      }

      setPathData({ d, width: rect.width, height: rect.height });
    };

    const scheduleUpdate = () => requestAnimationFrame(updatePath);
    scheduleUpdate();

    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);
    return () => observer.disconnect();
  }, [levels, curvePattern, totalSteps]);

  const rootStyle = {
    '--bar-gradient-top-start': barGradientTop.start,
    '--bar-gradient-top-end': barGradientTop.end,
    '--bar-gradient-bottom-start': barGradientBottom.start,
    '--bar-gradient-bottom-end': barGradientBottom.end,
  } as CSSProperties;

  return (
    <div className={styles.root} style={rootStyle}>
      <div className={styles.background}>
        <div
          className={`${styles.bg} ${whichLayerOn === 0 ? styles.bgOn : ''}`}
          style={{ backgroundImage: `url("${getBgSrc(layerIndices[0])}")` }}
        />
        <div
          className={`${styles.bg} ${whichLayerOn === 1 ? styles.bgOn : ''}`}
          style={{ backgroundImage: `url("${getBgSrc(layerIndices[1])}")` }}
        />
        <div className={styles.backgroundOverlay} />
      </div>

      <div className={styles.scrollArea} ref={containerRef}>
        <div className={styles.pathWrapper} ref={pathContainerRef}>
        {pathData.d && (
          <svg
            className={styles.pathLine}
            viewBox={`0 0 ${pathData.width} ${pathData.height}`}
            width={pathData.width}
            height={pathData.height}
            aria-hidden="true"
          >
            <path d={pathData.d} />
          </svg>
        )}
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

        {preparing && (
          <div className={styles.preparingCard} role="status" aria-live="polite">
            <div className={styles.preparingTitle}>Préparation de ta routine…</div>
            <div className={styles.preparingSubtitle}>
              Cela peut prendre plusieurs minutes selon la complexité.
            </div>
            <div className={styles.preparingSteps}>
              <div className={`${styles.preparingStep} ${styles.preparingStepActive}`}>
                <span className={styles.preparingDot} />
                Analyse
              </div>
              <div className={styles.preparingStep}>
                <span className={styles.preparingDot} />
                Plan
              </div>
              <div className={styles.preparingStep}>
                <span className={styles.preparingDot} />
                Premières missions
              </div>
            </div>
            {preparingStatus === 'error' ? (
              <div className={styles.preparingError}>Un souci est survenu, on réessaie…</div>
            ) : null}
          </div>
        )}

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
                    <div className={`${styles.markerBadge} ${styles.markerStart}`} data-path-start="true">
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

                <div className={styles.stepsContainer} ref={stepsContainerRef}>
                  {level.steps.map((step, stepIndex) => {
                    const globalIndex = zoneStartIndex + stepIndex;
                    const offset = curvePattern[globalIndex] ?? 0;
                    const status = stepStatusMap.get(step.id) ?? 'locked';
                    const isLocked = status === 'locked';
                    const isCompleted = status === 'completed';
                    const isActive = status === 'active';
                    const labelText = step.title?.trim() || PLACEHOLDER_LABEL;
                    const isPlaceholder = labelText === PLACEHOLDER_LABEL;
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
                            onClick={() => handleStepClick(level.id, step.id, isLocked)}
                          >
                            {isLocked ? (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                            ) : isCompleted ? (
                              <span className={styles.stepNumber}>{globalIndex + 1}</span>
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
                            } ${isPlaceholder ? styles.stepLabelPlaceholder : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleStepClick(level.id, step.id, isLocked)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleStepClick(level.id, step.id, isLocked);
                              }
                            }}
                          >
                            {labelText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {levelIndex === levels.length - 1 && (
                  <div className={styles.marker}>
                    <div className={`${styles.markerBadge} ${styles.markerEnd}`} data-path-end="true">
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
