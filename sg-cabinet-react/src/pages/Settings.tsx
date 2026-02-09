// src/pages/Settings.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input, Button } from '../components/ui';

/**
 * Settings (Project-level)
 * - Left: sections (General / Bot / Design / Loyalty / Calendar / Sales / Referrals / Game / Broadcasts / Integrations / Access)
 * - Right sticky: "Status / Quick actions / Danger zone"
 *
 * Endpoints are placeholders. Replace with your worker routes.
 */

type KV = Record<string, any>;

function qs(obj: Record<string, any>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj || {})){
    if (v === undefined || v === null || String(v) === '') continue;
    p.set(k, String(v));
  }
  return p.toString();
}
function n(v:any){ const x = Number(v); return Number.isFinite(x) ? x : 0; }

type AppSettingsResponse = {
  ok: true;
  settings: {
    general: {
      app_name: string;
      public_id?: string;
      locale?: string;
      timezone?: string;
      currency?: string;
    };
    design: {
      theme: 'light'|'dark'|'auto';
      tokens: KV; // your figma tokens
    };
    bot: {
      bot_username?: string;
      bot_connected?: boolean;
      webhook_ok?: boolean;
      cashier_mode?: 'pins'|'scan'|'mixed';
    };
    loyalty: {
      coins_name?: string;
      cashback_percent?: number; // default cashback for sales
      min_purchase?: number;
      max_cashback?: number;
      expire_days?: number;
    };
    calendar: {
      enabled?: boolean;
      slot_minutes?: number;
      lead_minutes?: number;
      max_days_ahead?: number;
      notify_admin?: boolean;
    };
    referrals: {
      enabled?: boolean;
      reward_coins?: number;
      reward_after_purchase?: boolean;
    };
    game: {
      enabled?: boolean;
      coins_per_score?: number;
      tournaments?: boolean;
    };
    broadcasts: {
      enabled?: boolean;
      quiet_hours?: { from?: string; to?: string }; // "22:00".."09:00"
      freq_cap_24h?: number;
      default_utm?: string;
    };
    security: {
      allow_export?: boolean;
      staff_roles?: Array<{ tg_id: string; role: 'admin'|'cashier'|'viewer' }>;
    };
    integrations: {
      webhooks?: Array<{ id: string; url: string; enabled: boolean }>;
      analytics?: { pixel_id?: string; enabled?: boolean };
    };
  };
};

