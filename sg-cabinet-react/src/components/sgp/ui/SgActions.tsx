import React from 'react';
import clsx from 'clsx';
import { Button } from '../../ui';

export type SgSaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SgActions({
  primaryLabel = 'Сохранить',
  onPrimary,
  state = 'idle',
  errorText,
  left,
  right,
  className,
}: {
  primaryLabel?: string;
  onPrimary?: () => void;
  state?: SgSaveState;
  errorText?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  const saving = state === 'saving';
  const saved = state === 'saved';
  const error = state === 'error';

  return (
    <div className={clsx('sg-actions', className)}>
      <div className="sg-actions__left">{left}</div>

      <div className="sg-actions__right">
        <div className="sg-actions__status">
          {saving ? <span className="sg-actions__muted">Сохраняю…</span> : null}
          {saved ? <span className="sg-actions__ok">Сохранено</span> : null}
          {error ? (
            <span className="sg-actions__err">{errorText || 'Ошибка сохранения'}</span>
          ) : null}
        </div>

        {right}

        <Button
          variant="primary"
          loading={saving}
          disabled={!onPrimary}
          onClick={onPrimary}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
