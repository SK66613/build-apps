import React from 'react';
import clsx from 'clsx';

export function Card({ className, children }: { className?: string; children: React.ReactNode }){
  return <div className={clsx('sg-card', className)}>{children}</div>;
}

export function Button({
  className,
  variant = 'default',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' }){
  return (
    <button
      {...props}
      className={clsx(
        'sg-btn',
        variant === 'primary' && 'sg-btn--primary',
        variant === 'ghost' && 'sg-btn--ghost',
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>){
  return <input {...props} className={clsx('sg-input', className)} />;
}

export function Label({ className, ...props }: React.HTMLAttributes<HTMLLabelElement>){
  return <label {...props} className={clsx('sg-label', className)} />;
}

export function Pill({ className, children }: { className?: string; children: React.ReactNode }){
  return <span className={clsx('sg-pill', className)}>{children}</span>;
}
