import React from 'react';

export type SgpHealthTone = 'good' | 'warn' | 'bad';

export function HealthBadge({ tone, title }: { tone: 'good'|'warn'|'bad'; title: string }) {
  const icon = tone === 'good' ? '✓' : '!';
  return (
    <button
      type="button"
      className="sgp-health"
      data-tone={tone}
      title={title}
      aria-label={title}
    >
      <span aria-hidden="true" style={{ fontWeight: 1000, fontSize: 14, lineHeight: 1 }}>
        {icon}
      </span>
    </button>
  );
}
