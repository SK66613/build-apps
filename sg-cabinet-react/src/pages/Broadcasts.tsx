// src/pages/Broadcasts.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input, Button } from '../components/ui';
import {
  ResponsiveContainer,
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

/**
 * Broadcasts / Campaigns page (premium-white, Wheel-like):
 * - Left: chart + KPI + under-chart Live/Alerts + main content by segments
 * - Right: sticky "Composer / Segment summary / Quick actions"
 *
 * Endpoints here are placeholders. Replace URLs with your worker routes.
 */

type Range = { from?: string; to?: string };

type CampaignStatus = 'draft'|'scheduled'|'sending'|'sent'|'paused'|'failed';

type Campaign = {
  id: number|string;
  title: string;
  channel: 'tg'|'push'|'email';
  status: CampaignStatus;
  created_at: string;
  scheduled_at?: string;
  sent_at?: string;
  audience?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  failed?: number;
};

type TrendPoint = {
  d: string; // date
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  revenue?: number;
};

type Kpi = {
  campaigns: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  unsubscribed: number;
};

type LiveItem = {
  ts: string;
  type: 'send'|'deliver'|'open'|'click'|'fail'|'unsubscribe'|'spam';
  label: string;
  campaign_id?: number|string;
};

type SegmentPreset = 'all'|'active_7d'|'active_30d'|'new_7d'|'vip'|'sleeping_30d'|'custom';

type SegmentRuleOp = 'eq'|'neq'|'gt'|'gte'|'lt'|'lte'|'in'|'contains';
type SegmentRuleField =
  | 'coins'
  | 'last_visit_days'
  | 'purchases_30d'
  | 'total_spend'
  | 'tags'
  | 'referrals'
  | 'language'
  | 'has_unclaimed_prize';

type SegmentRule = {
  id: string;
  field: SegmentRuleField;
  op: SegmentRuleOp;
  value: string;
};

function qs(obj: Record<string, any>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj || {})){
    if (v === undefined || v === null || String(v) === '') continue;
    p.set(k, String(v));
  }
  return p.toString();
}
function n(v:any){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function pct(a:number, b:number){ if (!b) return '0%'; return Math.round((a/b)*100) + '%'; }
function uid(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }

function IcoBar(){ return (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 13V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 13V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M13 13V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);}
function IcoLine(){ return (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);}
function IcoArea(){ return (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 11l4-4 3 3 5-6v10H2V11z" fill="currentColor" opacity="0.18"/>
    <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 14h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);}

function normPhoneOrTg(v: string){
  const s = (v || '').trim();
  if (!s) return '';
  return s.replace(/[^\d+]/g, '');
}

export default function Broadcasts(){
  const { appId, range } = useAppState() as { appId?: string|number|null; range: Range };
  const qc = useQueryClient();

  // ===== Segments (page sections)
  const [seg, setSeg] = React.useState<'overview'|'campaigns'|'composer'|'segments'|'templates'|'settings'>('overview');

  // ===== Chart controls
  const [chartType, setChartType] = React.useState<'area'|'line'|'bar'>('area');
  const [metric, setMetric] = React.useState<'sent'|'delivered'|'opened'|'clicked'>('delivered');

  // ===== Under-chart panel
  const [under, setUnder] = React.useState<'alerts'|'live'>('alerts');

  // ===== Filters
  const [q, setQ] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all'|CampaignStatus>('all');

  // ===== Composer state (right sticky)
  const [channel, setChannel] = React.useState<'tg'|'push'|'email'>('tg');
  const [title, setTitle] = React.useState('');
  const [subject, setSubject] = React.useState(''); // for email/push
  const [message, setMessage] = React.useState('');
  const [deepLink, setDeepLink] = React.useState(''); // e.g. tg start_param or miniapp page
  const [scheduleAt, setScheduleAt] = React.useState(''); // ISO-ish input
  const [testTo, setTestTo] = React.useState(''); // tg id / email
  const [utm, setUtm] = React.useState('broadcast');

  // Segment builder
  const [preset, setPreset] = React.useState<SegmentPreset>('active_30d');
  const [rules, setRules] = React.useState<SegmentRule[]>([
    { id: uid(), field:'last_visit_days', op:'lte', value:'30' },
  ]);

  // ===== Data (placeholders)
  const qKpi = useQuery({
    enabled: !!appId,
    queryKey: ['bc.kpi', appId, range?.from, range?.to],
    queryFn: () => apiFetch<{ ok:true; kpi: Kpi }>(`/api/cabinet/apps/${appId}/broadcasts/kpi?${qs(range)}`),
    staleTime: 10_000,
  });

  const qTrend = useQuery({
    enabled: !!appId,
    queryKey: ['bc.trend', appId, range?.from, range?.to],
    queryFn: () => apiFetch<{ ok:true; items: TrendPoint[] }>(`/api/cabinet/apps/${appId}/broadcasts/trend?${qs(range)}`),
    staleTime: 10_000,
  });

  const qCampaigns = useQuery({
    enabled: !!appId,
    queryKey: ['bc.campaigns', appId, range?.from, range?.to, q, statusFilter],
    queryFn: () => apiFetch<{ ok:true; items: Campaign[] }>(
      `/api/cabinet/apps/${appId}/broadcasts/campaigns?${qs({ ...range, q, status: statusFilter })}`
    ),
    staleTime: 10_000,
  });

  const qAudience = useQuery({
    enabled: !!appId,
    queryKey: ['bc.audience', appId, preset, JSON.stringify(rules)],
    queryFn: () => apiFetch<{ ok:true; audience: number; sample?: Array<{ tg?: string; name?: string }> }>(
      `/api/cabinet/apps/${appId}/broadcasts/audience?${qs({ preset, rules: JSON.stringify(rules) })}`
    ),
    staleTime: 10_000,
  });

  const qLive = useQuery({
    enabled: !!appId && under === 'live',
    queryKey: ['bc.live', appId],
    queryFn: () => apiFetch<{ ok:true; items: LiveItem[] }>(`/api/cabinet/apps/${appId}/broadcasts/live`),
    staleTime: 3_000,
    refetchInterval: 6_000,
    retry: 0,
  });

  const kpi = qKpi.data?.kpi || { campaigns:0, sent:0, delivered:0, opened:0, clicked:0, failed:0, unsubscribed:0 };
  const trend = qTrend.data?.items || [];
  const campaigns = (qCampaigns.data?.items || []).filter(c => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (c.title || '').toLowerCase().includes(s) || String(c.id).includes(s);
  });

  const openRate = pct(kpi.opened, kpi.delivered);
  const ctr = pct(kpi.clicked, kpi.delivered);
  const failRate = pct(kpi.failed, kpi.sent);
  const unsubRate = pct(kpi.unsubscribed, kpi.delivered);

  const audience = n(qAudience.data?.audience);
  const riskBad = (n(kpi.failed) > 0 && n(kpi.sent) > 0 && (n(kpi.failed)/Math.max(1,n(kpi.sent))) > 0.04);

  const alerts = [
    {
      kind: riskBad ? 'bad' : (failRate !== '0%' ? 'mid' : 'ok'),
      title: 'Delivery health',
      desc: `Fail rate: ${failRate} · Unsub: ${unsubRate}`,
    },
    {
      kind: (openRate === '0%' && kpi.delivered > 50) ? 'mid' : 'ok',
      title: 'Engagement',
      desc: `Open: ${openRate} · CTR: ${ctr}`,
    },
    {
      kind: (audience < 50 && preset !== 'all') ? 'mid' : 'ok',
      title: 'Audience size',
      desc: `Selected audience: ${audience}`,
    },
  ];

  function addRule(){
    setRules(r => [...r, { id: uid(), field:'coins', op:'gte', value:'1' }]);
  }
  function delRule(id: string){
    setRules(r => r.filter(x => x.id !== id));
  }
  function setRule(id: string, patch: Partial<SegmentRule>){
    setRules(r => r.map(x => x.id === id ? { ...x, ...patch } : x));
  }

  // ===== Actions (placeholders)
  const [busy, setBusy] = React.useState<string>('');
  const [msg, setMsg] = React.useState<string>('');

  async function createDraft(){
    if (!appId) return;
    setMsg('');
    setBusy('create');

    try{
      const payload = {
        title: title || 'Broadcast',
        channel,
        subject: subject || '',
        message,
        deep_link: deepLink,
        utm,
        segment: { preset, rules },
      };
      await apiFetch(`/api/cabinet/apps/${appId}/broadcasts/campaigns`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setMsg('Draft создан.');
      await qc.invalidateQueries({ queryKey: ['bc.campaigns', appId] });
      setSeg('campaigns');
    }catch(e:any){
      setMsg('Ошибка: ' + String(e?.message || e));
    }finally{
      setBusy('');
    }
  }

  async function scheduleOrSend(now: boolean){
    if (!appId) return;
    setMsg('');
    setBusy(now ? 'send' : 'schedule');

    try{
      const payload = {
        channel,
        title: title || 'Broadcast',
        subject: subject || '',
        message,
        deep_link: deepLink,
        utm,
        segment: { preset, rules },
        schedule_at: now ? null : scheduleAt,
      };
      await apiFetch(`/api/cabinet/apps/${appId}/broadcasts/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setMsg(now ? 'Отправка запущена.' : 'Запланировано.');
      await qc.invalidateQueries({ queryKey: ['bc.campaigns', appId] });
    }catch(e:any){
      setMsg('Ошибка: ' + String(e?.message || e));
    }finally{
      setBusy('');
    }
  }

  async function sendTest(){
    if (!appId) return;
    setMsg('');
    setBusy('test');

    try{
      const payload = {
        channel,
        to: normPhoneOrTg(testTo),
        subject: subject || '',
        message,
        deep_link: deepLink,
      };
      await apiFetch(`/api/cabinet/apps/${appId}/broadcasts/test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setMsg('Тест отправлен.');
    }catch(e:any){
      setMsg('Ошибка: ' + String(e?.message || e));
    }finally{
      setBusy('');
    }
  }

  return (
    <div className="sg-page bcPage">
      {/* ===== Header */}
      <div className="bcHead">
        <div>
          <h1 className="sg-h1">Broadcasts</h1>
          <div className="sg-sub">Рассылки, сегменты, статистика, deliverability.</div>
        </div>

        <div className="sg-tabs bcSegTabs">
          <button className={'sg-tab ' + (seg==='overview'?'is-active':'')} onClick={()=>setSeg('overview')}>Overview</button>
          <button className={'sg-tab ' + (seg==='campaigns'?'is-active':'')} onClick={()=>setSeg('campaigns')}>Campaigns</button>
          <button className={'sg-tab ' + (seg==='composer'?'is-active':'')} onClick={()=>setSeg('composer')}>Composer</button>
          <button className={'sg-tab ' + (seg==='segments'?'is-active':'')} onClick={()=>setSeg('segments')}>Segments</button>
          <button className={'sg-tab ' + (seg==='templates'?'is-active':'')} onClick={()=>setSeg('templates')}>Templates</button>
          <button className={'sg-tab ' + (seg==='settings'?'is-active':'')} onClick={()=>setSeg('settings')}>Settings</button>
        </div>
      </div>

      {/* ===== Grid */}
      <div className="bcGrid">
        {/* LEFT */}
        <div className="bcLeft">
          {/* ===== Chart ALWAYS */}
          <Card className="bcCard">
            <div className="bcCardHead bcCardHeadRow">
              <div>
                <div className="bcCardTitle">Динамика</div>
                <div className="bcCardSub">{range?.from} — {range?.to}</div>
              </div>

              <div className="bcChartBtns" role="tablist" aria-label="Chart type">
                <button className={'bcChartBtn ' + (chartType==='bar'?'is-active':'')} onClick={()=>setChartType('bar')} title="Bars"><IcoBar/></button>
                <button className={'bcChartBtn ' + (chartType==='line'?'is-active':'')} onClick={()=>setChartType('line')} title="Line"><IcoLine/></button>
                <button className={'bcChartBtn ' + (chartType==='area'?'is-active':'')} onClick={()=>setChartType('area')} title="Area"><IcoArea/></button>
              </div>
            </div>

            <div className="bcMetricRow">
              <div className="sg-tabs bcMetricTabs">
                <button className={'sg-tab ' + (metric==='sent'?'is-active':'')} onClick={()=>setMetric('sent')}>Sent</button>
                <button className={'sg-tab ' + (metric==='delivered'?'is-active':'')} onClick={()=>setMetric('delivered')}>Delivered</button>
                <button className={'sg-tab ' + (metric==='opened'?'is-active':'')} onClick={()=>setMetric('opened')}>Opened</button>
                <button className={'sg-tab ' + (metric==='clicked'?'is-active':'')} onClick={()=>setMetric('clicked')}>Clicked</button>
              </div>
            </div>

            <div className="bcChart">
              {qTrend.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qTrend.isError && <div className="sg-muted">Ошибка: {(qTrend.error as Error).message}</div>}

              {!qTrend.isLoading && !qTrend.isError && (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={trend} barCategoryGap={18}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35}/>
                      <XAxis dataKey="d" tick={{ fontSize: 12 }} height={42}/>
                      <YAxis tick={{ fontSize: 12 }}/>
                      <Tooltip />
                      <Bar dataKey={metric} fill="var(--bc-accent)" radius={[10,10,4,4]}/>
                    </BarChart>
                  ) : chartType === 'line' ? (
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35}/>
                      <XAxis dataKey="d" tick={{ fontSize: 12 }} height={42}/>
                      <YAxis tick={{ fontSize: 12 }}/>
                      <Tooltip />
                      <Line type="monotone" dataKey={metric} stroke="var(--bc-accent)" strokeWidth={3} dot={false}/>
                    </LineChart>
                  ) : (
                    <AreaChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35}/>
                      <XAxis dataKey="d" tick={{ fontSize: 12 }} height={42}/>
                      <YAxis tick={{ fontSize: 12 }}/>
                      <Tooltip />
                      <Area type="monotone" dataKey={metric} stroke="var(--bc-accent)" fill="var(--bc-accent)" fillOpacity={0.14} strokeWidth={3}/>
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* KPI */}
            <div className="bcKpiRow">
              <div className="bcKpi">
                <div className="bcKpiLbl">Delivered</div>
                <div className="bcKpiVal">{kpi.delivered}</div>
                <div className="bcKpiMini">Sent: <b>{kpi.sent}</b></div>
              </div>
              <div className="bcKpi">
                <div className="bcKpiLbl">Open rate</div>
                <div className="bcKpiVal">{openRate}</div>
                <div className="bcKpiMini">Opened: <b>{kpi.opened}</b></div>
              </div>
              <div className="bcKpi">
                <div className="bcKpiLbl">CTR</div>
                <div className="bcKpiVal">{ctr}</div>
                <div className="bcKpiMini">Clicked: <b>{kpi.clicked}</b></div>
              </div>
            </div>

            {/* Under chart Live/Alerts */}
            <div className="bcUnder">
              <div className="sg-tabs bcUnderTabs">
                <button className={'sg-tab ' + (under==='alerts'?'is-active':'')} onClick={()=>setUnder('alerts')}>Alerts</button>
                <button className={'sg-tab ' + (under==='live'?'is-active':'')} onClick={()=>setUnder('live')}>Live</button>
              </div>

              {under === 'alerts' && (
                <div className="bcUnderPanel">
                  <div className="bcUnderHead">
                    <div>
                      <div className="bcCardTitle">Alerts</div>
                      <div className="bcCardSub">deliverability + реакция аудитории</div>
                    </div>
                    <div className="bcBadgeRow">
                      <span className={'bcBadge ' + (riskBad ? 'bad':'ok')}>Fail {failRate}</span>
                      <span className={'bcBadge ' + (unsubRate !== '0%' ? 'mid':'ok')}>Unsub {unsubRate}</span>
                      <span className={'bcBadge ok'}>Audience {audience}</span>
                    </div>
                  </div>

                  <div className="bcAlerts">
                    {alerts.map((a, i) => (
                      <div key={i} className={'bcAlert ' + a.kind}>
                        <div className="bcAlertTitle">{a.title}</div>
                        <div className="bcAlertDesc">{a.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {under === 'live' && (
                <div className="bcUnderPanel">
                  <div className="bcUnderHead">
                    <div>
                      <div className="bcCardTitle">Live</div>
                      <div className="bcCardSub">последние события рассылок</div>
                    </div>
                    <div className="sg-pill" style={{ padding:'8px 12px' }}>
                      {qLive.isFetching ? 'обновляю…' : 'готово'}
                    </div>
                  </div>

                  {qLive.isLoading && <div className="sg-muted">Загрузка…</div>}
                  {qLive.isError && (
                    <div className="sg-muted">
                      Ошибка: {(qLive.error as Error).message}
                      <div style={{ marginTop: 6, opacity: .8 }}>Если эндпоинт другой — замени <code>/broadcasts/live</code>.</div>
                    </div>
                  )}

                  {qLive.data?.items?.length ? (
                    <div className="bcLiveList">
                      {qLive.data.items.slice(0, 18).map((e, i) => (
                        <div className="bcLiveRow" key={i}>
                          <div className="bcLiveType">{e.type}</div>
                          <div className="bcLiveLabel">{e.label}</div>
                          <div className="bcLiveTs">{e.ts}</div>
                        </div>
                      ))}
                    </div>
                  ) : (!qLive.isLoading && !qLive.isError) ? (
                    <div className="sg-muted">Пока пусто</div>
                  ) : null}
                </div>
              )}
            </div>
          </Card>

          {/* ===== Content by segment */}
          {seg === 'overview' && (
            <>
              <Card className="bcCard">
                <div className="bcCardHead bcCardHeadRow">
                  <div>
                    <div className="bcCardTitle">Последние кампании</div>
                    <div className="bcCardSub">быстрый контроль + фильтры</div>
                  </div>

                  <div className="bcFilters">
                    <Input value={q} onChange={(e:any)=>setQ(e.target.value)} placeholder="поиск по названию / id" />
                    <div className="sg-tabs bcStatusTabs">
                      <button className={'sg-tab ' + (statusFilter==='all'?'is-active':'')} onClick={()=>setStatusFilter('all')}>All</button>
                      <button className={'sg-tab ' + (statusFilter==='draft'?'is-active':'')} onClick={()=>setStatusFilter('draft')}>Draft</button>
                      <button className={'sg-tab ' + (statusFilter==='scheduled'?'is-active':'')} onClick={()=>setStatusFilter('scheduled')}>Scheduled</button>
                      <button className={'sg-tab ' + (statusFilter==='sent'?'is-active':'')} onClick={()=>setStatusFilter('sent')}>Sent</button>
                    </div>
                  </div>
                </div>

                <div className="bcTableWrap">
                  <table className="sg-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Audience</th>
                        <th>Delivered</th>
                        <th>Open</th>
                        <th>CTR</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.slice(0, 10).map((c) => {
                        const o = pct(n(c.opened), n(c.delivered));
                        const k = pct(n(c.clicked), n(c.delivered));
                        return (
                          <tr key={String(c.id)}>
                            <td><b>{c.id}</b></td>
                            <td>{c.title}</td>
                            <td><span className={'bcStatus ' + c.status}>{c.status}</span></td>
                            <td>{c.audience ?? '—'}</td>
                            <td>{c.delivered ?? '—'}</td>
                            <td>{o}</td>
                            <td>{k}</td>
                            <td>{c.sent_at || c.scheduled_at || c.created_at}</td>
                          </tr>
                        );
                      })}
                      {!campaigns.length && !qCampaigns.isLoading && (
                        <tr><td colSpan={8} style={{ opacity:.7, padding:14 }}>Нет кампаний</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="bcCard">
                <div className="bcCardHead">
                  <div className="bcCardTitle">Идеи “как у топовых”</div>
                  <div className="bcCardSub">чтобы рассылки реально давали деньги</div>
                </div>
                <div className="bcIdeas">
                  <div className="sg-muted">• A/B заголовка/первой строки (TG тоже работает) + авто-победитель</div>
                  <div className="sg-muted">• “Quiet hours”: не слать ночью по локали пользователя</div>
                  <div className="sg-muted">• Frequency cap: не более N сообщений в 24/72 часа</div>
                  <div className="sg-muted">• Holdout group 5–10% для честного uplift</div>
                  <div className="sg-muted">• Deep link в мини-апп с параметрами (page + coupon)</div>
                </div>
              </Card>
            </>
          )}

          {seg === 'campaigns' && (
            <Card className="bcCard">
              <div className="bcCardHead bcCardHeadRow">
                <div>
                  <div className="bcCardTitle">Campaigns</div>
                  <div className="bcCardSub">история, статусы, быстрые действия</div>
                </div>
                <div className="bcFilters">
                  <Input value={q} onChange={(e:any)=>setQ(e.target.value)} placeholder="поиск" />
                  <div className="sg-tabs bcStatusTabs">
                    <button className={'sg-tab ' + (statusFilter==='all'?'is-active':'')} onClick={()=>setStatusFilter('all')}>All</button>
                    <button className={'sg-tab ' + (statusFilter==='draft'?'is-active':'')} onClick={()=>setStatusFilter('draft')}>Draft</button>
                    <button className={'sg-tab ' + (statusFilter==='scheduled'?'is-active':'')} onClick={()=>setStatusFilter('scheduled')}>Scheduled</button>
                    <button className={'sg-tab ' + (statusFilter==='sending'?'is-active':'')} onClick={()=>setStatusFilter('sending')}>Sending</button>
                    <button className={'sg-tab ' + (statusFilter==='sent'?'is-active':'')} onClick={()=>setStatusFilter('sent')}>Sent</button>
                  </div>
                </div>
              </div>

              <div className="bcCampaignList">
                {campaigns.map((c) => {
                  const o = pct(n(c.opened), n(c.delivered));
                  const k = pct(n(c.clicked), n(c.delivered));
                  return (
                    <div className="bcCampRow" key={String(c.id)}>
                      <div className="bcCampLeft">
                        <div className="bcCampTitle">{c.title}</div>
                        <div className="bcCampMeta">
                          <span className={'bcStatus ' + c.status}>{c.status}</span>
                          <span className="sg-muted">· ch: <b>{c.channel}</b></span>
                          <span className="sg-muted">· {c.sent_at || c.scheduled_at || c.created_at}</span>
                        </div>
                      </div>

                      <div className="bcCampStats">
                        <div className="bcCampStat"><span className="sg-muted">del</span><b>{c.delivered ?? '—'}</b></div>
                        <div className="bcCampStat"><span className="sg-muted">open</span><b>{o}</b></div>
                        <div className="bcCampStat"><span className="sg-muted">ctr</span><b>{k}</b></div>
                      </div>

                      <div className="bcCampBtns">
                        <Button variant="secondary" disabled>View</Button>
                        <Button variant="secondary" disabled>Duplicate</Button>
                      </div>
                    </div>
                  );
                })}
                {!campaigns.length && !qCampaigns.isLoading && <div className="sg-muted">Нет кампаний.</div>}
              </div>
            </Card>
          )}

          {seg === 'composer' && (
            <Card className="bcCard">
              <div className="bcCardHead">
                <div className="bcCardTitle">Composer</div>
                <div className="bcCardSub">редактор (основное — в правой sticky панели)</div>
              </div>
              <div className="sg-muted">
                Пользуйся правой панелью: там канал, текст, сегмент, тест и отправка/планирование.
              </div>
            </Card>
          )}

          {seg === 'segments' && (
            <Card className="bcCard">
              <div className="bcCardHead bcCardHeadRow">
                <div>
                  <div className="bcCardTitle">Segments</div>
                  <div className="bcCardSub">пресеты + правила</div>
                </div>
                <div style={{ display:'flex', gap: 10, flexWrap:'wrap', justifyContent:'flex-end' }}>
                  <Button variant="secondary" onClick={addRule}>+ Rule</Button>
                  <Button variant="primary" disabled>Save segment</Button>
                </div>
              </div>

              <div className="bcSegBuilder">
                <div className="bcSegRow">
                  <div className="bcSegLbl">Preset</div>
                  <div className="sg-tabs bcPresetTabs">
                    {(['all','active_7d','active_30d','new_7d','vip','sleeping_30d','custom'] as SegmentPreset[]).map(p => (
                      <button key={p} className={'sg-tab ' + (preset===p?'is-active':'')} onClick={()=>setPreset(p)}>{p}</button>
                    ))}
                  </div>
                </div>

                <div className="bcRules">
                  {rules.map(r => (
                    <div key={r.id} className="bcRule">
                      <select className="bcSelect" value={r.field} onChange={(e:any)=>setRule(r.id,{ field: e.target.value })}>
                        <option value="coins">coins</option>
                        <option value="last_visit_days">last_visit_days</option>
                        <option value="purchases_30d">purchases_30d</option>
                        <option value="total_spend">total_spend</option>
                        <option value="tags">tags</option>
                        <option value="referrals">referrals</option>
                        <option value="language">language</option>
                        <option value="has_unclaimed_prize">has_unclaimed_prize</option>
                      </select>

                      <select className="bcSelect" value={r.op} onChange={(e:any)=>setRule(r.id,{ op: e.target.value })}>
                        <option value="eq">=</option>
                        <option value="neq">≠</option>
                        <option value="gt">&gt;</option>
                        <option value="gte">≥</option>
                        <option value="lt">&lt;</option>
                        <option value="lte">≤</option>
                        <option value="in">in</option>
                        <option value="contains">contains</option>
                      </select>

                      <Input value={r.value} onChange={(e:any)=>setRule(r.id,{ value: e.target.value })} placeholder="value" />

                      <button className="bcIconBtn" onClick={()=>delRule(r.id)} title="Remove" aria-label="Remove">×</button>
                    </div>
                  ))}
                </div>

                <div className="bcAudienceBox">
                  <div className="bcAudienceTop">
                    <div className="bcAudienceTitle">Audience</div>
                    <span className={'bcBadge ' + (audience < 50 ? 'mid' : 'ok')}>{audience}</span>
                  </div>
                  <div className="bcAudienceHint">
                    <span className="sg-muted">подключи в бэке превью: sample пользователей</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {seg === 'templates' && (
            <Card className="bcCard">
              <div className="bcCardHead">
                <div className="bcCardTitle">Templates</div>
                <div className="bcCardSub">заготовки: “вернись”, “акция”, “VIP”, “день рождения”</div>
              </div>
              <div className="sg-muted">TODO: список шаблонов + сохранение из composer.</div>
            </Card>
          )}

          {seg === 'settings' && (
            <Card className="bcCard">
              <div className="bcCardHead">
                <div className="bcCardTitle">Settings</div>
                <div className="bcCardSub">лимиты, quiet hours, частота, unsubscribe</div>
              </div>
              <div className="sg-muted">TODO: frequency cap, quiet hours, opt-out, default UTM, sender.</div>
            </Card>
          )}
        </div>

        {/* RIGHT STICKY (Composer) */}
        <div className="bcRight">
          <Card className="bcCard bcSticky">
            <div className="bcCardHead bcCardHeadRow">
              <div>
                <div className="bcCardTitle">Composer</div>
                <div className="bcCardSub">собери и отправь</div>
              </div>
              <div className="bcHintPill">{audience} users</div>
            </div>

            <div className="bcComposer">
              <div className="bcRow">
                <div className="bcLbl">Channel</div>
                <div className="sg-tabs bcChannelTabs">
                  <button className={'sg-tab ' + (channel==='tg'?'is-active':'')} onClick={()=>setChannel('tg')}>TG</button>
                  <button className={'sg-tab ' + (channel==='push'?'is-active':'')} onClick={()=>setChannel('push')}>Push</button>
                  <button className={'sg-tab ' + (channel==='email'?'is-active':'')} onClick={()=>setChannel('email')}>Email</button>
                </div>
              </div>

              <div className="bcRow">
                <div className="bcLbl">Title</div>
                <Input value={title} onChange={(e:any)=>setTitle(e.target.value)} placeholder="Название кампании" />
              </div>

              {(channel === 'email' || channel === 'push') && (
                <div className="bcRow">
                  <div className="bcLbl">{channel === 'email' ? 'Subject' : 'Title'}</div>
                  <Input value={subject} onChange={(e:any)=>setSubject(e.target.value)} placeholder="Тема/заголовок" />
                </div>
              )}

              <div className="bcRow">
                <div className="bcLbl">Message</div>
                <textarea
                  className="bcTextarea"
                  value={message}
                  onChange={(e:any)=>setMessage(e.target.value)}
                  placeholder="Текст сообщения. (Можно: эмодзи, коротко, 1 CTA)"
                />
                <div className="bcMini">
                  <span className="sg-muted">Совет: первая строка = главный оффер. CTA = deep link.</span>
                </div>
              </div>

              <div className="bcRow">
                <div className="bcLbl">Deep link</div>
                <Input value={deepLink} onChange={(e:any)=>setDeepLink(e.target.value)} placeholder="mini-app route / start_param / url" />
              </div>

              <div className="bcRow bcRow2">
                <div>
                  <div className="bcLbl">UTM</div>
                  <Input value={utm} onChange={(e:any)=>setUtm(e.target.value)} placeholder="utm_campaign" />
                </div>
                <div>
                  <div className="bcLbl">Schedule</div>
                  <Input value={scheduleAt} onChange={(e:any)=>setScheduleAt(e.target.value)} placeholder="2026-02-09 18:00" />
                </div>
              </div>

              <div className="bcRow">
                <div className="bcLbl">Segment preset</div>
                <div className="sg-tabs bcPresetMini">
                  {(['active_7d','active_30d','vip','sleeping_30d','custom'] as SegmentPreset[]).map(p => (
                    <button key={p} className={'sg-tab ' + (preset===p?'is-active':'')} onClick={()=>setPreset(p)}>{p}</button>
                  ))}
                </div>
                <div className="bcMini">
                  <span className="sg-muted">Тонкая настройка — во вкладке Segments.</span>
                </div>
              </div>

              <div className="bcActions">
                {msg && <div className="bcMsg">{msg}</div>}

                <div className="bcBtnRow">
                  <Button variant="secondary" onClick={createDraft} disabled={!appId || busy !== ''}>
                    {busy==='create' ? 'Создаю…' : 'Create draft'}
                  </Button>
                  <Button variant="primary" onClick={() => scheduleOrSend(true)} disabled={!appId || busy !== '' || !message.trim()}>
                    {busy==='send' ? 'Старт…' : 'Send now'}
                  </Button>
                </div>

                <div className="bcBtnRow">
                  <Button variant="secondary" onClick={() => scheduleOrSend(false)} disabled={!appId || busy !== '' || !scheduleAt.trim() || !message.trim()}>
                    {busy==='schedule' ? 'Планирую…' : 'Schedule'}
                  </Button>
                </div>

                <div className="bcTest">
                  <div className="bcLbl">Test to</div>
                  <div className="bcRowInline">
                    <Input value={testTo} onChange={(e:any)=>setTestTo(e.target.value)} placeholder="tg id / email" />
                    <Button variant="secondary" onClick={sendTest} disabled={!appId || busy !== '' || !testTo.trim() || !message.trim()}>
                      {busy==='test' ? '…' : 'Send test'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bcCard bcSticky2">
            <div className="bcCardHead">
              <div className="bcCardTitle">Segment summary</div>
              <div className="bcCardSub">что выбрано сейчас</div>
            </div>

            <div className="bcSegSummary">
              <div className="bcSumRow"><span className="sg-muted">Preset</span><b>{preset}</b></div>
              <div className="bcSumRow"><span className="sg-muted">Rules</span><b>{rules.length}</b></div>
              <div className="bcSumRow"><span className="sg-muted">Audience</span><b>{audience}</b></div>
              <div className="bcSumHint sg-muted">
                Если audience маленькая — расширь правила или выбери active_30d.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
