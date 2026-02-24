import React from 'react';
import { HealthBadge, type SgpHealthTone } from './HealthBadge';

export function Collapsible({
  title,
  sub,
  right,
  open,
  onToggle,
  children,
  healthTone,
  healthTitle,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  healthTone?: SgpHealthTone;
  healthTitle?: string;
}) {
  const toneCls =
    healthTone === 'bad'
      ? ' is-bad'
      : healthTone === 'warn'
        ? ' is-warn'
        : healthTone === 'good'
          ? ' is-good'
          : '';

  return (
    <div className={'sgpColl ' + (open ? 'is-open' : 'is-closed') + toneCls}>
      <button type="button" className="sgpColl__head" onClick={onToggle}>
        <div className="sgpColl__left">
          <div className="sgpColl__title">
            {title}
            <span className="sgpColl__chev" aria-hidden="true" />
          </div>
          {sub ? <div className="sgpColl__sub">{sub}</div> : null}
        </div>

        <div className="sgpColl__right">
          {right}
          {healthTone ? (
            <HealthBadge tone={healthTone} title={healthTitle || ''} compact />
          ) : null}
        </div>
      </button>

      <div className="sgpColl__body">{children}</div>
    </div>
  );
}
