'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildImageCacheKey, findCachedImageByKey, getCachedImage } from '../lib/images/imageCache';
import { buildPlanImageKey, requestMissionImage } from '../lib/images/utils';
import { getSelectedStyleId } from '../lib/images/styleSelection';
import { getImageStyleSnapshot, hasImageStyle } from '../lib/images/styles';

type PlanImageProps = {
  intention: string;
  title?: string;
  styleId?: string;
  styleVersion?: number;
  stylePrompt?: string;
  className?: string;
};

export default function PlanImage({
  intention,
  title,
  styleId,
  styleVersion,
  stylePrompt,
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
      const key = await buildPlanImageKey(intention.trim());
      const fallbackCached = findCachedImageByKey(key);
      if (fallbackCached) {
        if (isMounted) {
          setImageUrl(fallbackCached);
        }
        return;
      }
      const hasSnapshot = Boolean(styleId || styleVersion || stylePrompt);
      if (!hasSnapshot) {
        return;
      }
      const resolvedStyleId = styleId ?? getSelectedStyleId();
      if (!hasImageStyle(resolvedStyleId)) {
        return;
      }
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
      const resolved = result?.imageUrl ?? result?.imageDataUrl ?? null;
      if (isMounted && resolved) {
        setImageUrl(resolved);
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
  }, [intention, prompt, retryCount, styleId, stylePrompt, styleVersion]);

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

