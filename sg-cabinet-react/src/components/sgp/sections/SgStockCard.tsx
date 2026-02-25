import React from 'react';

import {
  SgCard,
  SgCardHeader,
  SgCardTitle,
  SgCardContent,
  SgCardFooter,
} from '../ui/SgCard';

import { SgToggle } from '../ui/SgToggle';
import { SgInput } from '../ui/SgInput';
import { SgActions, type SgSaveState } from '../ui/SgActions';
import { IconBtn } from '../IconBtn';

type DraftRow = {
  active: boolean;
  track_qty: boolean;
  qty_left: string; // input text
  stop_when_zero: boolean;
};

type InventoryInfo = {
  trackedCount: number;
  outOfStockCount: number;
  lowStockCount: number;
  lowThreshold: number;
};

type Props<T> = {
  title?: string;

  // collapse
  open: boolean;
  onToggleOpen: () => void;

  // data
  items: T[];
  getCode: (row: T) => string;
  getTitle: (row: T) => string;

  // "coins/item" строчка под названием (ты сам решаешь)
  getSubline: (row: T) => React.ReactNode;

  // draft source of truth (снаружи)
  draft: Record<string, DraftRow>;
  patchDraft: (code: string, patch: Partial<DraftRow>) => void;

  // helpers for вычисления тона/остатка
  isLoading?: boolean;
  inventory: InventoryInfo;
  qtyLeft: (row: T) => number | null; // исходное qty из API (number|null)

  // hint / footer
  saveMsg?: string;
  saveState: SgSaveState;
  onSave: () => void;

  // footer left text
  footerLeft?: React.ReactNode;
};

function toInt(v: any, d = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.trunc(n);
}

/**
 * SgStockCard
 * - чисто UI-компонент склада (таблица + тумблеры + инпут остатка)
 * - все "данные/логика" остаются снаружи (draft/patch/save)
 * - стили НЕ трогаем, используем текущие классы
 */
export function SgStockCard<T>(props: Props<T>) {
  const {
    title = 'Склад',
    open,
    onToggleOpen,

    items,
    getCode,
    getTitle,
    getSubline,

    draft,
    patchDraft,

    isLoading,
    inventory,
    qtyLeft,

    saveMsg,
    saveState,
    onSave,

    footerLeft = <span className="sgp-muted">Меняется только склад (active/track/qty/auto-off).</span>,
  } = props;

  return (
    <SgCard>
      <SgCardHeader
        right={
          <IconBtn active={open} onClick={onToggleOpen} title="Свернуть/развернуть">
            {open ? '—' : '+'}
          </IconBtn>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SgCardTitle>{title}</SgCardTitle>

          <span className="sgp-pill">
            Учёт: <b>{inventory.trackedCount}</b>
          </span>

          <span className="sgp-pill">
            Закончились: <b>{inventory.outOfStockCount}</b>
          </span>

          <span className="sgp-pill">
            Мало (≤ {inventory.lowThreshold}): <b>{inventory.lowStockCount}</b>
          </span>
        </div>
      </SgCardHeader>

      {open ? (
        <>
          <SgCardContent>
            <div className="sgp-stockHead">
              <div className="sgp-stockCol sgp-stockCol--name">Название</div>
              <div className="sgp-stockCol">Активен</div>
              <div className="sgp-stockCol">Учёт</div>
              <div className="sgp-stockCol">Остаток</div>
              <div className="sgp-stockCol">Авто-выкл</div>
            </div>

            <div className="sgp-stockList">
              {items.map((row, i) => {
                const code = getCode(row) || String(i);
                const d = draft[code] || {
                  active: false,
                  track_qty: false,
                  qty_left: '',
                  stop_when_zero: false,
                };

                const active = !!d.active;
                const tracked = active && !!d.track_qty;

                const qRaw = String(d.qty_left ?? '').trim();
                const baseQty = qtyLeft(row) ?? 0;
                const qNum = tracked ? (qRaw === '' ? baseQty : Math.max(0, toInt(qRaw, 0))) : null;

                const out = tracked && (qNum !== null && qNum <= 0);
                const low = tracked && (qNum !== null && qNum > 0 && qNum <= inventory.lowThreshold);
                const swz = tracked && !!d.stop_when_zero;

                const tone = !active ? 'off' : (tracked ? (out ? 'out' : (low ? 'low' : 'on')) : 'on');

                return (
                  <div key={code} className={'sgp-stockRow tone-' + tone}>
                    <div className="sgp-stockCol sgp-stockCol--name">
                      <div className="sgp-stockName">{getTitle(row) || code}</div>
                      <div className="sgp-stockSub">{getSubline(row)}</div>

                      {out && swz ? (
                        <div className="sgp-stockHint is-bad">Закончились — приз не выпадает</div>
                      ) : null}

                      {!out && low ? (
                        <div className="sgp-stockHint is-warn">
                          Скоро закончатся (≤ {inventory.lowThreshold})
                        </div>
                      ) : null}
                    </div>

                    <div className="sgp-stockCol">
                      <SgToggle
                        checked={active}
                        onChange={(v) => {
                          if (!v) {
                            patchDraft(code, {
                              active: false,
                              track_qty: false,
                              stop_when_zero: false,
                              qty_left: '',
                            });
                            return;
                          }
                          patchDraft(code, { active: true });
                        }}
                      />
                    </div>

                    <div className="sgp-stockCol">
                      <SgToggle
                        checked={tracked}
                        disabled={!active}
                        onChange={(v) => {
                          if (!active) return;
                          if (!v) {
                            patchDraft(code, { track_qty: false, stop_when_zero: false, qty_left: '' });
                            return;
                          }
                          patchDraft(code, { track_qty: true });
                        }}
                      />
                    </div>

                    <div className="sgp-stockCol">
                      <SgInput
                        value={d.qty_left}
                        onChange={(e) => patchDraft(code, { qty_left: (e.target as any).value })}
                        placeholder={tracked ? '0' : '—'}
                        disabled={!tracked}
                      />
                    </div>

                    <div className="sgp-stockCol">
                      <SgToggle
                        checked={tracked && !!d.stop_when_zero}
                        disabled={!tracked}
                        onChange={(v) => {
                          if (!tracked) return;
                          patchDraft(code, { stop_when_zero: v });
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {!items.length && !isLoading ? <div className="sgp-muted">Нет данных.</div> : null}
            </div>

            <div style={{ marginTop: 12 }}>
              {saveMsg ? (
                <div className={`sgp-hint tone-${saveMsg.startsWith('Ошибка') ? 'bad' : 'warn'}`}>{saveMsg}</div>
              ) : (
                <div className="sgp-hint tone-neutral">
                  Подсказка: если “Учёт остатков” выключен — поля неактивны, это нормально.
                </div>
              )}
            </div>
          </SgCardContent>

          <SgCardFooter>
            <SgActions
              primaryLabel="Сохранить склад"
              onPrimary={onSave}
              state={saveState}
              errorText={saveMsg?.startsWith('Ошибка') ? saveMsg : undefined}
              left={footerLeft}
            />
          </SgCardFooter>
        </>
      ) : null}
    </SgCard>
  );
}
