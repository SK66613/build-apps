import React from 'react';
import clsx from 'clsx';

export function SgInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('sgp-input', className)} />;
}

export function SgSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  children: React.ReactNode;
}) {
  return (
    <select {...props} className={clsx('sgp-input', 'sgp-select', className)}>
      {children}
    </select>
  );
}
