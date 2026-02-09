// src/pages/Customers.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';

/* =========================
   Types (минимально)
   ========================= */

type CustomerRow = {
  tg_id: string;
  name?: string;
  username?: string;
  phone?: string;
  avatar_url?: string;

  created_at?: string;
  last_seen_at?: string;

  coins_balance?: number;

  sales_total?: number;
  sales_count?: number;

  wheel_wins?: number;
  wheel_redeemed?: number;

  passport_done?: number;
  passport_goal?: number;

  flags?: {
    vip?: number;
    at_risk?: number;
    has_unredeemed?: number;
    new_user?: number;
  };
};

type CustomersListResp = {
  ok: true;
  items: CustomerRow[];
  next_cursor?: string | null;
};

type TimelineEvent = {
  ts: string;
  type: 'sale' | 'coins' | 'passport' | 'wheel' | 'message' | 'redeem' | 'system';
  title: string;
  meta?: Record<string, any>;
};

type CustomerProfileResp = {
  ok: true;
  customer: CustomerRow;
  stats?: {
    ltv?: number;
    avg_check?: number;
    visits_30d?: number;
    retention_tag?: 'new'|'active'|'at_risk'|'lost';
  };
  timeline?: TimelineEvent[];
  sales?: Array<{ ts: string; amount: number; cashback_coins?: number; cashier?: string }>;
  ledger?: Array<{ ts: string; delta: number; reason: string; actor?: string }>;
  messages?: Array<{ ts: string; text: string; status?: 'sent'|'failed'|'queued' }>;
};

/* =========================
   Utils
   ========================= */

function qs(obj: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}

