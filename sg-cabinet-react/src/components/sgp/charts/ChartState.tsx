import React from 'react';

function Spinner() {
  return (
    <div className="sgp-chartSpinner" aria-label="loading">
      <svg viewBox="0 0 24 24" width="22" height="22">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="rgba(15,23,42,.22)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="18 10"
        />
      </svg>
    </div>
  );
}

export function ChartState({
  height = 340,
  isLoading,
  isError,
  errorText,
  children,
}: {
  height?: number;
  isLoading: boolean;
  isError: boolean;
  errorText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sgp-chartState" style={{ height }}>
      {/* график рендерим только когда готовы данные (так стабильнее) */}
      {!isLoading && !isError ? children : null}

      {isLoading ? (
        <div className="sgp-chartOverlay">
          <Spinner />
        </div>
      ) : null}

      {isError ? (
        <div className="sgp-chartOverlay">
          <div className="sgp-hint tone-bad">Ошибка: {errorText || 'UNKNOWN'}</div>
        </div>
      ) : null}
    </div>
  );
}
