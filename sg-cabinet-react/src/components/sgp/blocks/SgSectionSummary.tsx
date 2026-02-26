import React from 'react';
import { HealthBadge } from '../HealthBadge';
import { ShimmerLine } from '../ShimmerLine';

/**
 * Universal “Summary tiles” block (extracted from your old Sales summary style).
 * Goal: one reusable component for any section.
 *
 * Usage:
 * <SgSectionSummary
 *   title="Сводка"
 *   subtitle="..."
 *   right={<HealthBadge ... />}
 *   loading={isLoading}
 *   items={[{ key:'rev', label:'Выручка', value:'...', sub:'...' }, ...]}
 * />
 */

export type SgSummaryTone = 'good' | 'warn' | 'bad' | 'neutral';

export type SgSectionSummaryItem = {
  key: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: SgSummaryTone;
  hint?: string; // tooltip
  right?: React.ReactNode; // mini badge or icon on tile
};

export type SgSectionSummaryProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode; // header right side
  loading?: boolean;

  items: SgSectionSummaryItem[];

  /**
   * Layout:
   * - default: tries to match old Sales summary (5 cols desktop, 2 cols mobile)
   */
  columns?: 2 | 3 | 4 | 5;
  dense?: boolean;
  className?: string;

  /**
   * Optional footer row items (below tiles) — for “rows” style if needed later.
   */
  footer?: React.ReactNode;
};

function tileToneCls(tone?: SgSummaryTone) {
  if (tone === 'good') return 'is-good';
  if (tone === 'warn') return 'is-warn';
  if (tone === 'bad') return 'is-bad';
  return '';
}

function TipDot({ text }: { text: string }) {
  return <span className="sgSS__tip" data-tip={text} aria-hidden="true" />;
}