function clampN(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function fmtNum(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  return x.toLocaleString('ru-RU');
}

function initials(name?: string) {
  const s = (name || '').trim();
  if (!s) return 'U';
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || 'U';
}

/* =========================
   Small UI primitives
   (чтобы не зависеть от либ)
   ========================= */

function SegTabs(props: {
  value: string;
  onChange: (v: string) => void;
  items: Array<{ key: string; label: React.ReactNode }>;
  className?: string;
}) {
  return (
    <div className={props.className || ''}>
      <div className="sg-tabs">
        {props.items.map(it => (
          <button
            key={it.key}
            type="button"
            className={'sg-tab' + (props.value === it.key ? ' is-active' : '')}
            onClick={() => props.onChange(it.key)}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pill(props: { children: React.ReactNode; tone?: 'muted'|'ok'|'warn'|'bad' }) {
  return <span className={'custPill ' + (props.tone ? `is-${props.tone}` : '')}>{props.children}</span>;
}

function Switch(props: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={'custSwitch' + (props.checked ? ' is-on' : '') + (props.disabled ? ' is-disabled' : '')}
      onClick={() => !props.disabled && props.onChange(!props.checked)}
      aria-pressed={props.checked}
    >
      <span className="custSwitchDot" />
    </button>
  );
}

/* =========================
   Page
   ========================= */

export default function Customers() {
  const { appId } = useAppState();
  const qc = useQueryClient();

  // top-level segments (вся страница)
  const [scope, setScope] = React.useState<'all'|'loyalty'|'sales'|'passport'|'wheel'|'messages'>('all');

  // list state
  const [q, setQ] = React.useState('');
  const [onlyActive, setOnlyActive] = React.useState(false);
  const [onlyVip, setOnlyVip] = React.useState(false);
  const [onlyAtRisk, setOnlyAtRisk] = React.useState(false);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // profile tabs
  const [tab, setTab] = React.useState<'overview'|'sales'|'loyalty'|'passport'|'wheel'|'messages'>('overview');

  // actions form (coins)
  const [coinsDelta, setCoinsDelta] = React.useState('10');
  const [coinsReason, setCoinsReason] = React.useState('manual_adjust');
  const [sending, setSending] = React.useState(false);
  const [actionMsg, setActionMsg] = React.useState<string>('');

  // ===== LIST QUERY
  const qList = useQuery({
    enabled: !!appId,
    queryKey: ['customers.list', appId, scope, q, onlyActive ? 1 : 0, onlyVip ? 1 : 0, onlyAtRisk ? 1 : 0],
    queryFn: () =>
      apiFetch<CustomersListResp>(
        `/api/cabinet/apps/${appId}/customers?${qs({
          scope,
          q,
          active: onlyActive ? 1 : 0,
          vip: onlyVip ? 1 : 0,
          at_risk: onlyAtRisk ? 1 : 0,
        })}`
      ),
    staleTime: 10_000,
  });

  const list = qList.data?.items || [];

  // автоселект первого, если ничего не выбрано
  React.useEffect(() => {
    if (!selectedId && list.length) setSelectedId(String(list[0].tg_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list?.length]);

  // ===== PROFILE QUERY
  const qProfile = useQuery({
    enabled: !!appId && !!selectedId,
    queryKey: ['customers.profile', appId, selectedId],
    queryFn: () => apiFetch<CustomerProfileResp>(`/api/cabinet/apps/${appId}/customers/${selectedId}`),
    staleTime: 8_000,
  });

  const profile = qProfile.data?.customer;
  const timeline = qProfile.data?.timeline || [];
  const sales = qProfile.data?.sales || [];
  const ledger = qProfile.data?.ledger || [];
  const msgs = qProfile.data?.messages || [];

  async function applyCoins() {
    if (!appId || !selectedId) return;
    setActionMsg('');
    const delta = clampN(parseInt(coinsDelta, 10), -1_000_000, 1_000_000);
    if (!delta) {
      setActionMsg('delta=0');
      return;
    }
    setSending(true);
    try {
      await apiFetch<{ ok: true }>(`/api/cabinet/apps/${appId}/customers/${selectedId}/coins`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ delta, reason: coinsReason }),
      });
      setActionMsg('Готово');
      await qc.invalidateQueries({ queryKey: ['customers.profile', appId, selectedId] });
      await qc.invalidateQueries({ queryKey: ['customers.list', appId] });
    } catch (e: any) {
      setActionMsg('Ошибка: ' + String(e?.message || e));
    } finally {
      setSending(false);
    }
  }

  /* =========================
     Render
     ========================= */

  return (
    <div className="custPage">
      {/* ===== HEADER (sticky) ===== */}
      <div className="custHeader">
        <div className="custTitle">
          <h1 className="sg-h1">Customers</h1>
          <div className="sg-sub">Поиск, профили, монеты, сообщения, история событий.</div>
        </div>

        <div className="custHeaderRight">
          <SegTabs
            value={scope}
            onChange={(v) => setScope(v as any)}
            items={[
              { key: 'all', label: 'All' },
              { key: 'loyalty', label: 'Loyalty' },
              { key: 'sales', label: 'Sales' },
              { key: 'passport', label: 'Passport' },
              { key: 'wheel', label: 'Wheel' },
              { key: 'messages', label: 'Messages' },
            ]}
          />

          <div className="custSearchRow">
            <Input
              value={q}
              onChange={(e: any) => setQ(e.target.value)}
              placeholder="Поиск: имя / @username / tg_id / телефон"
            />
          </div>
        </div>
      </div>

      {/* ===== GRID (list + profile) ===== */}
      <div className="custGrid">
        {/* ===== LEFT: LIST (sticky header inside) ===== */}
        <Card className="custListCard">
          <div className="custListHead">
            <div className="custListHeadRow">
              <div className="custListHeadTitle">
                Клиенты <span className="custCount">{fmtNum(list.length)}</span>
              </div>

              <div className="custFilters">
                <label className="custFilter">
                  <span>Active</span>
                  <Switch checked={onlyActive} onChange={setOnlyActive} />
                </label>
                <label className="custFilter">
                  <span>VIP</span>
                  <Switch checked={onlyVip} onChange={setOnlyVip} />
                </label>
                <label className="custFilter">
                  <span>Risk</span>
                  <Switch checked={onlyAtRisk} onChange={setOnlyAtRisk} />
                </label>
              </div>
            </div>

            {qList.isLoading && <div className="sg-muted">Загрузка…</div>}
            {qList.isError && <div className="sg-muted">Ошибка списка: {(qList.error as Error).message}</div>}
          </div>

          <div className="custList">
            {!qList.isLoading && !list.length && (
              <div className="custEmpty">
                <div className="custEmptyTitle">Пусто</div>
                <div className="custEmptySub">Попробуй другой фильтр или запрос.</div>
              </div>
            )}

            {list.map((c) => {
              const isSel = String(c.tg_id) === String(selectedId);
              const vip = !!c.flags?.vip;
              const risk = !!c.flags?.at_risk;
              const unred = !!c.flags?.has_unredeemed;

              const progGoal = Math.max(0, Number(c.passport_goal) || 0);
              const progDone = Math.max(0, Number(c.passport_done) || 0);
              const progPct = progGoal ? Math.round((progDone / progGoal) * 100) : 0;

              return (
                <button
                  key={String(c.tg_id)}
                  type="button"
                  className={'custRow' + (isSel ? ' is-active' : '')}
                  onClick={() => setSelectedId(String(c.tg_id))}
                >
                  <div className="custAvatar">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" />
                    ) : (
                      <div className="custAvatarFallback">{initials(c.name)}</div>
                    )}
                  </div>

                  <div className="custRowMid">
                    <div className="custRowTop">
                      <div className="custName">
                        {c.name || '—'}
                        {c.username ? <span className="custUser">@{c.username}</span> : null}
                      </div>

                      <div className="custBadges">
                        {vip && <Pill tone="ok">VIP</Pill>}
                        {risk && <Pill tone="warn">At risk</Pill>}
                        {unred && <Pill tone="bad">Unredeemed</Pill>}
                      </div>
                    </div>

                    <div className="custRowMeta">
                      <span className="custMetaItem">Coins: <b>{fmtNum(c.coins_balance || 0)}</b></span>
                      <span className="custMetaDot">•</span>
                      <span className="custMetaItem">Sales: <b>{fmtNum(c.sales_count || 0)}</b></span>
                      <span className="custMetaDot">•</span>
                      <span className="custMetaItem">LTV: <b>{fmtNum(c.sales_total || 0)}</b></span>
                    </div>

                    <div className="custMiniBar" aria-hidden="true">
                      <div className="custMiniBarFill" style={{ width: `${Math.max(0, Math.min(100, progPct))}%` }} />
                    </div>
                  </div>

                  <div className="custRowRight">
                    <div className="custTiny">last</div>
                    <div className="custTinyVal">{c.last_seen_at || '—'}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* ===== RIGHT: PROFILE ===== */}
        <div className="custProfileCol">
          <Card className="custProfileCard">
            <div className="custProfileHead">
              <div className="custProfileHeadTop">
                <div className="custProfileWho">
                  <div className="custProfileName">{profile?.name || 'Выбери клиента'}</div>
                  <div className="custProfileSub">
                    {profile?.username ? <span>@{profile.username}</span> : <span className="sg-muted">tg_id: {selectedId || '—'}</span>}
                    <span className="custMetaDot">•</span>
                    <span className="sg-muted">last: {profile?.last_seen_at || '—'}</span>
                  </div>
                </div>

                <div className="custProfileActions">
                  <Button variant="primary" disabled={!profile}>Send message</Button>
                  <Button disabled={!profile}>Invoice</Button>
                  <Button disabled={!profile}>…</Button>
                </div>
              </div>

              {/* KPI tiles */}
              <div className="custKpiRow">
                <div className="custKpi">
                  <div className="custKpiLbl">Coins</div>
                  <div className="custKpiVal">{fmtNum(profile?.coins_balance || 0)}</div>
                </div>
                <div className="custKpi">
                  <div className="custKpiLbl">Sales</div>
                  <div className="custKpiVal">{fmtNum(profile?.sales_count || 0)}</div>
                </div>
                <div className="custKpi">
                  <div className="custKpiLbl">LTV</div>
                  <div className="custKpiVal">{fmtNum(profile?.sales_total || 0)}</div>
                </div>
              </div>

              {/* Profile tabs */}
              <div className="custProfileTabs">
                <SegTabs
                  value={tab}
                  onChange={(v) => setTab(v as any)}
                  items={[
                    { key: 'overview', label: 'Overview' },
                    { key: 'sales', label: 'Sales' },
                    { key: 'loyalty', label: 'Coins' },
                    { key: 'passport', label: 'Passport' },
                    { key: 'wheel', label: 'Wheel' },
                    { key: 'messages', label: 'Messages' },
                  ]}
                />
              </div>
            </div>

            <div className="custProfileBody">
              {qProfile.isLoading && <div className="sg-muted">Загрузка профиля…</div>}
              {qProfile.isError && <div className="sg-muted">Ошибка профиля: {(qProfile.error as Error).message}</div>}

              {/* ===== OVERVIEW ===== */}
              {!qProfile.isLoading && !qProfile.isError && tab === 'overview' && (
                <div className="custTwoCol">
                  <div className="custBlock">
                    <div className="custBlockTitle">Timeline</div>
                    <div className="custTimeline">
                      {timeline.slice(0, 30).map((e, i) => (
                        <div className="custEvent" key={i}>
                          <div className={'custEventDot t-' + e.type} />
                          <div className="custEventMid">
                            <div className="custEventTitle">{e.title}</div>
                            <div className="custEventMeta">{e.type}</div>
                          </div>
                          <div className="custEventTs">{e.ts}</div>
                        </div>
                      ))}
                      {!timeline.length && <div className="sg-muted">Событий нет</div>}
                    </div>
                  </div>

                  <div className="custBlock">
                    <div className="custBlockTitle">Quick actions</div>

                    <div className="custForm">
                      <div className="custFormRow">
                        <div className="custFormLbl">Coins delta</div>
                        <Input value={coinsDelta} onChange={(e: any) => setCoinsDelta(e.target.value)} placeholder="+10 / -5" />
                      </div>

                      <div className="custFormRow">
                        <div className="custFormLbl">Reason</div>
                        <Input value={coinsReason} onChange={(e: any) => setCoinsReason(e.target.value)} placeholder="manual_adjust" />
                      </div>

                      <div className="custFormActions">
                        {actionMsg && <div className="custActionMsg">{actionMsg}</div>}
                        <Button variant="primary" disabled={!profile || sending} onClick={applyCoins}>
                          {sending ? '...' : 'Apply'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== SALES ===== */}
              {!qProfile.isLoading && !qProfile.isError && tab === 'sales' && (
                <div className="custBlock">
                  <div className="custBlockTitle">Sales</div>
                  <div className="custTableWrap">
                    <table className="sg-table">
                      <thead>
                        <tr>
                          <th>ts</th>
                          <th>amount</th>
                          <th>cashback</th>
                          <th>cashier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((s, i) => (
                          <tr key={i}>
                            <td>{s.ts}</td>
                            <td><b>{fmtNum(s.amount)}</b></td>
                            <td>{fmtNum(s.cashback_coins || 0)}</td>
                            <td>{s.cashier || '—'}</td>
                          </tr>
                        ))}
                        {!sales.length && <tr><td colSpan={4} style={{ opacity: 0.7, padding: 14 }}>Нет продаж</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== COINS LEDGER ===== */}
              {!qProfile.isLoading && !qProfile.isError && tab === 'loyalty' && (
                <div className="custBlock">
                  <div className="custBlockTitle">Coins ledger</div>
                  <div className="custTableWrap">
                    <table className="sg-table">
                      <thead>
                        <tr>
                          <th>ts</th>
                          <th>delta</th>
                          <th>reason</th>
                          <th>actor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((l, i) => (
                          <tr key={i}>
                            <td>{l.ts}</td>
                            <td><b>{l.delta > 0 ? '+' : ''}{fmtNum(l.delta)}</b></td>
                            <td>{l.reason}</td>
                            <td>{l.actor || '—'}</td>
                          </tr>
                        ))}
                        {!ledger.length && <tr><td colSpan={4} style={{ opacity: 0.7, padding: 14 }}>Пока пусто</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== PASSPORT / WHEEL / MESSAGES (заглушки) ===== */}
              {!qProfile.isLoading && !qProfile.isError && tab === 'passport' && (
                <div className="custBlock">
                  <div className="custBlockTitle">Passport</div>
                  <div className="sg-muted">Сюда: прогресс, даты отметок, награды, “почти готов”.</div>
                </div>
              )}

              {!qProfile.isLoading && !qProfile.isError && tab === 'wheel' && (
                <div className="custBlock">
                  <div className="custBlockTitle">Wheel</div>
                  <div className="sg-muted">Сюда: spins/wins/redeems + последние призы.</div>
                </div>
              )}

              {!qProfile.isLoading && !qProfile.isError && tab === 'messages' && (
                <div className="custBlock">
                  <div className="custBlockTitle">Messages</div>
                  <div className="custTableWrap">
                    <table className="sg-table">
                      <thead>
                        <tr>
                          <th>ts</th>
                          <th>text</th>
                          <th>status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {msgs.map((m, i) => (
                          <tr key={i}>
                            <td>{m.ts}</td>
                            <td style={{ maxWidth: 520, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {m.text}
                            </td>
                            <td>{m.status || '—'}</td>
                          </tr>
                        ))}
                        {!msgs.length && <tr><td colSpan={3} style={{ opacity: 0.7, padding: 14 }}>Нет сообщений</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* ===== (optional) sticky helper sidebar for profile, if ты захочешь 3 колонки) ===== */}
        </div>
      </div>
    </div>
  );
}
