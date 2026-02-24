import React from 'react';
import clsx from 'clsx';

type Tone = 'ok' | 'warn' | 'bad' | 'dev';

export function SgStatusBadge({
  tone,
  label,
  title,
  compact = true,
  className,
}: {
  tone: Tone;
  label?: string;
  title?: string;
  compact?: boolean;
  className?: string;
}) {
  const text =
    label ??
    (tone === 'ok' ? 'OK' : tone === 'warn' ? 'WARN' : tone === 'bad' ? 'BAD' : 'DEV');

  const icon =
    tone === 'ok' ? '✓' : tone === 'warn' ? '!' : tone === 'bad' ? '!' : 'DEV';

  return (
    <span
      className={clsx('sgp-status', `sgp-status--${tone}`, compact && 'is-compact', className)}
      title={title}
    >
      <span className="sgp-status__icon" aria-hidden>
        {icon}
      </span>
      <span className="sgp-status__txt">{text}</span>
    </span>
  );
}
