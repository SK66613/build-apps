import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input, Button } from '../components/ui';

type CustomerLite = {
  id: string;            // internal id
  tg_id?: string;
  name?: string;
  username?: string;
  phone?: string;
  avatar?: string;       // url optional
  last_seen?: string;
  created_at?: string;

  coins?: number;
  level?: string;        // Bronze/Silver/Gold
  tags?: string[];
};

type CustomerProfile = {
  ok: true;
  customer: CustomerLite & {
    bio?: string;
    city?: string;
    birthday?: string;
    language?: string;

    totals?: {
      sales_sum?: number;
      sales_cnt?: number;
      cashback_sum?: number;
      wheel_wins?: number;
      passport_completed?: number;
      referrals?: number;
    };
  };

  timeline?: Array<{ ts: string; type: string; title: string; meta?: any }>;
  sales?: Array<{ ts: string; amount: number; coins: number; cashier?: string }>;
  loyalty?: Array<{ ts: string; delta: number; reason: string }>;
  passports?: Array<{ ts: string; passport: string; progress: string; reward?: string }>;
  messages?: Array<{ ts: string; direction: 'out'|'in'; text: string; status?: string }>;
  notes?: Array<{ ts: string; text: string; by?: string }>;
};

function qs(obj: Record<string, any>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj || {})){
    if (v === undefined || v === null || String(v) === '') continue;
    p.set(k, String(v));
  }
  return p.toString();
}

function fmtMoney(n: any){
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  return x.toFixed(0);
}
function fmtInt(n:any){
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  return String(Math.trunc(x));
}

