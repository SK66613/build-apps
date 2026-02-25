import React from 'react';

import {
  SgCard,
  SgCardHeader,
  SgCardTitle,
  SgCardSub,
  SgCardContent,
} from '../ui/SgCard';

type MetricDef<T> = {
  key: string;                 // например: 'wins'
  label: string;               // 'выигрышам'
  value: (row: T) => number;   // достать число
  sub?: (row: T) => React.ReactNode; // подстрока под названием
};

type Props<T> = {
  title: string;
  subtitle?: React.ReactNode;

  // данные
  items: T[];
  getId?: (row: T, idx: number) => string;

  // как рисовать строку
  getTitle: (row: T) => React.ReactNode;

  // метрики переключателя (можно 2-3 штуки)
  metrics: MetricDef<T>[];

  // дефолтная метрика
  initialMetricKey?: string;

  // сколько строк показывать
  limit?: number;

  // если хочешь управлять метрикой снаружи (опционально)
  metricKey?: string;
  onMetricKeyChange?: (k: string) => void;

  emptyText?: string;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Универсальная карточка "Топ ...":
 * - сегмент переключения метрик
 * - список с прогресс-баром
 * - повторяемый в разных страницах (призы / кассиры / юзеры)
 *
 * ВАЖНО: стили берутся из ваших существующих классов:
 * sgp-seg / sgp-toplist / sgp-toprow / sgp-toprow__bar и т.д.
 */
export function SgTopListCard<T>(props: Props<T>) {
  const {
    title,
    subtitle,

    items,
    getId,
    getTitle,
    metrics,

    initialMetricKey,
    limit = 7,

    metricKey,
    onMetricKeyChange,

    emptyText = 'Пока пусто',
  } = props;

  const firstKey = metrics[0]?.key || 'metric';
  const [innerMetric, setInnerMetric] = React.useState<string>(initialMetricKey || firstKey);

  const activeKey = metricKey ?? innerMetric;
  const activeMetric = metrics.find((m) => m.key === activeKey) || metrics[0];

  function setMetric(k: string) {
    if (onMetricKeyChange) onMetricKeyChange(k);
    if (metricKey === undefined) setInnerMetric(k);
  }

  const top = React.useMemo(() => {
    const m = activeMetric;
    if (!m) return [];

    const sorted = [...(items || [])].sort((a, b) => (m.value(b) || 0) - (m.value(a) || 0));
    return sorted.slice(0, Math.max(1, limit));
  }, [items, activeMetric, limit]);

  const maxVal = React.useMemo(() => {
    const m = activeMetric;
    if (!m || !top.length) return 1;
    return Math.max(1, ...top.map((r) => Number(m.value(r) || 0)));
  }, [top, activeMetric]);

  return (
    <SgCard>
      <SgCardHeader>
        <div>
          <SgCardTitle>{title}</SgCardTitle>
          <SgCardSub>
            {subtitle ?? (activeMetric ? `по ${activeMetric.label}` : '')}
          </SgCardSub>
        </div>
      </SgCardHeader>

      <SgCardContent>
        {metrics.length > 1 ? (
          <div className="sgp-seg" style={{ marginBottom: 10 }}>
            {metrics.map((m) => (
              <button
                key={m.key}
                type="button"
                className={(m.key === activeKey ? 'sgp-seg__btn is-active ' : 'sgp-seg__btn ') + 'sgp-press'}
                onClick={() => setMetric(m.key)}
              >
                {m.label[0]?.toUpperCase() + m.label.slice(1)}
              </button>
            ))}
          </div>
        ) : null}

        <div className="sgp-toplist">
          {top.map((row, idx) => {
            const val = Number(activeMetric?.value(row) || 0);
            const w = clamp(Math.round((val / maxVal) * 100), 0, 100);

            return (
              <div key={getId ? getId(row, idx) : String(idx)} className="sgp-toprow">
                <div className="sgp-toprow__idx">{idx + 1}</div>

                <div className="sgp-toprow__mid">
                  <div className="sgp-toprow__title">{getTitle(row)}</div>

                  <div className="sgp-toprow__sub">
                    {activeMetric?.sub ? activeMetric.sub(row) : null}
                  </div>

                  <div className="sgp-toprow__bar">
                    <div className="sgp-toprow__barFill" style={{ width: `${w}%` }} />
                  </div>
                </div>

                <div className="sgp-toprow__val">{val}</div>
              </div>
            );
          })}

          {!top.length ? <div className="sgp-muted">{emptyText}</div> : null}
        </div>
      </SgCardContent>
    </SgCard>
  );
}
