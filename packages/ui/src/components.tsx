import type { PropsWithChildren } from 'react';

export type ContainerProps = PropsWithChildren<{ className?: string }>;

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={className}
      style={{
        margin: '0 auto',
        maxWidth: '1080px',
        padding: '0 var(--loe-space-xl)',
      }}
    >
      {children}
    </div>
  );
}

export type SurfaceProps = PropsWithChildren<{ className?: string }>;

export function Surface({ children, className }: SurfaceProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--loe-color-surface)',
        border: '1px solid var(--loe-color-border)',
        borderRadius: 'var(--loe-radius-lg)',
        padding: 'var(--loe-space-xl)',
        boxShadow: '0 14px 40px rgba(31, 41, 55, 0.06)',
      }}
    >
      {children}
    </div>
  );
}

export type PillProps = PropsWithChildren<{ className?: string }>;

export function Pill({ children, className }: PillProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--loe-space-xs)',
        borderRadius: 'var(--loe-radius-pill)',
        background: 'var(--loe-color-accent)',
        color: 'var(--loe-color-text)',
        padding: '6px 14px',
        fontSize: 'var(--loe-font-size-sm)',
        fontWeight: 'var(--loe-font-weight-medium)',
        letterSpacing: 'var(--loe-letter-spacing, -0.01em)',
      }}
    >
      {children}
    </span>
  );
}
