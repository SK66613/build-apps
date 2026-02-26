// sg-cabinet-react/src/components/sgp/blocks/SgSectionSummary.tsx
import React from 'react';

export type SgSummaryTone = 'neutral' | 'good' | 'warn' | 'bad';

export type SgSectionSummaryItem = {
  key: string;
  /** 1 строка (капс / лейбл) */
  label: React.ReactNode;
  /** 2 строка (значение) */
  value: React.ReactNode;
  /** 3 строка (подпись снизу) */
  sub?: React.ReactNode;
  /** опционально: тон для легкой подсветки плитки */
  tone?: SgSummaryTone;
  /** опционально: тултип/aria */
  title?: string;
};

export type SgSectionSummaryProps = {
  items: SgSectionSummaryItem[];
  /** по умолчанию 4 как в эталоне */
  columns?: 2 | 3 | 4 | 5 | 6;
  /** компактнее паддинги */
  dense?: boolean;
  className?: string;
};

function toneCls(t?: SgSummaryTone) {
  if (t === 'good') return 'tone-good';
  if (t === 'warn') return 'tone-warn';
  if (t === 'bad') return 'tone-bad';
  return 'tone-neutral';
}

export default function SgSectionSummary({
  items,
  columns = 4,
  dense,
  className,
}: SgSectionSummaryProps) {
  return (
    <div
      className={[
        'sgp-metrics',
        dense ? 'is-dense' : '',
        className || '',
      ].join(' ')}
      style={
        {
          // даём возможность переопределять колонки без правки scss
          ['--sgp-metrics-cols' as any]: String(columns),
        } as React.CSSProperties
      }
    >
      {items.map((it) => (
        <div
          key={it.key}
          className={['sgp-metric', toneCls(it.tone)].join(' ')}
          title={it.title}
        >
          <div className="sgp-metric__k">{it.label}</div>
          <div className="sgp-metric__v">{it.value}</div>
          {it.sub ? <div className="sgp-metric__s">{it.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
