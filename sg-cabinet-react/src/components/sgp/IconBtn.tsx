import React from 'react';

export function IconBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={'sgpIconBtn ' + (active ? 'is-active' : '')}
      onClick={onClick}
      title={title}
      aria-pressed={!!active}
    >
      {children}
    </button>
  );
}
