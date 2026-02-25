// sg-cabinet-react/src/components/sgp/sections/SgBoostCard.tsx
import React from 'react';

import {
  SgCard,
  SgCardHeader,
  SgCardTitle,
  SgCardSub,
  SgCardContent,
  SgCardFooter,
} from '../ui/SgCard';

import { SgToggle } from '../ui/SgToggle';
import { SgInput, SgSelect } from '../ui/SgInput';
import { SgActions, type SgSaveState } from '../ui/SgActions';
import { IconBtn } from '../IconBtn';

type BoostTriggerType = 'inactivity' | 'unredeemed' | 'happy_hour' | 'purchase' | 'link';
type BoostRewardType = 'multiplier' | 'free_spins' | 'discount' | 'coins';
type BoostChannel = 'push' | 'sms' | 'telegram' | 'email' | 'inapp';

export type BoostDraftRow = {
  enabled: boolean;

  trigger_type: BoostTriggerType;
  // inactivity: "3" (days), unredeemed: "24" (hours), happy_hour: "18:00-20:00", link: "BOOST_X3"
  trigger_value: string;

  reward_type: BoostRewardType;
  reward_value: string; // "2" (x2), "1" (1 spin), "20" (-20%), "100" (+100 coins)
  ttl_hours: string; // "24"

  cooldown_days: string; // "7"
  max_per_week: string; // "1"

  channel: BoostChannel;

  title: string;
  message: string;

  promo_code: string; // "X3" (optional)
};

type BoostStats = {
  activeCount: number;
  pausedCount: number;
  fired7d: number;
  errors7d: number;
};

type Props<T> = {
  title?: string;
  sub?: React.ReactNode;

  // collapse of whole card
  open: boolean;
  onToggleOpen: () => void;

  // list
  items: T[];
  getId: (row: T) => string;
  getName: (row: T) => string;

  // short lines (summary in row columns)
  getTriggerLine: (row: T, draft: BoostDraftRow) => React.ReactNode;
  getRewardLine: (row: T, draft: BoostDraftRow) => React.ReactNode;

  // draft source of truth (outside)
  draft: Record<string, BoostDraftRow>;
  patchDraft: (id: string, patch: Partial<BoostDraftRow>) => void;

  // header pills
  stats: BoostStats;

  // hint / footer
  saveMsg?: string;
  saveState: SgSaveState;
  onSave: () => void;

  // optional
  isLoading?: boolean;
  footerLeft?: React.ReactNode;
};

function toIntStr(v: any, fallback = '0') {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return fallback;
  return String(Math.max(0, Math.trunc(n)));
}

function rewardLabel(t: BoostRewardType) {
  if (t === 'multiplier') return 'Множитель';
  if (t === 'free_spins') return 'Бесплатные спины';
  if (t === 'discount') return 'Скидка';
  return 'Монеты';
}

function channelLabel(c: BoostChannel) {
  if (c === 'push') return 'Push';
  if (c === 'sms') return 'SMS';
  if (c === 'telegram') return 'Telegram';
  if (c === 'email') return 'Email';
  return 'In-app';
}

function triggerLabel(t: BoostTriggerType) {
  if (t === 'inactivity') return 'Не крутил N дней';
  if (t === 'unredeemed') return 'Не забрал приз N часов';
  if (t === 'happy_hour') return 'Счастливый час (HH:MM-HH:MM)';
  if (t === 'purchase') return 'Покупка/пополнение';
  return 'Активация по ссылке';
}

function defaultDraft(): BoostDraftRow {
  return {
    enabled: false,
    trigger_type: 'inactivity',
    trigger_value: '3',
    reward_type: 'multiplier',
    reward_value: '2',
    ttl_hours: '24',
    cooldown_days: '7',
    max_per_week: '1',
    channel: 'push',
    title: 'Скучали 😎',
    message: 'Давно не виделись! Вернись в колесо — сегодня x2 на монеты (24ч).',
    promo_code: 'X2',
  };
}

/**
 * SgBoostCard
 * - UI component for boosts rules
 * - data/save stays outside (draft/patchDraft/onSave)
 * - settings panel opens automatically when enabled=true
 * - you can still expand/collapse manually via row +/- button
 */
