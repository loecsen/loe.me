'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildImageCacheKey, getCachedImage } from '../lib/images/imageCache';
import { buildImageKey, getFreeQuota, requestMissionImage } from '../lib/images/utils';
import { getMissionIndex } from '../lib/images/missionIndex';
import { getSelectedStyleId } from '../lib/images/styleSelection';
import { getImageStyle } from '../lib/images/styles';
import { useI18n } from '../components/I18nProvider';

type MissionImageProps = {
  missionId: string;
  title: string;
  context?: string;
  className?: string;
  missionIndex?: number | null;
};

export default function MissionImage({
  missionId,
  title,
  context,
  className,
  missionIndex,
}: MissionImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { locale } = useI18n();

  const prompt = useMemo(() => {
    return context ? `${title}. ${context}` : title;
  }, [context, title]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const styleId = getSelectedStyleId();
      const style = getImageStyle(styleId);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[IMAGE_STYLE]', style.id, style.version);
      }
      const quota = getFreeQuota();
      const resolvedIndex = missionIndex ?? getMissionIndex(missionId);
      if (resolvedIndex && resolvedIndex > quota) {
        setBlocked(true);
        return;
      }
      const key = await buildImageKey(missionId);
      const cacheKey = buildImageCacheKey(style, key);
      const cached = getCachedImage(cacheKey);
      if (cached) {
        if (isMounted) {
          setImageUrl(cached);
        }
        return;
      }
      setLoading(true);
      const titleText = title?.trim() || context?.trim() || 'Learning ritual';
      const summaryText = context?.trim() || undefined;
      const result = await requestMissionImage(key, prompt, '340x190', style.id, {
        title: titleText,
        summary: summaryText,
        userLang: locale,
      });
      const resolved = result?.imageUrl ?? result?.imageDataUrl ?? null;
      if (resolved && isMounted) {
        setImageUrl(resolved);
      }
      if (isMounted && !resolved && !blocked && retryCount < 2) {
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
  }, [missionId, missionIndex, prompt, title, retryCount, blocked]);

  return (
    <div className={`mission-image ${className ?? ''}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={title} />
      ) : (
        <div className={`mission-image-placeholder ${loading ? 'is-loading' : ''}`}>
          {loading && <span className="mission-image-badge">Generating artwork…</span>}
          {!loading && blocked && <span className="mission-image-badge">Premium artwork</span>}
        </div>
      )}
    </div>
  );
}

