import React from 'react';
import clsx from 'clsx';
import { Card } from '../../ui';

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
    <div className={clsx('sg-page', className)}>
      <div className="sg-page__header">
        <div className="sg-page__headLeft">
          <div className="sg-page__title">{title}</div>
          {subtitle ? <div className="sg-page__subtitle">{subtitle}</div> : null}
        </div>
        {actions ? <div className="sg-page__actions">{actions}</div> : null}
      </div>

      <div className={clsx('sg-page__grid', !aside && 'sg-page__grid--single')}>
        <main className="sg-page__main">{children}</main>

        {aside ? (
          <aside className="sg-page__aside">
            <Card className="sg-page__asideCard">{aside}</Card>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