export default function Customers(){
  const { appId, range } = useAppState() as any;
  const qc = useQueryClient();

  const [q, setQ] = React.useState('');
  const [seg, setSeg] = React.useState<'all'|'vip'|'new'|'inactive'|'debt'>('all');

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [profileTab, setProfileTab] = React.useState<
    'timeline'|'loyalty'|'sales'|'passport'|'messages'|'notes'|'admin'
  >('timeline');

  // right actions drawers
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [composeText, setComposeText] = React.useState('');
  const [noteText, setNoteText] = React.useState('');
  const [coinsDelta, setCoinsDelta] = React.useState('10');

  const qList = useQuery({
    enabled: !!appId,
    queryKey: ['customers', appId, seg, q],
    queryFn: () => apiFetch<{ ok: true; items: CustomerLite[] }>(
      `/api/cabinet/apps/${appId}/customers?${qs({ seg, q })}`
    ),
    staleTime: 10_000,
  });

  const list = qList.data?.items || [];

  // auto select first
  React.useEffect(() => {
    if (!selectedId && list.length) setSelectedId(list[0].id);
  }, [list.length]); // eslint-disable-line

  const qProfile = useQuery({
    enabled: !!appId && !!selectedId,
    queryKey: ['customer', appId, selectedId, profileTab, range?.from, range?.to],
    queryFn: () => apiFetch<CustomerProfile>(
      `/api/cabinet/apps/${appId}/customers/${selectedId}?${qs({ tab: profileTab, from: range?.from, to: range?.to })}`
    ),
    staleTime: 5_000,
  });

  const customer = qProfile.data?.customer;

  async function sendMessage(){
    if (!appId || !selectedId || !composeText.trim()) return;
    await apiFetch(`/api/cabinet/apps/${appId}/customers/${selectedId}/message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: composeText.trim() }),
    });
    setComposeText('');
    setComposeOpen(false);
    await qc.invalidateQueries({ queryKey: ['customer', appId, selectedId] });
  }

  async function addNote(){
    if (!appId || !selectedId || !noteText.trim()) return;
    await apiFetch(`/api/cabinet/apps/${appId}/customers/${selectedId}/note`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: noteText.trim() }),
    });
    setNoteText('');
    await qc.invalidateQueries({ queryKey: ['customer', appId, selectedId] });
  }

  async function adjustCoins(sign: 1|-1){
    if (!appId || !selectedId) return;
    const v = Math.max(0, Math.trunc(Number(coinsDelta) || 0));
    if (!v) return;
    await apiFetch(`/api/cabinet/apps/${appId}/customers/${selectedId}/coins`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ delta: sign * v }),
    });
    await qc.invalidateQueries({ queryKey: ['customer', appId, selectedId] });
    await qc.invalidateQueries({ queryKey: ['customers', appId] });
  }

  return (
    <div className="sg-page cuPage">
      {/* Header */}
      <div className="cuHead">
        <div>
          <h1 className="sg-h1">Customers</h1>
          <div className="sg-sub">Профили как в соцсети: карточка, лента событий, монеты, продажи, сообщения.</div>
        </div>

        <div className="cuHeadRight">
          <div className="cuSearch">
            <Input
              value={q}
              onChange={(e:any)=>setQ(e.target.value)}
              placeholder="Поиск: имя / @username / tg_id / телефон…"
            />
          </div>

          <div className="sg-tabs cuSegTabs">
            <button className={'sg-tab ' + (seg==='all'?'is-active':'')} onClick={()=>setSeg('all')}>All</button>
            <button className={'sg-tab ' + (seg==='vip'?'is-active':'')} onClick={()=>setSeg('vip')}>VIP</button>
            <button className={'sg-tab ' + (seg==='new'?'is-active':'')} onClick={()=>setSeg('new')}>New</button>
            <button className={'sg-tab ' + (seg==='inactive'?'is-active':'')} onClick={()=>setSeg('inactive')}>Inactive</button>
            <button className={'sg-tab ' + (seg==='debt'?'is-active':'')} onClick={()=>setSeg('debt')}>Debt</button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="cuGrid">
        {/* LEFT: list */}
        <div className="cuLeft">
          <Card className="cuCard cuStickyList">
            <div className="cuCardHead">
              <div className="cuCardTitle">People</div>
              <div className="cuCardSub">{list.length ? `${list.length} найдено` : '—'}</div>
            </div>

            <div className="cuList">
              {qList.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qList.isError && <div className="sg-muted">Ошибка: {(qList.error as Error).message}</div>}

              {!qList.isLoading && !list.length && (
                <div className="sg-muted">Ничего не найдено.</div>
              )}

              {list.map((u) => {
                const active = selectedId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={'cuRow ' + (active ? 'is-active' : '')}
                    onClick={() => { setSelectedId(u.id); setProfileTab('timeline'); }}
                  >
                    <div className="cuAvatar">
                      {u.avatar ? <img src={u.avatar} alt="" /> : <div className="cuAvatarStub">{(u.name||'U').slice(0,1).toUpperCase()}</div>}
                    </div>

                    <div className="cuRowMid">
                      <div className="cuRowTop">
                        <div className="cuName">{u.name || 'Unnamed'}</div>
                        {!!u.coins && <div className="cuCoins">{fmtInt(u.coins)} 💠</div>}
                      </div>
                      <div className="cuMeta">
                        <span>{u.username ? '@'+u.username : (u.tg_id ? `tg:${u.tg_id}` : '—')}</span>
                        <span className="cuDot">•</span>
                        <span>{u.last_seen || '—'}</span>
                      </div>
                      {!!u.tags?.length && (
                        <div className="cuTags">
                          {u.tags.slice(0,3).map(t => <span className="cuTag" key={t}>{t}</span>)}
                        </div>
                      )}
                    </div>

                    <div className="cuRowRight">
                      <span className={'cuBadge ' + ((u.level||'') ? 'ok' : 'mid')}>
                        {u.level || '—'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* RIGHT: profile (social-like) */}
        <div className="cuRight">
          <Card className="cuCard cuStickyProfile">
            {/* Cover */}
            <div className="cuCover">
              <div className="cuCoverGlow" />
              <div className="cuCoverInner">
                <div className="cuBigAvatar">
                  {customer?.avatar
                    ? <img src={customer.avatar} alt="" />
                    : <div className="cuBigAvatarStub">{(customer?.name||'U').slice(0,1).toUpperCase()}</div>}
                </div>

                <div className="cuIdentity">
                  <div className="cuIdentityTop">
                    <div className="cuTitle">{customer?.name || 'Выбери клиента'}</div>
                    <div className="cuBadges">
                      {customer?.level && <span className="cuPill cuPill--vip">{customer.level}</span>}
                      {customer?.tg_id && <span className="cuPill">tg:{customer.tg_id}</span>}
                      {customer?.username && <span className="cuPill">@{customer.username}</span>}
                    </div>
                  </div>
                  <div className="cuBio sg-muted">
                    {customer?.bio || 'Профиль клиента + быстрые действия + лента событий.'}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="cuActions">
                  <Button variant="secondary" disabled={!customer} onClick={()=>setComposeOpen(true)}>Message</Button>

                  <div className="cuCoinsCtl">
                    <Input value={coinsDelta} onChange={(e:any)=>setCoinsDelta(e.target.value)} placeholder="монеты" />
                    <Button variant="secondary" disabled={!customer} onClick={()=>adjustCoins(1)}>+ </Button>
                    <Button variant="secondary" disabled={!customer} onClick={()=>adjustCoins(-1)}>-</Button>
                  </div>

                  <Button variant="secondary" disabled={!customer}>Invoice</Button>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="cuKpis">
              <div className="cuKpi">
                <div className="cuKpiLbl">Coins</div>
                <div className="cuKpiVal">{fmtInt(customer?.coins || 0)}</div>
              </div>
              <div className="cuKpi">
                <div className="cuKpiLbl">Sales</div>
                <div className="cuKpiVal">{fmtInt(customer?.totals?.sales_cnt || 0)}</div>
              </div>
              <div className="cuKpi">
                <div className="cuKpiLbl">Revenue</div>
                <div className="cuKpiVal">{fmtMoney(customer?.totals?.sales_sum || 0)}</div>
              </div>
              <div className="cuKpi">
                <div className="cuKpiLbl">Referrals</div>
                <div className="cuKpiVal">{fmtInt(customer?.totals?.referrals || 0)}</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="cuTabs">
              <div className="sg-tabs cuTabsSeg">
                <button className={'sg-tab ' + (profileTab==='timeline'?'is-active':'')} onClick={()=>setProfileTab('timeline')}>Timeline</button>
                <button className={'sg-tab ' + (profileTab==='loyalty'?'is-active':'')} onClick={()=>setProfileTab('loyalty')}>Loyalty</button>
                <button className={'sg-tab ' + (profileTab==='sales'?'is-active':'')} onClick={()=>setProfileTab('sales')}>Sales</button>
                <button className={'sg-tab ' + (profileTab==='passport'?'is-active':'')} onClick={()=>setProfileTab('passport')}>Passport</button>
                <button className={'sg-tab ' + (profileTab==='messages'?'is-active':'')} onClick={()=>setProfileTab('messages')}>Messages</button>
                <button className={'sg-tab ' + (profileTab==='notes'?'is-active':'')} onClick={()=>setProfileTab('notes')}>Notes</button>
                <button className={'sg-tab ' + (profileTab==='admin'?'is-active':'')} onClick={()=>setProfileTab('admin')}>Admin</button>
              </div>
            </div>

            {/* Body */}
            <div className="cuBody">
              {qProfile.isLoading && <div className="sg-muted">Загрузка профиля…</div>}
              {qProfile.isError && <div className="sg-muted">Ошибка: {(qProfile.error as Error).message}</div>}

              {!qProfile.isLoading && !qProfile.isError && customer && (
                <>
                  {profileTab === 'timeline' && (
                    <div className="cuFeed">
                      {(qProfile.data?.timeline || []).slice(0, 30).map((e, i) => (
                        <div className="cuPost" key={i}>
                          <div className="cuPostDot" />
                          <div className="cuPostMain">
                            <div className="cuPostTitle">{e.title}</div>
                            <div className="cuPostMeta sg-muted">{e.type} • {e.ts}</div>
                          </div>
                        </div>
                      ))}
                      {!(qProfile.data?.timeline||[]).length && <div className="sg-muted">Пока нет событий.</div>}
                    </div>
                  )}

                  {profileTab === 'sales' && (
                    <div className="cuList2">
                      {(qProfile.data?.sales || []).slice(0, 50).map((s, i) => (
                        <div className="cuRow2" key={i}>
                          <div className="cuRow2Left">
                            <div className="cuRow2Title">Sale</div>
                            <div className="cuRow2Meta sg-muted">{s.ts} • cashier: {s.cashier || '—'}</div>
                          </div>
                          <div className="cuRow2Right">
                            <div className="cuRow2Val">{fmtMoney(s.amount)}</div>
                            <div className="cuRow2Sub sg-muted">+{fmtInt(s.coins)} 💠</div>
                          </div>
                        </div>
                      ))}
                      {!(qProfile.data?.sales||[]).length && <div className="sg-muted">Продаж нет.</div>}
                    </div>
                  )}

                  {profileTab === 'loyalty' && (
                    <div className="cuList2">
                      {(qProfile.data?.loyalty || []).slice(0, 60).map((x, i) => (
                        <div className="cuRow2" key={i}>
                          <div className="cuRow2Left">
                            <div className="cuRow2Title">{x.reason}</div>
                            <div className="cuRow2Meta sg-muted">{x.ts}</div>
                          </div>
                          <div className="cuRow2Right">
                            <div className={'cuDelta ' + (x.delta >= 0 ? 'pos' : 'neg')}>
                              {x.delta >= 0 ? '+' : ''}{fmtInt(x.delta)}
                            </div>
                          </div>
                        </div>
                      ))}
                      {!(qProfile.data?.loyalty||[]).length && <div className="sg-muted">Движений монет нет.</div>}
                    </div>
                  )}

                  {profileTab === 'passport' && (
                    <div className="cuList2">
                      {(qProfile.data?.passports || []).slice(0, 30).map((p, i) => (
                        <div className="cuRow2" key={i}>
                          <div className="cuRow2Left">
                            <div className="cuRow2Title">{p.passport}</div>
                            <div className="cuRow2Meta sg-muted">{p.ts} • {p.progress}</div>
                          </div>
                          <div className="cuRow2Right">
                            <span className="cuBadge ok">{p.reward ? 'reward' : 'in progress'}</span>
                          </div>
                        </div>
                      ))}
                      {!(qProfile.data?.passports||[]).length && <div className="sg-muted">Паспортов нет.</div>}
                    </div>
                  )}

                  {profileTab === 'messages' && (
                    <div className="cuChat">
                      {(qProfile.data?.messages || []).slice(-40).map((m, i) => (
                        <div className={'cuMsg ' + (m.direction === 'out' ? 'is-out' : 'is-in')} key={i}>
                          <div className="cuMsgBubble">
                            <div className="cuMsgText">{m.text}</div>
                            <div className="cuMsgMeta sg-muted">{m.ts}{m.status ? ` • ${m.status}` : ''}</div>
                          </div>
                        </div>
                      ))}
                      {!(qProfile.data?.messages||[]).length && <div className="sg-muted">Сообщений нет.</div>}
                    </div>
                  )}

                  {profileTab === 'notes' && (
                    <div className="cuNotes">
                      <div className="cuNoteComposer">
                        <textarea
                          className="cuTextarea"
                          value={noteText}
                          onChange={(e:any)=>setNoteText(e.target.value)}
                          placeholder="Заметка менеджера…"
                        />
                        <div className="cuNoteActions">
                          <Button variant="primary" onClick={addNote} disabled={!noteText.trim()}>Add note</Button>
                        </div>
                      </div>

                      <div className="cuList2">
                        {(qProfile.data?.notes || []).slice(0, 50).map((n, i) => (
                          <div className="cuNote" key={i}>
                            <div className="cuNoteText">{n.text}</div>
                            <div className="cuNoteMeta sg-muted">{n.ts}{n.by ? ` • ${n.by}` : ''}</div>
                          </div>
                        ))}
                        {!(qProfile.data?.notes||[]).length && <div className="sg-muted">Заметок нет.</div>}
                      </div>
                    </div>
                  )}

                  {profileTab === 'admin' && (
                    <div className="cuAdmin">
                      <div className="cuAdminGrid">
                        <Card className="cuMiniCard">
                          <div className="cuMiniTitle">Actions</div>
                          <div className="cuMiniBody">
                            <Button variant="secondary" disabled>Ban / Unban</Button>
                            <Button variant="secondary" disabled>Reset QR</Button>
                            <Button variant="secondary" disabled>Export</Button>
                          </div>
                        </Card>

                        <Card className="cuMiniCard">
                          <div className="cuMiniTitle">Identity</div>
                          <div className="cuMiniBody">
                            <div className="cuKV"><span className="sg-muted">tg_id</span><b>{customer.tg_id || '—'}</b></div>
                            <div className="cuKV"><span className="sg-muted">username</span><b>{customer.username ? '@'+customer.username : '—'}</b></div>
                            <div className="cuKV"><span className="sg-muted">created</span><b>{customer.created_at || '—'}</b></div>
                            <div className="cuKV"><span className="sg-muted">last_seen</span><b>{customer.last_seen || '—'}</b></div>
                          </div>
                        </Card>
                      </div>

                      <div className="sg-muted" style={{ marginTop: 10 }}>
                        Тут потом: ручной сегмент/теги, история PIN, привязка реферала, фрод-флаги.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Composer modal (simple inline) */}
      {composeOpen && (
        <div className="cuModalOverlay" onMouseDown={()=>setComposeOpen(false)}>
          <div className="cuModal" onMouseDown={(e)=>e.stopPropagation()}>
            <div className="cuModalHead">
              <div className="cuModalTitle">Message</div>
              <button className="cuX" onClick={()=>setComposeOpen(false)} type="button">✕</button>
            </div>
            <textarea
              className="cuTextarea"
              value={composeText}
              onChange={(e:any)=>setComposeText(e.target.value)}
              placeholder="Текст сообщения…"
            />
            <div className="cuModalActions">
              <Button variant="secondary" onClick={()=>setComposeOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={sendMessage} disabled={!composeText.trim()}>Send</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
