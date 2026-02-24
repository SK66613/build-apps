import React from 'react';
import clsx from 'clsx';

type Tone = 'neutral' | 'good' | 'warn' | 'bad';
type Variant = 'default' | 'subtle' | 'outline';

export function SgCard({
  className,
  children,
  variant = 'default',
  tone = 'neutral',
  lift = true,
}: {
  className?: string;
  children: React.ReactNode;
  variant?: Variant;
  tone?: Tone;
  lift?: boolean;
}) {
  return (
    <section
      className={clsx(
        'sgp-card',
        `sgp-card--${variant}`,
        tone !== 'neutral' && `is-${tone}`,
        lift && 'is-lift',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SgCardHeader({
  className,
  children,
  right,
}: {
  className?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className={clsx('sgp-card__header', className)}>
      <div className="sgp-card__headerLeft">{children}</div>
      {right ? <div className="sgp-card__headerRight">{right}</div> : null}
    </div>
  );
}

export function SgCardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx('sgp-card__title', className)}>{children}</div>;
}

export function SgCardSub({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx('sgp-card__sub', className)}>{children}</div>;
}

export function SgCardContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx('sgp-card__content', className)}>{children}</div>;
}

export function SgCardFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx('sgp-card__footer', className)}>{children}</div>;
}
