import React from 'react';

function Spinner() {
  // без CSS-анимаций: чистый SVG animateTransform
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-label="loading">
      <g>
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
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </g>
    </svg>
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
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,              // ✅ не схлопывается
        background: 'transparent',
      }}
    >
      {!isLoading && !isError ? children : null}

      {(isLoading || isError) ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {isLoading ? (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'rgba(255,255,255,.78)',
                border: '1px solid rgba(15,23,42,.10)',
                boxShadow:
                  '0 18px 42px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // backdropFilter опционально; если браузер не поддержит — просто пропустит
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <Spinner />
            </div>
          ) : (
            <div
              style={{
                maxWidth: 520,
                padding: '10px 12px',
                borderRadius: 16,
                border: '1px solid rgba(239,68,68,.22)',
                background: 'rgba(255,255,255,.86)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)',
                color: 'rgba(15,23,42,.88)',
                fontWeight: 800,
                fontSize: 13,
                lineHeight: 1.25,
              }}
            >
              Ошибка: {errorText || 'UNKNOWN'}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
