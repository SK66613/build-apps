import React from 'react';
import clsx from 'clsx';

export function SgButton({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  type,
  leftIcon,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  leftIcon?: React.ReactNode;
}) {
  const isDisabled = !!disabled || loading;

  return (
    <button
      {...props}
      type={type ?? 'button'}
      disabled={isDisabled}
      className={clsx(
        'sgp-btn',
        `sgp-btn--${variant}`,
        size === 'sm' && 'sgp-btn--sm',
        isDisabled && 'is-disabled',
        className,
      )}
    >
      {loading ? <span className="sgp-btn__spinner" aria-hidden /> : null}
      {leftIcon ? <span className="sgp-btn__icon">{leftIcon}</span> : null}
      <span className="sgp-btn__content">{children}</span>
    </button>
  );
}