export function SgBoostCard<T>(props: Props<T>) {
  const {
    title = 'Буст',
    sub,

    open,
    onToggleOpen,

    items,
    getId,
    getName,
    getTriggerLine,
    getRewardLine,

    draft,
    patchDraft,

    stats,

    saveMsg,
    saveState,
    onSave,

    isLoading,
    footerLeft = <span className="sgp-muted">Меняются только правила бустов (триггер/награда/сообщение).</span>,
  } = props;

  // manual expand state; auto-open uses enabled
  const [rowOpen, setRowOpen] = React.useState<Record<string, boolean>>({});

  function toggleRow(id: string) {
    setRowOpen((m) => ({ ...m, [id]: !m[id] }));
  }

  function isRowOpen(id: string, enabled: boolean) {
    // if manually set — use it; otherwise auto-open when enabled
    if (rowOpen[id] !== undefined) return !!rowOpen[id];
    return !!enabled;
  }

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SgCardTitle>{title}</SgCardTitle>
            {sub ? <SgCardSub>{sub}</SgCardSub> : null}
          </div>

          <span className="sgp-pill">
            Активных: <b>{stats.activeCount}</b>
          </span>
          <span className="sgp-pill">
            Пауза: <b>{stats.pausedCount}</b>
          </span>
          <span className="sgp-pill">
            Сработало (7д): <b>{stats.fired7d}</b>
          </span>
          <span className="sgp-pill">
            Ошибок (7д): <b>{stats.errors7d}</b>
          </span>
        </div>
      </SgCardHeader>

      {open ? (
        <>
          <SgCardContent>
            {/* Head (reuse stock-like layout) */}
            <div className="sgp-stockHead">
              <div className="sgp-stockCol sgp-stockCol--name">Правило</div>
              <div className="sgp-stockCol">Вкл</div>
              <div className="sgp-stockCol">Триггер</div>
              <div className="sgp-stockCol">Награда</div>
              <div className="sgp-stockCol">Кулдаун</div>
            </div>

            <div className="sgp-stockList">
              {items.map((row, i) => {
                const id = getId(row) || String(i);
                const d: BoostDraftRow = draft[id] || defaultDraft();

                const enabled = !!d.enabled;
                const expanded = isRowOpen(id, enabled);
                const tone = enabled ? 'on' : 'off';

                return (
                  <div key={id} className={'sgp-stockRow tone-' + tone}>
                    {/* NAME + SETTINGS */}
                    <div className="sgp-stockCol sgp-stockCol--name" style={{ paddingLeft: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="sgp-stockName">{getName(row) || id}</div>
                          <div className="sgp-stockSub">
                            {channelLabel(d.channel)} · лимит: {toIntStr(d.max_per_week, '1')}/нед
                            {d.promo_code ? ` · промо: ${d.promo_code}` : ''}
                          </div>
                        </div>

                        <IconBtn
                          active={expanded}
                          onClick={() => toggleRow(id)}
                          title="Настроить"
                        >
                          {expanded ? '—' : '+'}
                        </IconBtn>
                      </div>

                      {expanded ? (
                        <div style={{ marginTop: 10 }}>
                          {/* aligned settings panel */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 12,
                              alignItems: 'start',
                            }}
                          >
                            {/* Trigger */}
                            <div>
                              <div className="sgp-muted" style={{ marginBottom: 6 }}>
                                Триггер
                              </div>

                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(140px, 1fr) minmax(120px, 1fr)',
                                  gap: 8,
                                }}
                              >
                                <SgSelect
                                  value={d.trigger_type}
                                  onChange={(e) =>
                                    patchDraft(id, { trigger_type: String((e.target as any).value) as any })
                                  }
                                >
                                  <option value="inactivity">{triggerLabel('inactivity')}</option>
                                  <option value="unredeemed">{triggerLabel('unredeemed')}</option>
                                  <option value="happy_hour">{triggerLabel('happy_hour')}</option>
                                  <option value="purchase">{triggerLabel('purchase')}</option>
                                  <option value="link">{triggerLabel('link')}</option>
                                </SgSelect>

                                <SgInput
                                  value={d.trigger_value}
                                  onChange={(e) => patchDraft(id, { trigger_value: (e.target as any).value })}
                                  placeholder="3 / 24 / 18:00-20:00 / BOOST_X3"
                                />
                              </div>

                              <div className="sgp-muted" style={{ marginTop: 6 }}>
                                Пример: inactivity=3; unredeemed=24; happy_hour=18:00-20:00; link=BOOST_X3
                              </div>
                            </div>

                            {/* Reward */}
                            <div>
                              <div className="sgp-muted" style={{ marginBottom: 6 }}>
                                Награда
                              </div>

                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(140px, 1fr) minmax(90px, 0.8fr) minmax(90px, 0.8fr)',
                                  gap: 8,
                                }}
                              >
                                <SgSelect
                                  value={d.reward_type}
                                  onChange={(e) =>
                                    patchDraft(id, { reward_type: String((e.target as any).value) as any })
                                  }
                                >
                                  <option value="multiplier">{rewardLabel('multiplier')}</option>
                                  <option value="free_spins">{rewardLabel('free_spins')}</option>
                                  <option value="discount">{rewardLabel('discount')}</option>
                                  <option value="coins">{rewardLabel('coins')}</option>
                                </SgSelect>

                                <SgInput
                                  value={d.reward_value}
                                  onChange={(e) => patchDraft(id, { reward_value: (e.target as any).value })}
                                  placeholder="2 / 1 / 20 / 100"
                                />

                                <SgInput
                                  value={d.ttl_hours}
                                  onChange={(e) => patchDraft(id, { ttl_hours: (e.target as any).value })}
                                  placeholder="TTL (ч)"
                                />
                              </div>

                              <div className="sgp-muted" style={{ marginTop: 6 }}>
                                multiplier=2 (x2), free_spins=1, discount=20 (%), coins=100 (шт)
                              </div>
                            </div>

                            {/* Limits */}
                            <div>
                              <div className="sgp-muted" style={{ marginBottom: 6 }}>
                                Ограничения
                              </div>

                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(90px, 1fr) minmax(90px, 1fr) minmax(120px, 1fr)',
                                  gap: 8,
                                }}
                              >
                                <SgInput
                                  value={d.cooldown_days}
                                  onChange={(e) => patchDraft(id, { cooldown_days: (e.target as any).value })}
                                  placeholder="Кулдаун (д)"
                                />
                                <SgInput
                                  value={d.max_per_week}
                                  onChange={(e) => patchDraft(id, { max_per_week: (e.target as any).value })}
                                  placeholder="Лимит/нед"
                                />
                                <SgSelect
                                  value={d.channel}
                                  onChange={(e) =>
                                    patchDraft(id, { channel: String((e.target as any).value) as any })
                                  }
                                >
                                  <option value="push">Push</option>
                                  <option value="inapp">In-app</option>
                                  <option value="telegram">Telegram</option>
                                  <option value="sms">SMS</option>
                                  <option value="email">Email</option>
                                </SgSelect>
                              </div>
                            </div>

                            {/* Message + preview */}
                            <div>
                              <div className="sgp-muted" style={{ marginBottom: 6 }}>
                                Сообщение
                              </div>

                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(140px, 1fr) minmax(120px, 0.8fr)',
                                  gap: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <SgInput
                                  value={d.title}
                                  onChange={(e) => patchDraft(id, { title: (e.target as any).value })}
                                  placeholder="Заголовок"
                                />
                                <SgInput
                                  value={d.promo_code}
                                  onChange={(e) => patchDraft(id, { promo_code: (e.target as any).value })}
                                  placeholder="Промо (опц)"
                                />
                              </div>

                              <SgInput
                                value={d.message}
                                onChange={(e) => patchDraft(id, { message: (e.target as any).value })}
                                placeholder="Текст сообщения"
                              />

                              <div style={{ marginTop: 10 }}>
                                <div className="sgp-muted" style={{ marginBottom: 6 }}>
                                  Превью
                                </div>
                                <div className="sgp-hint tone-neutral" style={{ whiteSpace: 'pre-wrap' as any }}>
                                  <b>{d.title || 'Boost'}</b>
                                  {'\n'}
                                  {d.message || '—'}
                                  {d.promo_code ? `\n\nПромо: ${d.promo_code}` : ''}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Enabled toggle (auto opens settings when turned on) */}
                    <div className="sgp-stockCol">
                      <SgToggle
                        checked={enabled}
                        onChange={(v) => {
                          patchDraft(id, { enabled: v });

                          // make settings appear immediately on enable (and hide on disable),
                          // also override manual state so it works "instantly"
                          setRowOpen((m) => ({ ...m, [id]: v }));
                        }}
                      />
                    </div>

                    {/* Trigger summary */}
                    <div className="sgp-stockCol">
                      <div className="sgp-muted">{getTriggerLine(row, d)}</div>
                    </div>

                    {/* Reward summary */}
                    <div className="sgp-stockCol">
                      <div className="sgp-muted">{getRewardLine(row, d)}</div>
                    </div>

                    {/* Cooldown */}
                    <div className="sgp-stockCol">
                      <div className="sgp-muted">{toIntStr(d.cooldown_days, '0')} дн</div>
                    </div>
                  </div>
                );
              })}

              {!items.length && !isLoading ? <div className="sgp-muted">Нет бустов.</div> : null}
            </div>

            <div style={{ marginTop: 12 }}>
              {saveMsg ? (
                <div className={`sgp-hint tone-${saveMsg.startsWith('Ошибка') ? 'bad' : 'warn'}`}>{saveMsg}</div>
              ) : (
                <div className="sgp-hint tone-neutral">
                  Подсказка: сначала сделаем правила/шаблоны. Воркера и спец-ссылки подключим позже.
                </div>
              )}
            </div>
          </SgCardContent>

          <SgCardFooter>
            <SgActions
              primaryLabel="Сохранить бусты"
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
