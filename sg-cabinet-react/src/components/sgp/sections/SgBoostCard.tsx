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

function normalizeToggleValue(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (v && typeof v === 'object' && 'target' in v) return !!(v.target as any).checked;
  return !!v;
}

/* ---------- small layout helpers ---------- */

function Section(props: { title: string; hint?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="sgp-hint tone-neutral" style={{ padding: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700 }}>{props.title}</div>
            {props.hint ? <div className="sgp-muted">{props.hint}</div> : null}
          </div>
          {props.right ? <div>{props.right}</div> : null}
        </div>
        <div>{props.children}</div>
      </div>
    </div>
  );
}

function Grid(props: { cols: string; gap?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: props.cols,
        gap: props.gap ?? 8,
        alignItems: 'start',
      }}
    >
      {props.children}
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div className="sgp-muted">{props.label}</div>
      <div style={{ minWidth: 0 }}>{props.children}</div>
      {props.hint ? <div className="sgp-muted">{props.hint}</div> : null}
    </div>
  );
}

function SaveInlineButton(props: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        padding: '8px 12px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.18)',
        background: props.disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.10)',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
      title={props.disabled ? 'Сейчас нельзя сохранить' : 'Сохранить бусты'}
    >
      Сохранить
    </button>
  );
}

/**
 * SgBoostCard
 * - settings open ONLY by enabled toggle
 * - no manual +/- button
 * - row highlight enabled/disabled
 * - inline "Save" inside settings
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

  // best-effort: disable inline save only during active saving
  const savingNow = String(saveState).toLowerCase().includes('sav');

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

                // IMPORTANT: if draft[id] is missing, we still render defaults
                const base = defaultDraft();
                const current = draft[id];
                const d: BoostDraftRow = current ? { ...base, ...current } : base;

                const enabled = !!d.enabled;
                const expanded = enabled; // ✅ only toggle drives open/close
                const tone = enabled ? 'on' : 'off';

                const rowStyle: React.CSSProperties = enabled
                  ? {
                      borderLeft: '4px solid rgba(90, 220, 140, 0.9)',
                      background: 'rgba(90, 220, 140, 0.06)',
                    }
                  : {
                      borderLeft: '4px solid rgba(200, 200, 200, 0.35)',
                      background: 'rgba(255,255,255,0.03)',
                      opacity: 0.92,
                    };

                return (
                  <div key={id} className={'sgp-stockRow tone-' + tone} style={rowStyle}>
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
                      </div>

                      {expanded ? (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <Section
                              title="Триггер"
                              hint="inactivity=3 · unredeemed=24 · happy_hour=18:00-20:00 · link=BOOST_X3"
                              right={<SaveInlineButton onClick={onSave} disabled={savingNow} />}
                            >
                              <Grid cols="minmax(220px, 1fr) minmax(200px, 1fr)">
                                <Field label="Тип триггера">
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
                                </Field>

                                <Field label="Значение">
                                  <SgInput
                                    value={d.trigger_value}
                                    onChange={(e) => patchDraft(id, { trigger_value: (e.target as any).value })}
                                    placeholder="3 / 24 / 18:00-20:00 / BOOST_X3"
                                  />
                                </Field>
                              </Grid>
                            </Section>

                            <Section title="Награда" hint="multiplier=2 · free_spins=1 · discount=20% · coins=100">
                              <Grid cols="minmax(220px, 1fr) minmax(160px, 0.8fr) minmax(160px, 0.8fr)">
                                <Field label="Тип награды">
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
                                </Field>

                                <Field label="Значение">
                                  <SgInput
                                    value={d.reward_value}
                                    onChange={(e) => patchDraft(id, { reward_value: (e.target as any).value })}
                                    placeholder="2 / 1 / 20 / 100"
                                  />
                                </Field>

                                <Field label="TTL (ч)">
                                  <SgInput
                                    value={d.ttl_hours}
                                    onChange={(e) => patchDraft(id, { ttl_hours: (e.target as any).value })}
                                    placeholder="24"
                                  />
                                </Field>
                              </Grid>
                            </Section>

                            <Section title="Ограничения">
                              <Grid cols="minmax(180px, 1fr) minmax(180px, 1fr) minmax(220px, 1fr)">
                                <Field label="Кулдаун (д)">
                                  <SgInput
                                    value={d.cooldown_days}
                                    onChange={(e) => patchDraft(id, { cooldown_days: (e.target as any).value })}
                                    placeholder="7"
                                  />
                                </Field>

                                <Field label="Лимит / нед">
                                  <SgInput
                                    value={d.max_per_week}
                                    onChange={(e) => patchDraft(id, { max_per_week: (e.target as any).value })}
                                    placeholder="1"
                                  />
                                </Field>

                                <Field label="Канал">
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
                                </Field>
                              </Grid>
                            </Section>

                            <Section title="Сообщение и превью">
                              <Grid cols="minmax(260px, 1fr) minmax(260px, 1fr)" gap={12}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  <Grid cols="minmax(200px, 1fr) minmax(160px, 0.8fr)">
                                    <Field label="Заголовок">
                                      <SgInput
                                        value={d.title}
                                        onChange={(e) => patchDraft(id, { title: (e.target as any).value })}
                                        placeholder="Заголовок"
                                      />
                                    </Field>

                                    <Field label="Промо (опц.)">
                                      <SgInput
                                        value={d.promo_code}
                                        onChange={(e) => patchDraft(id, { promo_code: (e.target as any).value })}
                                        placeholder="X2"
                                      />
                                    </Field>
                                  </Grid>

                                  <Field label="Текст">
                                    <SgInput
                                      value={d.message}
                                      onChange={(e) => patchDraft(id, { message: (e.target as any).value })}
                                      placeholder="Текст сообщения"
                                    />
                                  </Field>

                                  {/* second save at bottom for convenience */}
                                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <SaveInlineButton onClick={onSave} disabled={savingNow} />
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <div className="sgp-muted">Превью</div>
                                  <div className="sgp-hint tone-neutral" style={{ whiteSpace: 'pre-wrap' as any }}>
                                    <b>{d.title || 'Boost'}</b>
                                    {'\n'}
                                    {d.message || '—'}
                                    {d.promo_code ? `\n\nПромо: ${d.promo_code}` : ''}
                                  </div>
                                </div>
                              </Grid>
                            </Section>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Enabled toggle (also materializes row in draft if missing) */}
                    <div className="sgp-stockCol">
                      <SgToggle
                        checked={enabled}
                        onChange={(v) => {
                          const nextEnabled = normalizeToggleValue(v);

                          // 🔥 Fix: if row does not exist in draft, create it first
                          if (!draft[id]) {
                            patchDraft(id, { ...defaultDraft(), enabled: nextEnabled });
                          } else {
                            patchDraft(id, { enabled: nextEnabled });
                          }
                        }}
                      />
                    </div>

                    <div className="sgp-stockCol">
                      <div className="sgp-muted">{getTriggerLine(row, d)}</div>
                    </div>

                    <div className="sgp-stockCol">
                      <div className="sgp-muted">{getRewardLine(row, d)}</div>
                    </div>

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
