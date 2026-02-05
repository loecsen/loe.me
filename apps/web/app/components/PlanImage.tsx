'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildImageCacheKey,
  findCachedImageByKey,
  getCachedImage,
  setCachedImage,
} from '../lib/images/imageCache';
import { buildPlanImageKey, requestMissionImage } from '../lib/images/utils';
import { getSelectedStyleId } from '../lib/images/styleSelection';
import { getImageStyleSnapshot } from '../lib/images/styles';

type PlanImageProps = {
  ritualId?: string;
  intention: string;
  title?: string;
  styleId?: string;
  styleVersion?: number;
  stylePrompt?: string;
  audience_safety_level?: 'all_ages' | 'adult_only' | 'blocked';
  className?: string;
};

export default function PlanImage({
  ritualId,
  intention,
  title,
  styleId,
  styleVersion,
  stylePrompt,
  audience_safety_level,
  className,
}: PlanImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const prompt = useMemo(() => {
    const base = intention.trim();
    return title ? `${base}. ${title}` : base;
  }, [intention, title]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!intention.trim()) {
        return;
      }
      const key = ritualId ? `ritual_${ritualId}` : await buildPlanImageKey(intention.trim());
      if (ritualId) {
        const directCached = getCachedImage(key);
        if (directCached) {
          if (isMounted) {
            setImageUrl(directCached);
          }
          return;
        }
      }
      const fallbackCached = findCachedImageByKey(key);
      if (fallbackCached) {
        if (isMounted) {
          setImageUrl(fallbackCached);
        }
        return;
      }
      const resolvedStyleId = styleId ?? getSelectedStyleId();
      const style = getImageStyleSnapshot(resolvedStyleId, styleVersion, stylePrompt);
      const cacheKey = buildImageCacheKey(style, key);
      const cached = getCachedImage(cacheKey);
      if (cached) {
        if (isMounted) {
          setImageUrl(cached);
        }
        return;
      }
      setLoading(true);
      const result = await requestMissionImage(key, prompt, '340x190', style.id, {
        title: title?.trim() || intention.trim(),
        summary: prompt,
        promptOverride: stylePrompt,
      });
      const resolved = result?.imageDataUrl ?? result?.imageUrl ?? null;
      if (resolved) {
        if (ritualId) {
          setCachedImage(key, resolved);
        }
        if (isMounted) {
          setImageUrl(resolved);
        }
      }
      if (isMounted && !resolved && retryCount < 2) {
        setTimeout(() => {
          if (isMounted) {
            setRetryCount((prev) => prev + 1);
          }
        }, 4000);
      }
      if (isMounted) {
        setLoading(false);
      }
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [intention, prompt, retryCount, ritualId, styleId, stylePrompt, styleVersion, audience_safety_level]);

  return (
    <div className={`plan-image ${className ?? ''}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={title ?? intention} />
      ) : (
        <div className={`mission-image-placeholder ${loading ? 'is-loading' : ''}`}>
          {loading && <span className="mission-image-badge">Génération en cours…</span>}
        </div>
      )}
    </div>
  );
}

