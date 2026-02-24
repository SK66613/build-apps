import React from 'react';
import clsx from 'clsx';
import { Label } from '../../ui';

export function SgFormRow({
  label,
  hint,
  right,
  children,
  className,
  dense,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={clsx('sg-formrow', dense && 'sg-formrow--dense', className)}>
      {(label || right) ? (
        <div className="sg-formrow__top">
          <div className="sg-formrow__label">
            {label ? <Label className="sg-formrow__labelText">{label}</Label> : null}
          </div>
          {right ? <div className="sg-formrow__right">{right}</div> : null}
        </div>
      ) : null}

      <div className="sg-formrow__control">{children}</div>

      {hint ? <div className="sg-formrow__hint">{hint}</div> : null}
    </div>
  );
}