export function SgSectionSummary(props: SgSectionSummaryProps) {
  const {
    title,
    subtitle,
    right,
    loading,
    items,
    columns = 5,
    dense,
    className,
    footer,
  } = props;

  const cols = Math.max(2, Math.min(5, columns));

  return (
    <div className={`sgSS ${dense ? 'is-dense' : ''} ${className || ''}`}>
      <style>{`
/* ===== SgSectionSummary (old Sales summary-like tiles) ===== */
.sgSS{
  --ss-r-xl: 22px;
  --ss-r-lg: 18px;
  --ss-r-md: 14px;

  --ss-bd: rgba(15,23,42,.10);
  --ss-bd2: rgba(15,23,42,.08);
  --ss-card: rgba(255,255,255,.88);
  --ss-card2: rgba(255,255,255,.96);
  --ss-soft: rgba(15,23,42,.03);

  --ss-shadow: 0 10px 26px rgba(15,23,42,.06);
  --ss-shadow2: 0 16px 40px rgba(15,23,42,.10);
  --ss-in: inset 0 1px 0 rgba(255,255,255,.70);

  --ss-warnTint: rgba(245,158,11,.08);
  --ss-warnBd: rgba(245,158,11,.18);

  --ss-dangerTint: rgba(239,68,68,.08);
  --ss-dangerBd: rgba(239,68,68,.18);

  --ss-goodTint: rgba(34,197,94,.08);
  --ss-goodBd: rgba(34,197,94,.18);

  --ss-glow: 0 0 0 1px rgba(15,23,42,.10), 0 18px 42px rgba(15,23,42,.10);
}

.sgSS__head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:10px;
}
.sgSS__title{
  font-weight: 1000;
  letter-spacing: -.01em;
}
.sgSS__sub{
  margin-top:4px;
  font-size: 13px;
  opacity: .78;
}
.sgSS__right{
  display:flex;
  align-items:center;
  gap:10px;
}

.sgSS__grid{
  display:grid;
  grid-template-columns: repeat(var(--ss-cols, 5), 1fr);
  gap:10px;
}

@media (max-width: 1100px){
  .sgSS__grid{ grid-template-columns: repeat(2, 1fr); }
}

.sgSS__tile{
  position:relative;
  border:1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.88);
  border-radius: var(--ss-r-lg);
  padding:12px 12px;
  box-shadow: var(--ss-in);
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease, background .14s ease;
  text-align:left;
  overflow:hidden;
}
.sgSS__tile:hover{
  transform: translateY(-1px);
  box-shadow: var(--ss-shadow2), var(--ss-in);
  border-color: rgba(15,23,42,.12);
  background: rgba(255,255,255,.96);
}

.sgSS__tile.is-good{
  border-color: var(--ss-goodBd);
  background: linear-gradient(0deg, var(--ss-goodTint), rgba(255,255,255,.90));
}
.sgSS__tile.is-warn{
  border-color: var(--ss-warnBd);
  background: linear-gradient(0deg, var(--ss-warnTint), rgba(255,255,255,.90));
}
.sgSS__tile.is-bad{
  border-color: var(--ss-dangerBd);
  background: linear-gradient(0deg, var(--ss-dangerTint), rgba(255,255,255,.90));
}

.sgSS__k{
  font-weight:900;
  font-size:12px;
  letter-spacing:.08em;
  text-transform:uppercase;
  opacity:.72;
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
}
.sgSS__v{
  margin-top:6px;
  font-weight:950;
  font-size:20px;
  letter-spacing:-.02em;
  font-variant-numeric: tabular-nums;
}
.sgSS__s{
  margin-top:6px;
  font-size:12px;
  opacity:.78;
  min-height: 16px;
}

.sgSS__tileRight{
  position:absolute;
  top:10px;
  right:10px;
  display:flex;
  gap:8px;
  align-items:center;
}

/* Tooltip dot (same feel as old Sales Tip) */
.sgSS__tip{
  position:relative;
  display:inline-flex;
  width:18px;
  height:18px;
  border-radius:999px;
  border:1px solid rgba(15,23,42,.12);
  background:rgba(255,255,255,.92);
  opacity:.86;
  flex:0 0 auto;
}
.sgSS__tip::before{
  content:"?";
  margin:auto;
  font-weight:1000;
  font-size:12px;
  opacity:.72;
}
.sgSS__tip:hover{ opacity:1; }
.sgSS__tip::after{
  content:attr(data-tip);
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  padding:8px 10px;
  border-radius:14px;
  border:1px solid rgba(15,23,42,.14);
  background:rgba(255,255,255,.98);
  box-shadow: 0 18px 40px rgba(15,23,42,.14);
  font-weight:900;
  font-size:12px;
  white-space:nowrap;
  opacity:0;
  pointer-events:none;
  transition:opacity .12s ease;
  z-index:9999;
  bottom: calc(100% + 10px);
}
.sgSS__tip:hover::after{ opacity:1; }

.sgSS.is-dense .sgSS__tile{ padding:10px 10px; }
.sgSS.is-dense .sgSS__v{ font-size:18px; }

.sgSS__footer{
  margin-top:10px;
}
      `}</style>

      {(title || subtitle || right) ? (
        <div className="sgSS__head">
          <div>
            {title ? <div className="sgSS__title">{title}</div> : null}
            {subtitle ? <div className="sgSS__sub">{subtitle}</div> : null}
          </div>
          {right ? <div className="sgSS__right">{right}</div> : null}
        </div>
      ) : null}

      <div className="sgSS__grid" style={{ ['--ss-cols' as any]: cols }}>
        {items.map((it) => (
          <div key={it.key} className={`sgSS__tile ${tileToneCls(it.tone)}`}>
            <div className="sgSS__tileRight">
              {it.right}
            </div>

            <div className="sgSS__k">
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {it.label}
              </span>
              {it.hint ? <TipDot text={it.hint} /> : null}
            </div>

            <div className="sgSS__v">
              {loading ? '—' : it.value}
            </div>

            <div className="sgSS__s">
              {loading ? <ShimmerLine w={62} /> : (it.sub ?? null)}
            </div>
          </div>
        ))}
      </div>

      {footer ? <div className="sgSS__footer">{footer}</div> : null}
    </div>
  );
}

export default SgSectionSummary;
