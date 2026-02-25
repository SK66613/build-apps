import React from 'react';
import {
  SgCard,
  SgCardHeader,
  SgCardTitle,
  SgCardSub,
  SgCardContent,
  SgCardFooter,
} from '../ui/SgCard';
import { IconBtn } from '../IconBtn';

type Props = {
  title: React.ReactNode;
  sub?: React.ReactNode;

  /** Что справа в хедере: сегменты, иконки, бейджи и т.д. */
  right?: React.ReactNode;

  /** Контент карточки */
  children?: React.ReactNode;

  /** Футер карточки (например SgActions) */
  footer?: React.ReactNode;

  /** Collapsible */
  collapsible?: boolean;
  open?: boolean;
  onToggleOpen?: () => void;

  /** Если нужно выключить внутренние паддинги SgCardContent */
  contentStyle?: React.CSSProperties;

  /** Иногда удобно убрать контент вообще, если open=false */
  hideContentWhenClosed?: boolean;

  /** Доп. классы на карточку */
  className?: string;
};

export function SgSectionCard({
  title,
  sub,
  right,
  children,
  footer,

  collapsible,
  open = true,
  onToggleOpen,

  contentStyle,
  hideContentWhenClosed = true,
  className,
}: Props) {
  const showContent = !collapsible || open || !hideContentWhenClosed;

  return (
    <SgCard className={className}>
      <SgCardHeader
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {right}

            {collapsible ? (
              <IconBtn
                active={open}
                onClick={() => onToggleOpen?.()}
                title="Свернуть/развернуть"
              >
                {open ? '—' : '+'}
              </IconBtn>
            ) : null}
          </div>
        }
      >
        <div>
          <SgCardTitle>{title}</SgCardTitle>
          {sub ? <SgCardSub>{sub}</SgCardSub> : null}
        </div>
      </SgCardHeader>

      {showContent ? (
        <SgCardContent style={contentStyle}>{children}</SgCardContent>
      ) : null}

      {footer ? <SgCardFooter>{footer}</SgCardFooter> : null}
    </SgCard>
  );
}
