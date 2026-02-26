// sg-cabinet-react/src/components/sgp/blocks/SgRowsSummary.tsx
import React from 'react';

export type SgSummaryTone = 'neutral' | 'good' | 'warn' | 'bad';

export type SgRowsSummaryItem = {
  key: string;

  /** тон подсветки строки */
  tone?: SgSummaryTone;

  /** левая часть */
  title: React.ReactNode;
  meta?: React.ReactNode;

  /** правая часть */
  value: React.ReactNode;
  sub?: React.ReactNode;

  /** например HealthBadge / кнопки / иконки */
  right?: React.ReactNode;

  /** onClick по строке (если нужно) */
  onClick?: () => void;

  /** tooltip */
  hint?: string;
};

export type SgRowsSummaryProps = {
  items: SgRowsSummaryItem[];
  columns?: 1 | 2;
  dense?: boolean;
  className?: string;
};

function rowToneClass(t?: SgSummaryTone) {
  if (t === 'good') return 'is-good';
  if (t === 'warn') return 'is-warn';
  if (t === 'bad') return 'is-bad';
  return '';
}

export default function SgRowsSummary({ items, columns = 2, dense, className }: SgRowsSummaryProps) {
  return (
    <div
      className={[
        'sgp-rowsSummary',
        columns === 1 ? 'cols-1' : 'cols-2',
        dense ? 'is-dense' : '',
        className || '',
      ].join(' ')}
    >
      {items.map((it) => {
        const clickable = typeof it.onClick === 'function';
        const Tag: any = clickable ? 'button' : 'div';

        return (
          <Tag
            key={it.key}
            type={clickable ? 'button' : undefined}
            className={[
              'sgp-row',
              rowToneClass(it.tone),
              clickable ? 'is-click' : '',
            ].join(' ')}
            onClick={it.onClick}
            title={it.hint}
          >
            <div className="sgp-row__left">
              <div className="sgp-row__title">{it.title}</div>
              {it.meta ? <div className="sgp-row__meta">{it.meta}</div> : null}
            </div>

            <div className="sgp-row__right">
              <div className="sgp-row__val">{it.value}</div>
              {it.sub ? <div className="sgp-row__sub">{it.sub}</div> : null}
            </div>

            {it.right ? <div className="sgp-row__aux">{it.right}</div> : null}
          </Tag>
        );
      })}
    </div>
  );
}
