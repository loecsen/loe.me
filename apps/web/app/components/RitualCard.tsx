'use client';

import PlanImage from './PlanImage';
import FriendsStack from './FriendsStack';
import type { FriendInTooltip } from './FriendsTooltip';
import { timeAgoFR } from '../lib/time/timeAgo';
import styles from './RitualCard.module.css';

export type RitualCardItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  lastViewedAt: string | null;
  status: string;
  createdBy?: string | null;
  /** Optional: level pill "Niveau x/y" */
  levelCurrent?: number | null;
  levelTotal?: number | null;
  /** Optional: progress 0–100 */
  progressPct?: number | null;
  /** Optional: step label "Étape a/b" */
  stepCurrent?: number | null;
  stepTotal?: number | null;
  /** Optional: friends for tooltip */
  friends?: FriendInTooltip[] | null;
  followerCount?: number | null;
  /** Optional: rating 1–5 and review count */
  rating?: number | null;
  reviewCount?: number | null;
};

type RitualCardProps = {
  item: RitualCardItem;
  onOpen: (ritualId: string) => void;
  onRemove: (ritualId: string) => void;
};

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM8 4v4.5l2.5 2.5-.7.7L7.2 8.2V4h.8z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.2l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9L8 12.4l-3.6 1.9.7-4L1.2 5.4l4-.6L8 1.2z" />
    </svg>
  );
}

export default function RitualCard({ item, onOpen, onRemove }: RitualCardProps) {
  const title = item.title || 'Rituel';
  const levelCurrent = item.levelCurrent ?? 1;
  const levelTotal = item.levelTotal ?? 1;
  const progressPct = typeof item.progressPct === 'number' ? Math.min(100, Math.max(0, item.progressPct)) : 0;
  const stepCurrent = item.stepCurrent ?? 0;
  const stepTotal = item.stepTotal ?? 1;
  const friends = item.friends ?? [];
  const rating = typeof item.rating === 'number' ? Math.min(5, Math.max(0, item.rating)) : null;
  const reviewCount = typeof item.reviewCount === 'number' ? item.reviewCount : null;
  const viewedLabel = `Vu ${timeAgoFR(item.lastViewedAt)}`;

  const showLevel =
    (item.levelCurrent != null || item.levelTotal != null) && (item.levelTotal ?? 0) > 0;
  const showStep =
    (item.stepCurrent != null || item.stepTotal != null) && (item.stepTotal ?? 0) > 0;
  const showFriends = friends.length > 0;
  const showRating = rating !== null;

  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(item.id);
        }
      }}
    >
      <div className={styles.thumb}>
        {item.imageUrl ? (
          <img className={styles.thumbImage} src={item.imageUrl} alt={title} />
        ) : (
          <PlanImage
            ritualId={item.id}
            intention={title}
            title={title}
            className={styles.thumbImage}
          />
        )}
        {showLevel && (
          <span className={styles.levelPill}>
            Niveau {levelCurrent}/{levelTotal}
          </span>
        )}
        <button
          className={styles.remove}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(item.id);
          }}
          aria-label="Retirer ce rituel"
        >
          ×
        </button>
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.title} title={title}>
          {title}
        </h3>
        <div className={styles.progressRow}>
          <span className={styles.progressPct}>{progressPct}%</span>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        {showStep && (
          <p className={styles.stepLabel}>
            Étape {stepCurrent}/{stepTotal}
          </p>
        )}
        <div className={styles.friendsRatingRow}>
          <div className={styles.friendsBlock}>
            {showFriends && (
              <FriendsStack friends={friends} followerCount={item.followerCount} />
            )}
          </div>
          {showRating && (
            <div className={styles.ratingBlock}>
              <div className={styles.starsRow} aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => (
                  <StarIcon
                    key={i}
                    className={`${styles.starIcon} ${rating >= i ? styles.star : styles.starEmpty}`}
                  />
                ))}
              </div>
              <span className={styles.ratingScore}>{rating.toFixed(1)}</span>
              {reviewCount !== null && (
                <span className={styles.ratingCount}>({reviewCount})</span>
              )}
            </div>
          )}
        </div>
        <div className={styles.viewedRow}>
          <ClockIcon className={styles.clockIcon} />
          <span>{viewedLabel}</span>
        </div>
      </div>
    </article>
  );
}
