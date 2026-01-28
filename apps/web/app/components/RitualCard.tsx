'use client';

import PlanImage from './PlanImage';
import { timeAgoFR } from '../lib/time/timeAgo';
import styles from './RitualHistory.module.css';

export type RitualCardItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  lastViewedAt: string | null;
  status: string;
  createdBy?: string | null;
};

type RitualCardProps = {
  item: RitualCardItem;
  onOpen: (ritualId: string) => void;
  onRemove: (ritualId: string) => void;
};

export default function RitualCard({ item, onOpen, onRemove }: RitualCardProps) {
  const title = item.title || 'Rituel';
  const viewedLabel = `Vu ${timeAgoFR(item.lastViewedAt)}`;

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
      </div>
      <div className={styles.cardBody}>
        <span className={styles.title} title={title}>
          {title}
        </span>
        <div className={styles.meta}>{viewedLabel}</div>
        <button
          className={styles.remove}
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove(item.id);
          }}
        >
          Remove
        </button>
      </div>
    </article>
  );
}
