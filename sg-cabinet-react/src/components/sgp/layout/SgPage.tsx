import React from 'react';
import clsx from 'clsx';

export function SgPage({
  title,
  subtitle,
  actions,
  children,
  aside,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('sgp-page', className)}>
      <div className="sgp-page__header">
        <div className="sgp-page__headLeft">
          <div className="sgp-page__title">{title}</div>
          {subtitle ? <div className="sgp-page__subtitle">{subtitle}</div> : null}
        </div>
        {actions ? <div className="sgp-page__actions">{actions}</div> : null}
      </div>

      <div className={clsx('sgp-page__grid', !aside && 'sgp-page__grid--single')}>
        <main className="sgp-page__main">{children}</main>
        {aside ? <aside className="sgp-page__aside">{aside}</aside> : null}
      </div>
    </div>
  );
}
