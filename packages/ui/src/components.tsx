import type { PropsWithChildren, ButtonHTMLAttributes } from 'react';

export type ContainerProps = PropsWithChildren<{ className?: string }>;

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={className}
      // Exception ui-blueprint: layout only, to be migrated to classes
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
      // Exception ui-blueprint: tokens via var(); to be migrated to .loe-surface class
      style={{
        background: 'var(--loe-color-surface)',
        border: '1px solid var(--loe-color-border)',
        borderRadius: 'var(--loe-radius-lg)',
        padding: 'var(--loe-space-xl)',
        boxShadow: 'var(--loe-shadow-md)',
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
      // Exception ui-blueprint: tokens via var(); to be migrated to .loe-pill class
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--loe-space-xs)',
        borderRadius: 'var(--loe-radius-pill)',
        background: 'var(--loe-color-accent)',
        color: 'var(--loe-color-text)',
        padding: 'var(--loe-space-xxs) var(--loe-space-md)',
        fontSize: 'var(--loe-font-size-sm)',
        fontWeight: 'var(--loe-font-weight-medium)',
        letterSpacing: 'var(--loe-letter-spacing)',
      }}
    >
      {children}
    </span>
  );
}

/* Button — tokens only (classes in styles.css) */
export type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'cta' | 'text';
    className?: string;
  }
>;

export function Button({
  children,
  variant = 'primary',
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const variantClass =
    variant === 'secondary'
      ? ' loe-button--secondary'
      : variant === 'cta'
        ? ' loe-button--cta'
        : variant === 'text'
          ? ' loe-button--text'
          : '';
  return (
    <button
      type="button"
      className={`loe-button${variantClass} ${className}`.trim()}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

/* Card — tokens only */
export type CardProps = PropsWithChildren<{
  className?: string;
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}>;

export function Card({
  children,
  className = '',
  onClick,
  role,
  tabIndex,
  onKeyDown,
}: CardProps) {
  return (
    <article
      className={`loe-card ${className}`.trim()}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
    >
      {children}
    </article>
  );
}

export type CardThumbProps = PropsWithChildren<{ className?: string }>;

export function CardThumb({ children, className = '' }: CardThumbProps) {
  return <div className={`loe-card__thumb ${className}`.trim()}>{children}</div>;
}

export function CardTitle({
  children,
  className = '',
}: PropsWithChildren<{ className?: string }>) {
  return <span className={`loe-card__title ${className}`.trim()}>{children}</span>;
}

export function CardMeta({
  children,
  className = '',
}: PropsWithChildren<{ className?: string }>) {
  return <div className={`loe-card__meta ${className}`.trim()}>{children}</div>;
}

/* Tabs — tokens only */
export type TabId = string;

export type TabsProps = PropsWithChildren<{
  tabs: Array<{ id: TabId; label: string }>;
  activeId: TabId;
  onSelect: (id: TabId) => void;
  className?: string;
}>;

export function Tabs({ tabs, activeId, onSelect, className = '' }: TabsProps) {
  return (
    <div className={`loe-tabs ${className}`.trim()} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          className={`loe-tabs__tab ${activeId === tab.id ? 'loe-tabs__tab--active' : ''}`.trim()}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
