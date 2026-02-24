import React from 'react';
import clsx from 'clsx';

export function SgCard({
  className,
  children,
  variant = 'default',
}: {
  className?: string;
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'outline';
}) {
  return (
    <section className={clsx('sgp-card', `sgp-card--${variant}`, className)}>
      {children}
    </section>
  );
}

export function SgCardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx('sgp-card__header', className)}>{children}</div>;
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
