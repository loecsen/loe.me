'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CommunityRitualV1 } from '../lib/db/types';
import { MOCK_COVER_URLS } from '../PourLaMaquette/mockCovers';
import styles from './CommunityRitualCard.module.css';

type CommunityRitualCardProps = {
  ritual: CommunityRitualV1;
  imageUrl: string;
  joinLabel: string;
  progressLabel: string;
  onJoin: (ritual: CommunityRitualV1) => void;
  /** En Mock UI : afficher les avatars depuis Unsplash au lieu des placeholders. */
  useMockAvatars?: boolean;
};

function GroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M6 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm1 2h-6a3 3 0 0 0-3 3v1h12v-1a3 3 0 0 0-3-3z" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/** Avatars Unsplash pour Mock UI (Marie, Lucas, Emma, Thomas, etc.) */
const MOCK_AVATAR_URLS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop',
];

/** Pick a stable image from existing covers based on ritual id. */
function getCoverUrl(ritualId: string): string {
  let hash = 0;
  for (let i = 0; i < ritualId.length; i++) {
    hash = (hash << 5) - hash + ritualId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % MOCK_COVER_URLS.length;
  return MOCK_COVER_URLS[index] as string;
}

export default function CommunityRitualCard({
  ritual,
  imageUrl,
  joinLabel,
  progressLabel,
  onJoin,
  useMockAvatars = false,
}: CommunityRitualCardProps) {
  const fallbackUrl = getCoverUrl(ritual.id);
  const [effectiveUrl, setEffectiveUrl] = useState(imageUrl);
  useEffect(() => {
    setEffectiveUrl(imageUrl);
  }, [imageUrl]);
  const handleImageError = useCallback(() => {
    setEffectiveUrl(fallbackUrl);
  }, [fallbackUrl]);

  const progress = typeof ritual.community_progress === 'number'
    ? Math.min(100, Math.max(0, ritual.community_progress))
    : 0;

  return (
    <article className={styles.card}>
      <div className={styles.thumb}>
        <img
          className={styles.thumbImage}
          src={effectiveUrl}
          alt=""
          onError={handleImageError}
        />
        <div className={styles.chipsRow}>
          {ritual.levels && (
            <span className={styles.chip}>
              {ritual.levels}
              <LayersIcon className={styles.chipIcon} />
            </span>
          )}
          {ritual.days && (
            <span className={styles.chip}>
              <ClockIcon className={styles.chipIcon} />
              {ritual.days}j
            </span>
          )}
        </div>
        {ritual.rating != null && (
          <span className={styles.ratingChip}>
            <span className={styles.ratingStar}>★</span> {Number(ritual.rating).toFixed(1)}
          </span>
        )}
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.title}>{ritual.title}</h3>
        <p className={styles.description}>{ritual.description}</p>
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <p className={styles.progressLabel}>{progressLabel}</p>
            <span className={styles.progressPct}>{progress}%</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className={styles.participantsRow}>
          {(ritual.participants != null && ritual.participants > 0) && (
            <>
              <div className={styles.participantsAvatars} aria-hidden>
                {(useMockAvatars ? [0, 1, 2, 3] : [1, 2, 3]).slice(0, useMockAvatars ? 4 : 3).map((i) =>
                  useMockAvatars ? (
                    <span key={i} className={styles.participantAvatarWrap}>
                      <img
                        src={MOCK_AVATAR_URLS[i % MOCK_AVATAR_URLS.length]}
                        alt=""
                        className={styles.participantAvatarImg}
                        width={28}
                        height={28}
                      />
                    </span>
                  ) : (
                    <div key={i} className={styles.participantAvatar} />
                  ),
                )}
                {ritual.participants > (useMockAvatars ? 4 : 3) && (
                  <span className={styles.participantsMore}>+{Math.min(ritual.participants - (useMockAvatars ? 4 : 3), 99)}</span>
                )}
              </div>
              <span className={styles.participantsCount}>
                <GroupIcon className={styles.participantsIcon} />
                {ritual.participants.toLocaleString()}
              </span>
            </>
          )}
          <button
            type="button"
            className={styles.joinBtn}
            onClick={() => onJoin(ritual)}
          >
            {joinLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

export { getCoverUrl };
