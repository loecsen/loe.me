'use client';

import { useEffect, useRef } from 'react';
import styles from './FriendsTooltip.module.css';

export type FriendInTooltip = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  stepCurrent: number;
  stepTotal: number;
};

const MAX_VISIBLE = 8;

type FriendsTooltipProps = {
  friends: FriendInTooltip[];
  followerCount?: number | null;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** For mobile: tap outside to close */
  registerOutsideClick?: (handler: () => void) => () => void;
  /** When true, parent positions the tooltip (e.g. inside FriendsStack slot) so hover area includes tooltip */
  positionByParent?: boolean;
};

export default function FriendsTooltip({
  friends,
  followerCount,
  isOpen,
  onClose,
  anchorRef,
  registerOutsideClick,
  positionByParent = false,
}: FriendsTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !registerOutsideClick) return;
    const unregister = registerOutsideClick(onClose);
    return unregister;
  }, [isOpen, registerOutsideClick, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const visible = friends.slice(0, MAX_VISIBLE);
  const restCount = friends.length > MAX_VISIBLE ? friends.length - MAX_VISIBLE : 0;
  const countLabel =
    typeof followerCount === 'number' && followerCount > 0
      ? followerCount.toLocaleString()
      : friends.length.toString();

  return (
    <div
      ref={tooltipRef}
      className={`${styles.tooltip} ${positionByParent ? styles.tooltipInSlot : styles.tooltipPositionSelf}`}
      role="tooltip"
      aria-live="polite"
    >
      <p className={styles.tooltipHeader}>
        {friends.length} amis suivent cette formation
      </p>
      <ul className={styles.friendList}>
        {visible.map((friend) => {
          const pct =
            friend.stepTotal > 0
              ? Math.min(100, (friend.stepCurrent / friend.stepTotal) * 100)
              : 0;
          return (
            <li key={friend.id} className={styles.friendRow}>
              {friend.avatarUrl ? (
                <img
                  src={friend.avatarUrl}
                  alt=""
                  className={styles.friendAvatar}
                  width={24}
                  height={24}
                />
              ) : (
                <div
                  className={styles.friendAvatar}
                  aria-hidden
                />
              )}
              <div className={styles.friendInfo}>
                <span className={styles.friendName}>{friend.name}</span>
                <div className={styles.friendProgressBar}>
                  <div
                    className={styles.friendProgressFill}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className={styles.friendStep}>
                {friend.stepCurrent}/{friend.stepTotal}
              </span>
            </li>
          );
        })}
      </ul>
      {restCount > 0 && (
        <p className={styles.moreLabel}>+{restCount} autres</p>
      )}
    </div>
  );
}
