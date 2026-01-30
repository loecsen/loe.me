'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FriendsTooltip, { type FriendInTooltip } from './FriendsTooltip';
import styles from './FriendsStack.module.css';

const MAX_VISIBLE_AVATARS = 5;
const HOVER_DELAY_MS = 150;

type FriendsStackProps = {
  friends: FriendInTooltip[];
  followerCount?: number | null;
};

function GroupIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm1 2h-6a3 3 0 0 0-3 3v1h12v-1a3 3 0 0 0-3-3z" />
    </svg>
  );
}

export default function FriendsStack({ friends, followerCount }: FriendsStackProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tooltipContainerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || tooltipContainerRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [isOpen, close]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, close]);

  const registerOutsideClick = useCallback((handler: () => void) => {
    const fn = (e: PointerEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || tooltipContainerRef.current?.contains(target)) return;
      handler();
    };
    document.addEventListener('pointerdown', fn);
    return () => document.removeEventListener('pointerdown', fn);
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => setIsOpen(true), HOVER_DELAY_MS);
  }, [clearHoverTimer]);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    if (tooltipContainerRef.current?.contains(e.relatedTarget as Node)) return;
    clearHoverTimer();
    setIsOpen(false);
  }, [clearHoverTimer]);

  const handleAnchorClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  if (!friends?.length) return null;

  const visibleAvatars = friends.slice(0, MAX_VISIBLE_AVATARS);
  const restCount = friends.length > MAX_VISIBLE_AVATARS ? friends.length - MAX_VISIBLE_AVATARS : 0;
  const displayCount =
    typeof followerCount === 'number' && followerCount > 0
      ? followerCount.toLocaleString()
      : String(friends.length);

  return (
    <div
      className={styles.wrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={anchorRef}
        type="button"
        className={styles.anchor}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`${friends.length} amis suivent cette formation`}
        onClick={handleAnchorClick}
        onFocus={() => setIsOpen(true)}
        onBlur={(e) => {
          if (!e.relatedTarget || !tooltipContainerRef.current?.contains(e.relatedTarget)) setIsOpen(false);
        }}
      >
        <div className={styles.avatars}>
          {visibleAvatars.map((friend) =>
            friend.avatarUrl ? (
              <img
                key={friend.id}
                src={friend.avatarUrl}
                alt=""
                className={styles.avatar}
                width={24}
                height={24}
              />
            ) : (
              <div key={friend.id} className={styles.avatarPlaceholder} aria-hidden />
            ),
          )}
          {restCount > 0 && <span className={styles.moreBadge}>+{restCount}</span>}
        </div>
        <span className={styles.groupCount}>
          <GroupIcon className={styles.groupIcon} />
          {displayCount}
        </span>
      </button>
      <div ref={tooltipContainerRef} className={styles.tooltipSlot}>
        <FriendsTooltip
          friends={friends}
          followerCount={followerCount}
          isOpen={isOpen}
          onClose={close}
          anchorRef={anchorRef}
          registerOutsideClick={registerOutsideClick}
          positionByParent
        />
      </div>
    </div>
  );
}
