import React from 'react';

export function Tip({
  text,
  side = 'top',
  dev,
}: {
  text: string;
  side?: 'top' | 'bottom';
  dev?: boolean;
}) {
  return (
    <span
      className={'sgpTip ' + (dev ? 'is-dev' : '') + ' is-' + side}
      data-tip={text}
      aria-hidden="true"
    />
  );
}
