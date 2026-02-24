import React from 'react';
import clsx from 'clsx';

export function SgToggle({
  className,
  checked,
  disabled,
  onChange,
  ...props
}: {
  className?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'>) {
  return (
    <label
      className={clsx(
        'sgp-toggle',
        checked && 'is-checked',
        disabled && 'is-disabled',
        className,
      )}
    >
      <input
        {...props}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="sgp-toggle__input"
      />
      <span className="sgp-toggle__track">
        <span className="sgp-toggle__thumb" />
      </span>
    </label>
  );
}
