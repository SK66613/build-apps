import React from 'react';

export type SgpHealthTone = 'good' | 'warn' | 'bad';

export function HealthBadge({
  tone,
  title,
  compact,
}: {
  tone: SgpHealthTone;
  title: string;
  compact?: boolean;
}) {
  const cls =
    'sgpHealthBadge ' +
    (tone === 'bad' ? 'is-bad' : tone === 'warn' ? 'is-warn' : 'is-good') +
    (compact ? ' is-compact' : '');

  const icon = tone === 'bad' ? '!' : tone === 'warn' ? '!' : '✓';
  const label = tone === 'bad' ? 'alert' : tone === 'warn' ? 'warn' : 'ok';

  return (
    <span className={cls} title={title} aria-label={title}>
      <span className="sgpHealthBadge__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sgpHealthBadge__txt">{label}</span>
    </span>
  );
}