export default function Settings(){
  const { appId } = useAppState() as { appId?: string|number|null };
  const qc = useQueryClient();

  const [seg, setSeg] = React.useState<
    'general'|'bot'|'design'|'loyalty'|'calendar'|'sales'|'referrals'|'game'|'broadcasts'|'integrations'|'access'
  >('general');

  // local draft
  const [draft, setDraft] = React.useState<AppSettingsResponse['settings'] | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const qSettings = useQuery({
    enabled: !!appId,
    queryKey: ['settings', appId],
    queryFn: () => apiFetch<AppSettingsResponse>(`/api/cabinet/apps/${appId}/settings`),
    staleTime: 10_000,
  });

  React.useEffect(() => {
    if (qSettings.data?.settings){
      setDraft(qSettings.data.settings);
    }
  }, [qSettings.data?.settings]);

  function patch(path: string, value: any){
    // path like "general.app_name" or "loyalty.cashback_percent"
    setDraft((prev) => {
      if (!prev) return prev;
      const next: any = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i=0;i<parts.length-1;i++){
        const k = parts[i];
        if (cur[k] === undefined || cur[k] === null) cur[k] = {};
        cur = cur[k];
      }
      cur[parts[parts.length-1]] = value;
      return next;
    });
  }

  async function save(){
    if (!appId || !draft) return;
    setSaving(true);
    setMsg('');
    try{
      await apiFetch(`/api/cabinet/apps/${appId}/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings: draft }),
      });
      setMsg('Сохранено.');
      await qc.invalidateQueries({ queryKey: ['settings', appId] });
    }catch(e:any){
      setMsg('Ошибка: ' + String(e?.message || e));
    }finally{
      setSaving(false);
    }
  }

  // Right sticky status
  const botOk = !!qSettings.data?.settings?.bot?.bot_connected;
  const webhookOk = !!qSettings.data?.settings?.bot?.webhook_ok;

  return (
    <div className="sg-page stPage">
      <div className="stHead">
        <div>
          <h1 className="sg-h1">Settings</h1>
          <div className="sg-sub">Единые настройки проекта (все блоки).</div>
        </div>

        <div className="stHeadRight">
          {msg && <div className="stMsg">{msg}</div>}
          <Button variant="primary" disabled={!draft || saving || qSettings.isLoading || !appId} onClick={save}>
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </Button>
        </div>
      </div>

      <div className="stGrid">
        {/* LEFT */}
        <div className="stLeft">
          <div className="sg-tabs stSegTabs">
            <button className={'sg-tab ' + (seg==='general'?'is-active':'')} onClick={()=>setSeg('general')}>General</button>
            <button className={'sg-tab ' + (seg==='bot'?'is-active':'')} onClick={()=>setSeg('bot')}>Bot</button>
            <button className={'sg-tab ' + (seg==='design'?'is-active':'')} onClick={()=>setSeg('design')}>Design</button>
            <button className={'sg-tab ' + (seg==='loyalty'?'is-active':'')} onClick={()=>setSeg('loyalty')}>Loyalty</button>
            <button className={'sg-tab ' + (seg==='calendar'?'is-active':'')} onClick={()=>setSeg('calendar')}>Calendar</button>
            <button className={'sg-tab ' + (seg==='sales'?'is-active':'')} onClick={()=>setSeg('sales')}>Sales</button>
            <button className={'sg-tab ' + (seg==='referrals'?'is-active':'')} onClick={()=>setSeg('referrals')}>Referrals</button>
            <button className={'sg-tab ' + (seg==='game'?'is-active':'')} onClick={()=>setSeg('game')}>Game</button>
            <button className={'sg-tab ' + (seg==='broadcasts'?'is-active':'')} onClick={()=>setSeg('broadcasts')}>Broadcasts</button>
            <button className={'sg-tab ' + (seg==='integrations'?'is-active':'')} onClick={()=>setSeg('integrations')}>Integrations</button>
            <button className={'sg-tab ' + (seg==='access'?'is-active':'')} onClick={()=>setSeg('access')}>Access</button>
          </div>

          {/* ===== content */}
          {!draft && (
            <Card className="stCard">
              <div className="stCardTitle">Загрузка…</div>
              {qSettings.isError && <div className="sg-muted">Ошибка: {(qSettings.error as Error).message}</div>}
            </Card>
          )}

          {draft && seg === 'general' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">General</div>
                <div className="stCardSub">база проекта: имя, локаль, часовой пояс</div>
              </div>

              <div className="stForm">
                <div className="stRow">
                  <div className="stLbl">Название</div>
                  <Input value={draft.general.app_name || ''} onChange={(e:any)=>patch('general.app_name', e.target.value)} />
                </div>

                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Locale</div>
                    <Input value={draft.general.locale || 'ru'} onChange={(e:any)=>patch('general.locale', e.target.value)} />
                  </div>
                  <div className="stRow">
                    <div className="stLbl">Timezone</div>
                    <Input value={draft.general.timezone || 'Europe/Berlin'} onChange={(e:any)=>patch('general.timezone', e.target.value)} />
                  </div>
                </div>

                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Currency</div>
                    <Input value={draft.general.currency || 'EUR'} onChange={(e:any)=>patch('general.currency', e.target.value)} />
                  </div>
                  <div className="stRow">
                    <div className="stLbl">Public ID</div>
                    <Input value={draft.general.public_id || ''} onChange={(e:any)=>patch('general.public_id', e.target.value)} placeholder="app-two-zehe" />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {draft && seg === 'bot' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">Bot</div>
                <div className="stCardSub">интеграция кассира, вебхуки, режимы</div>
              </div>

              <div className="stForm">
                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Bot username</div>
                    <Input value={draft.bot.bot_username || ''} onChange={(e:any)=>patch('bot.bot_username', e.target.value)} placeholder="@your_bot" />
                  </div>

                  <div className="stRow">
                    <div className="stLbl">Cashier mode</div>
                    <div className="sg-tabs stMiniTabs">
                      {(['pins','scan','mixed'] as const).map(m => (
                        <button
                          key={m}
                          className={'sg-tab ' + (draft.bot.cashier_mode===m ? 'is-active' : '')}
                          onClick={()=>patch('bot.cashier_mode', m)}
                          type="button"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="stInfoGrid">
                  <div className="stInfoTile">
                    <div className="stInfoLbl">Connected</div>
                    <div className={'stInfoVal ' + (botOk ? 'ok' : 'bad')}>{botOk ? 'YES' : 'NO'}</div>
                  </div>
                  <div className="stInfoTile">
                    <div className="stInfoLbl">Webhook</div>
                    <div className={'stInfoVal ' + (webhookOk ? 'ok' : 'bad')}>{webhookOk ? 'OK' : 'FAIL'}</div>
                  </div>
                </div>

                <div className="stActionsRow">
                  <Button variant="secondary" disabled>Check webhook</Button>
                  <Button variant="secondary" disabled>Rotate secret</Button>
                  <Button variant="secondary" disabled>Open bot logs</Button>
                </div>
              </div>
            </Card>
          )}

          {draft && seg === 'design' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">Design</div>
                <div className="stCardSub">токены темы (как в Studio)</div>
              </div>

              <div className="stForm">
                <div className="stRow">
                  <div className="stLbl">Theme</div>
                  <div className="sg-tabs stMiniTabs">
                    {(['auto','light','dark'] as const).map(t => (
                      <button key={t} className={'sg-tab ' + (draft.design.theme===t?'is-active':'')} onClick={()=>patch('design.theme', t)} type="button">
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="stRow">
                  <div className="stLbl">Tokens (JSON)</div>
                  <textarea
                    className="stTextarea"
                    value={JSON.stringify(draft.design.tokens || {}, null, 2)}
                    onChange={(e:any) => {
                      try{
                        const v = JSON.parse(e.target.value || '{}');
                        patch('design.tokens', v);
                        setMsg('');
                      }catch{
                        setMsg('⚠️ Tokens JSON: ошибка парсинга');
                      }
                    }}
                  />
                  <div className="stHint sg-muted">Потом заменим на красивый token-editor как в Studio.</div>
                </div>
              </div>
            </Card>
          )}

          {draft && seg === 'loyalty' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">Loyalty</div>
                <div className="stCardSub">общие правила монет/кэшбэка для Sales/Passport/Wheel</div>
              </div>

              <div className="stForm">
                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Coins name</div>
                    <Input value={draft.loyalty.coins_name || 'Coins'} onChange={(e:any)=>patch('loyalty.coins_name', e.target.value)} />
                  </div>
                  <div className="stRow">
                    <div className="stLbl">Cashback %</div>
                    <Input value={String(draft.loyalty.cashback_percent ?? 5)} onChange={(e:any)=>patch('loyalty.cashback_percent', n(e.target.value))} />
                  </div>
                </div>

                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Min purchase</div>
                    <Input value={String(draft.loyalty.min_purchase ?? 0)} onChange={(e:any)=>patch('loyalty.min_purchase', n(e.target.value))} />
                  </div>
                  <div className="stRow">
                    <div className="stLbl">Max cashback</div>
                    <Input value={String(draft.loyalty.max_cashback ?? 0)} onChange={(e:any)=>patch('loyalty.max_cashback', n(e.target.value))} />
                  </div>
                </div>

                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Expire days</div>
                    <Input value={String(draft.loyalty.expire_days ?? 0)} onChange={(e:any)=>patch('loyalty.expire_days', n(e.target.value))} />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {draft && seg === 'calendar' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">Calendar</div>
                <div className="stCardSub">запись, слоты, правила отмены/переноса</div>
              </div>

              <div className="stForm">
                <div className="stRow">
                  <label className="stSwitch">
                    <input
                      type="checkbox"
                      checked={!!draft.calendar.enabled}
                      onChange={(e:any)=>patch('calendar.enabled', !!e.target.checked)}
                    />
                    <span className="stSwitchUi" />
                    <span className="stSwitchTxt">Enabled</span>
                  </label>
                </div>

                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Slot minutes</div>
                    <Input value={String(draft.calendar.slot_minutes ?? 30)} onChange={(e:any)=>patch('calendar.slot_minutes', n(e.target.value))} />
                  </div>
                  <div className="stRow">
                    <div className="stLbl">Lead minutes</div>
                    <Input value={String(draft.calendar.lead_minutes ?? 60)} onChange={(e:any)=>patch('calendar.lead_minutes', n(e.target.value))} />
                  </div>
                </div>

                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Max days ahead</div>
                    <Input value={String(draft.calendar.max_days_ahead ?? 30)} onChange={(e:any)=>patch('calendar.max_days_ahead', n(e.target.value))} />
                  </div>
                  <div className="stRow">
                    <label className="stSwitch">
                      <input
                        type="checkbox"
                        checked={!!draft.calendar.notify_admin}
                        onChange={(e:any)=>patch('calendar.notify_admin', !!e.target.checked)}
                      />
                      <span className="stSwitchUi" />
                      <span className="stSwitchTxt">Notify admin</span>
                    </label>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {draft && seg === 'sales' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">Sales</div>
                <div className="stCardSub">QR продажа → сумма → монеты (общая политика)</div>
              </div>

              <div className="stForm">
                <div className="stHint sg-muted">
                  Здесь будут: правила округления, антифрод, лимиты кассира, возвраты, чек/позиции.
                </div>
              </div>
            </Card>
          )}

          {draft && seg === 'referrals' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">Referrals</div>
                <div className="stCardSub">правила бонусов за приглашения</div>
              </div>

              <div className="stForm">
                <div className="stRow">
                  <label className="stSwitch">
                    <input
                      type="checkbox"
                      checked={!!draft.referrals.enabled}
                      onChange={(e:any)=>patch('referrals.enabled', !!e.target.checked)}
                    />
                    <span className="stSwitchUi" />
                    <span className="stSwitchTxt">Enabled</span>
                  </label>
                </div>

                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Reward coins</div>
                    <Input value={String(draft.referrals.reward_coins ?? 50)} onChange={(e:any)=>patch('referrals.reward_coins', n(e.target.value))} />
                  </div>
                  <div className="stRow">
                    <label className="stSwitch">
                      <input
                        type="checkbox"
                        checked={!!draft.referrals.reward_after_purchase}
                        onChange={(e:any)=>patch('referrals.reward_after_purchase', !!e.target.checked)}
                      />
                      <span className="stSwitchUi" />
                      <span className="stSwitchTxt">Only after first purchase</span>
                    </label>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {draft && seg === 'game' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">Game</div>
                <div className="stCardSub">монеты за очки + турниры</div>
              </div>

              <div className="stForm">
                <div className="stRow">
                  <label className="stSwitch">
                    <input
                      type="checkbox"
                      checked={!!draft.game.enabled}
                      onChange={(e:any)=>patch('game.enabled', !!e.target.checked)}
                    />
                    <span className="stSwitchUi" />
                    <span className="stSwitchTxt">Enabled</span>
                  </label>
                </div>

                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Coins per score</div>
                    <Input value={String(draft.game.coins_per_score ?? 0)} onChange={(e:any)=>patch('game.coins_per_score', n(e.target.value))} />
                  </div>
                  <div className="stRow">
                    <label className="stSwitch">
                      <input
                        type="checkbox"
                        checked={!!draft.game.tournaments}
                        onChange={(e:any)=>patch('game.tournaments', !!e.target.checked)}
                      />
                      <span className="stSwitchUi" />
                      <span className="stSwitchTxt">Tournaments</span>
                    </label>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {draft && seg === 'broadcasts' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">Broadcasts</div>
                <div className="stCardSub">лимиты, quiet hours, UTM</div>
              </div>

              <div className="stForm">
                <div className="stRow">
                  <label className="stSwitch">
                    <input
                      type="checkbox"
                      checked={!!draft.broadcasts.enabled}
                      onChange={(e:any)=>patch('broadcasts.enabled', !!e.target.checked)}
                    />
                    <span className="stSwitchUi" />
                    <span className="stSwitchTxt">Enabled</span>
                  </label>
                </div>

                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Quiet hours from</div>
                    <Input value={draft.broadcasts.quiet_hours?.from || '22:00'} onChange={(e:any)=>patch('broadcasts.quiet_hours.from', e.target.value)} />
                  </div>
                  <div className="stRow">
                    <div className="stLbl">to</div>
                    <Input value={draft.broadcasts.quiet_hours?.to || '09:00'} onChange={(e:any)=>patch('broadcasts.quiet_hours.to', e.target.value)} />
                  </div>
                </div>

                <div className="stRow2">
                  <div className="stRow">
                    <div className="stLbl">Freq cap / 24h</div>
                    <Input value={String(draft.broadcasts.freq_cap_24h ?? 2)} onChange={(e:any)=>patch('broadcasts.freq_cap_24h', n(e.target.value))} />
                  </div>
                  <div className="stRow">
                    <div className="stLbl">Default UTM</div>
                    <Input value={draft.broadcasts.default_utm || 'broadcast'} onChange={(e:any)=>patch('broadcasts.default_utm', e.target.value)} />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {draft && seg === 'integrations' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">Integrations</div>
                <div className="stCardSub">webhooks, analytics</div>
              </div>

              <div className="stForm">
                <div className="stHint sg-muted">TODO: список вебхуков + включить/выключить + добавить новый.</div>
                <div className="stHint sg-muted">TODO: аналитика (pixel_id), события: sale, booking, referral, wheel_claim, passport_redeem.</div>
              </div>
            </Card>
          )}

          {draft && seg === 'access' && (
            <Card className="stCard">
              <div className="stCardHead">
                <div className="stCardTitle">Access</div>
                <div className="stCardSub">роли, сотрудники, экспорт</div>
              </div>

              <div className="stForm">
                <div className="stRow">
                  <label className="stSwitch">
                    <input
                      type="checkbox"
                      checked={!!draft.security.allow_export}
                      onChange={(e:any)=>patch('security.allow_export', !!e.target.checked)}
                    />
                    <span className="stSwitchUi" />
                    <span className="stSwitchTxt">Allow export</span>
                  </label>
                </div>

                <div className="stHint sg-muted">
                  TODO: staff_roles (tg_id + role) + кнопки “invite cashier/admin”.
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT sticky */}
        <div className="stRight">
          <Card className="stCard stSticky">
            <div className="stCardHead">
              <div className="stCardTitle">Project status</div>
              <div className="stCardSub">быстрый чек-лист</div>
            </div>

            <div className="stStatus">
              <div className="stStatusRow">
                <span className="sg-muted">App</span>
                <b>{draft?.general?.app_name || '—'}</b>
              </div>
              <div className="stStatusRow">
                <span className="sg-muted">Bot</span>
                <span className={'stBadge ' + (botOk ? 'ok':'bad')}>{botOk ? 'connected' : 'not connected'}</span>
              </div>
              <div className="stStatusRow">
                <span className="sg-muted">Webhook</span>
                <span className={'stBadge ' + (webhookOk ? 'ok':'bad')}>{webhookOk ? 'ok' : 'fail'}</span>
              </div>
              <div className="stStatusRow">
                <span className="sg-muted">Calendar</span>
                <span className={'stBadge ' + (draft?.calendar?.enabled ? 'ok':'mid')}>{draft?.calendar?.enabled ? 'enabled' : 'off'}</span>
              </div>
              <div className="stStatusRow">
                <span className="sg-muted">Broadcasts</span>
                <span className={'stBadge ' + (draft?.broadcasts?.enabled ? 'ok':'mid')}>{draft?.broadcasts?.enabled ? 'enabled' : 'off'}</span>
              </div>
            </div>

            <div className="stQuick">
              <Button variant="secondary" disabled>Open runtime</Button>
              <Button variant="secondary" disabled>Open Studio</Button>
              <Button variant="secondary" disabled>Test bot flow</Button>
            </div>
          </Card>

          <Card className="stCard stSticky2">
            <div className="stCardHead">
              <div className="stCardTitle">Danger zone</div>
              <div className="stCardSub">аккуратно</div>
            </div>

            <div className="stDanger">
              <Button variant="secondary" disabled>Reset cache</Button>
              <Button variant="secondary" disabled>Rebuild assets</Button>
              <Button variant="secondary" disabled>Delete app</Button>
              <div className="stHint sg-muted">
                Тут позже: purge manifests, rotate secrets, migrate schema.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
