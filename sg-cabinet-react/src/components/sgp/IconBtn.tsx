import React from 'react';

export function IconBtn({ title, active, onClick, children }: any) {
  return (
    <button
      type="button"
      className={'sgp-iconbtn ' + (active ? 'is-active' : '')}
      onClick={onClick}
      title={title}
      aria-pressed={!!active}
    >
      {children}
    </button>
  );
}
