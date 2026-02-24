import React from 'react';

export function ShimmerLine({ w }: { w?: number }) {
  const width = Math.max(18, Math.min(100, Number.isFinite(Number(w)) ? Number(w) : 72));
  return (
    <div className="sgpShimmerLine" style={{ width: `${width}%` }}>
      <div className="sgpShimmerLine__shine" />
    </div>
  );
}
