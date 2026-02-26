import React from 'react';
import { HealthBadge } from '../HealthBadge';
import { ShimmerLine } from '../ShimmerLine';

export type SgRowTone = 'good' | 'warn' | 'bad' | 'neutral';

export type SgRowItem = {
  key: string;

  title: React.ReactNode;
  meta?: React.ReactNode;

  value?: React.ReactNode;
  sub?: React.ReactNode;

  tone?: SgRowTone;

  // Small right-side controls/badges/icons (optional)
  right?: React.ReactNode;

  // Optional click (e.g. open details modal later)
  onClick?: () => void;
};

export type SgRowsSummaryProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;

  loading?: boolean;
  items: SgRowItem[];

  columns?: 1 | 2;
  className?: string;

  /** compact paddings */
  dense?: boolean;
};

function toneCls(t?: SgRowTone) {
  if (t === 'good') return 'is-good';
  if (t === 'warn') return 'is-warn';
  if (t === 'bad') return 'is-bad';
  return '';
}

export function SgRowsSummary(props: SgRowsSummaryProps) {
  const {
    title,
    subtitle,
    right,
    loading,
    items,
    columns = 2,
    className,
    dense,
  } = props;

  const cols = Math.max(1, Math.min(2, columns));

  return (
    <div className={`sgRS ${dense ? 'is-dense' : ''} ${className || ''}`}>
      <style>{`
/* ===== SgRowsSummary (old Sales sgRow style) ===== */
.sgRS{
  --rs-r-xl: 22px;
  --rs-r-md: 14px;

  --rs-bd: rgba(15,23,42,.10);

  --rs-shadow: 0 10px 26px rgba(15,23,42,.06);
  --rs-in: inset 0 1px 0 rgba(255,255,255,.70);

  --rs-warnTint: rgba(245,158,11,.08);
  --rs-warnBd: rgba(245,158,11,.18);

  --rs-dangerTint: rgba(239,68,68,.08);
  --rs-dangerBd: rgba(239,68,68,.18);

  --rs-goodTint: rgba(34,197,94,.08);
  --rs-goodBd: rgba(34,197,94,.18);
}

.sgRS__head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:10px;
}
.sgRS__title{ font-weight: 1000; letter-spacing: -.01em; }
.sgRS__sub{ margin-top:4px; font-size: 13px; opacity:.78; }
.sgRS__right{ display:flex; align-items:center; gap:10px; }

.sgRS__grid{
  display:grid;
  grid-template-columns: repeat(var(--rs-cols, 2), 1fr);
  gap:10px;
}
@media (max-width: 1100px){
  .sgRS__grid{ grid-template-columns: 1fr; }
}

.sgRS__row{
  position:relative;
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap:10px;
  padding:10px 10px;
  border-radius: var(--rs-r-md);
  border:1px solid rgba(15,23,42,.07);
  background: rgba(255,255,255,.80);
  box-shadow: var(--rs-in);
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease, background .14s ease;
  text-align:left;
}
.sgRS__row:hover{
  transform: translateY(-1px);
  box-shadow: var(--rs-shadow), var(--rs-in);
  border-color: rgba(15,23,42,.12);
  background: var(--rs-warnTint);
}
.sgRS__row.is-warn{
  border-color: var(--rs-warnBd) !important;
  background: linear-gradient(0deg, var(--rs-warnTint), rgba(255,255,255,.86)) !important;
}
.sgRS__row.is-bad{
  border-color: var(--rs-dangerBd) !important;
  background: linear-gradient(0deg, var(--rs-dangerTint), rgba(255,255,255,.86)) !important;
}
.sgRS__row.is-good{
  border-color: var(--rs-goodBd) !important;
  background: linear-gradient(0deg, var(--rs-goodTint), rgba(255,255,255,.86)) !important;
}

.sgRS__rowBtn{ cursor:pointer; }
.sgRS__rowBtn:active{ transform: translateY(0px); }

.sgRS__left{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
  flex: 1 1 auto;
}
.sgRS__titleLine{
  font-weight: 1000;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.sgRS__meta{
  margin-top:2px;
  font-size:12px;
  opacity:.75;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.sgRS__rightBlock{
  text-align:right;
  display:flex;
  flex-direction:column;
  gap:2px;
  flex: 0 0 auto;
  align-items:flex-end;
}
.sgRS__val{ font-weight: 1000; font-variant-numeric: tabular-nums; }
.sgRS__subVal{ font-size:12px; opacity:.72; font-weight:800; }

.sgRS__rightInline{
  display:flex;
  align-items:center;
  gap:8px;
  margin-left:10px;
}

.sgRS.is-dense .sgRS__row{ padding:9px 10px; }
      `}</style>

      {(title || subtitle || right) ? (
        <div className="sgRS__head">
          <div>
            {title ? <div className="sgRS__title">{title}</div> : null}
            {subtitle ? <div className="sgRS__sub">{subtitle}</div> : null}
          </div>
          {right ? <div className="sgRS__right">{right}</div> : null}
        </div>
      ) : null}

      <div className="sgRS__grid" style={{ ['--rs-cols' as any]: cols }}>
        {(loading ? items.map((it) => (
          <div key={it.key} className="sgRS__row">
            <div className="sgRS__left">
              <div style={{ width: '100%' }}>
                <div className="sgRS__titleLine"><ShimmerLine w={48} /></div>
                <div className="sgRS__meta"><ShimmerLine w={82} /></div>
              </div>
            </div>
            <div className="sgRS__rightBlock">
              <div className="sgRS__val">—</div>
              <div className="sgRS__subVal">—</div>
            </div>
          </div>
        )) : items.map((it) => {
          const rowCls = `sgRS__row ${toneCls(it.tone)} ${it.onClick ? 'sgRS__rowBtn' : ''}`;

          const body = (
            <>
              <div className="sgRS__left">
                <div style={{ minWidth: 0 }}>
                  <div className="sgRS__titleLine">
                    {it.title}
                    {it.right ? <span className="sgRS__rightInline">{it.right}</span> : null}
                  </div>
                  {it.meta ? <div className="sgRS__meta">{it.meta}</div> : null}
                </div>
              </div>

              {(it.value !== undefined || it.sub !== undefined) ? (
                <div className="sgRS__rightBlock">
                  <div className="sgRS__val">{it.value ?? null}</div>
                  <div className="sgRS__subVal">{it.sub ?? null}</div>
                </div>
              ) : null}
            </>
          );

          if (it.onClick) {
            return (
              <button
                key={it.key}
                type="button"
                className={rowCls}
                onClick={it.onClick}
                style={{ border: 0, background: 'transparent', padding: 0 }}
              >
                <div className="sgRS__row" style={{ width: '100%' }}>
                  {body}
                </div>
              </button>
            );
          }

          return (
            <div key={it.key} className={rowCls}>
              {body}
            </div>
          );
        }))}
      </div>
    </div>
  );
}

export default SgRowsSummary;
