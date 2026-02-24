// sg-cabinet-react/src/components/ui.tsx
import React from 'react';
import clsx from 'clsx';

/* =========================
   Card
========================= */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx('sg-card', className)}>{children}</div>;
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx('sg-card__header', className)}>{children}</div>;
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx('sg-card__title', className)}>{children}</div>;
}

export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx('sg-card__content', className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx('sg-card__footer', className)}>{children}</div>;
}

/* =========================
   Button
========================= */

export function Button({
  className,
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  type,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  const isDisabled = !!disabled || loading;

  return (
    <button
      {...props}
      type={type ?? 'button'}
      disabled={isDisabled}
      className={clsx(
        'sg-btn',
        variant === 'primary' && 'sg-btn--primary',
        variant === 'ghost' && 'sg-btn--ghost',
        variant === 'danger' && 'sg-btn--danger',
        size === 'sm' && 'sg-btn--sm',
        isDisabled && 'sg-btn--disabled',
        className,
      )}
    >
      {loading && <span className="sg-btn__spinner" aria-hidden />}
      <span className="sg-btn__content">{children}</span>
    </button>
  );
}

/* =========================
   Input
========================= */

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('sg-input', className)} />;
}

/* =========================
   Label
========================= */

export function Label({
  className,
  ...props
}: React.HTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={clsx('sg-label', className)} />;
}

/* =========================
   Toggle (Switch)
========================= */

export function Toggle({
  className,
  checked,
  disabled,
  onChange,
  ...props
}: {
  className?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  return (
    <label
      className={clsx(
        'sg-toggle',
        checked && 'is-checked',
        disabled && 'is-disabled',
        className,
      )}
    >
      <input
        {...props}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="sg-toggle__input"
      />
      <span className="sg-toggle__track">
        <span className="sg-toggle__thumb" />
      </span>
    </label>
  );
}

/* =========================
   Pill
========================= */

export function Pill({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={clsx('sg-pill', className)}>{children}</span>;
}
