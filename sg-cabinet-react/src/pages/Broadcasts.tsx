import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppState } from '../app/appState';
import { apiFetch } from '../lib/api';
import { Card, Input, Button } from '../components/ui';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

type BroadcastStatus = 'draft'|'scheduled'|'sending'|'done'|'paused'|'failed';

type Broadcast = {
  id: string;
  title?: string;
  text?: string;
  segment?: string;
  status: BroadcastStatus;
  created_at?: string;
  scheduled_at?: string;

  // quick stats (for list)
  audience?: number;
  sent?: number;
  delivered?: number;
  read?: number;
  clicked?: number;
  failed?: number;
};

type BroadcastListResp = { ok: true; items: Broadcast[] };

type BroadcastDetailsResp = {
  ok: true;
  b: Broadcast & {
    // details
    author?: string;
    message_preview?: string;
  };
  // chart series
  timeline?: Array<{ t: string; sent: number; delivered: number; read: number; clicked: number; failed: number }>;
  // breakdowns
  errors?: Array<{ code: string; count: number }>;
  links?: Array<{ url: string; clicks: number }>;
  recipients?: Array<{ segment: string; count: number }>;
};

function qs(obj: Record<string, any>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj || {})){
    if (v === undefined || v === null || String(v) === '') continue;
    p.set(k, String(v));
  }
  return p.toString();
}

function pct(n:number, d:number){
  if (!d) return '0%';
  return Math.round((n/d)*100) + '%';
}

export default function Broadcasts(){
  const { appId, range } = useAppState() as any;
  const qc = useQueryClient();

  // filters
  const [q, setQ] = React.useState('');
  const [seg, setSeg] = React.useState<'all'|'draft'|'scheduled'|'sending'|'done'|'failed'>('all');

  // drawer state
  const [openId, setOpenId] = React.useState<string|null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // create panel (optional)
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState('');
  const [draftText, setDraftText] = React.useState('');
  const [draftSegment, setDraftSegment] = React.useState('all');

  const qList = useQuery({
    enabled: !!appId,
    queryKey: ['broadcasts', appId, seg, q, range?.from, range?.to],
    queryFn: () => apiFetch<BroadcastListResp>(
      `/api/cabinet/apps/${appId}/broadcasts?${qs({ seg, q, from: range?.from, to: range?.to })}`
    ),
    staleTime: 10_000,
  });

  const list = qList.data?.items || [];

  const qDetails = useQuery({
    enabled: !!appId && !!openId && drawerOpen,
    queryKey: ['broadcast', appId, openId],
    queryFn: () => apiFetch<BroadcastDetailsResp>(
      `/api/cabinet/apps/${appId}/broadcasts/${openId}`
    ),
    staleTime: 5_000,
  });

  const b = qDetails.data?.b;

  function openDrawer(id: string){
    setOpenId(id);
    setDrawerOpen(true);
  }
  function closeDrawer(){
    setDrawerOpen(false);
    // чуть позже можно чистить openId, но так UI меньше дергается
  }

  async function createDraft(){
    if (!appId) return;
    if (!draftText.trim()) return;

    const r = await apiFetch<{ ok:true; id:string }>(`/api/cabinet/apps/${appId}/broadcasts`, {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({
        title: draftTitle.trim() || 'Broadcast',
        text: draftText.trim(),
        segment: draftSegment,
      }),
    });

    setComposeOpen(false);
    setDraftTitle('');
    setDraftText('');
    await qc.invalidateQueries({ queryKey: ['broadcasts', appId] });
    openDrawer(r.id);
  }

  // UI derived
  const total = list.length;
  const totalAudience = list.reduce((s,x)=>s+(Number(x.audience)||0),0);
  const totalSent = list.reduce((s,x)=>s+(Number(x.sent)||0),0);
  const totalRead = list.reduce((s,x)=>s+(Number(x.read)||0),0);

  return (
    <div className="sg-page brPage">
      {/* Head */}
      <div className="brHead">
        <div>
          <h1 className="sg-h1">Broadcasts</h1>
          <div className="sg-sub">Главное — рассылки. Статистика открывается в панели справа.</div>
        </div>

        <div className="brHeadRight">
          <div className="brSearch">
            <Input value={q} onChange={(e:any)=>setQ(e.target.value)} placeholder="Поиск по названию/тексту…" />
          </div>

          <Button variant="primary" onClick={()=>setComposeOpen(true)}>Новая рассылка</Button>
        </div>
      </div>

      {/* Grid */}
      <div className="brGrid">
        {/* LEFT sticky filters */}
        <div className="brLeft">
          <Card className="brCard brSticky">
            <div className="brCardHead">
              <div className="brCardTitle">Filters</div>
              <div className="brCardSub">{total ? `${total} камп.` : '—'}</div>
            </div>

            <div className="sg-tabs brSegTabs">
              <button className={'sg-tab '+(seg==='all'?'is-active':'')} onClick={()=>setSeg('all')}>All</button>
              <button className={'sg-tab '+(seg==='draft'?'is-active':'')} onClick={()=>setSeg('draft')}>Draft</button>
              <button className={'sg-tab '+(seg==='scheduled'?'is-active':'')} onClick={()=>setSeg('scheduled')}>Scheduled</button>
              <button className={'sg-tab '+(seg==='sending'?'is-active':'')} onClick={()=>setSeg('sending')}>Sending</button>
              <button className={'sg-tab '+(seg==='done'?'is-active':'')} onClick={()=>setSeg('done')}>Done</button>
              <button className={'sg-tab '+(seg==='failed'?'is-active':'')} onClick={()=>setSeg('failed')}>Failed</button>
            </div>

            <div className="brMiniKpis">
              <div className="brMiniKpi">
                <div className="brMiniLbl">Audience</div>
                <div className="brMiniVal">{totalAudience || 0}</div>
              </div>
              <div className="brMiniKpi">
                <div className="brMiniLbl">Sent</div>
                <div className="brMiniVal">{totalSent || 0}</div>
              </div>
              <div className="brMiniKpi">
                <div className="brMiniLbl">Read</div>
                <div className="brMiniVal">{pct(totalRead, Math.max(1,totalSent))}</div>
              </div>
            </div>

            <div className="brHint sg-muted">
              Совет: держим «статистику» во drawer — список кампаний всегда главный.
            </div>
          </Card>
        </div>

        {/* CENTER: campaigns list */}
        <div className="brCenter">
          <div className="brList">
            {qList.isLoading && <div className="sg-muted">Загрузка…</div>}
            {qList.isError && <div className="sg-muted">Ошибка: {(qList.error as Error).message}</div>}
            {!qList.isLoading && !list.length && <div className="sg-muted">Кампаний нет.</div>}

            {list.map((x) => {
              const isActive = openId === x.id && drawerOpen;

              const sent = Number(x.sent)||0;
              const delivered = Number(x.delivered)||0;
              const read = Number(x.read)||0;
              const clicked = Number(x.clicked)||0;
              const failed = Number(x.failed)||0;
              const denom = Math.max(1, sent);

              const pDeliver = Math.round((delivered/denom)*100);
              const pRead = Math.round((read/denom)*100);
              const pClick = Math.round((clicked/denom)*100);

              return (
                <button
                  key={x.id}
                  type="button"
                  className={'brRow ' + (isActive ? 'is-active' : '')}
                  onClick={() => openDrawer(x.id)}
                >
                  <div className="brRowTop">
                    <div className="brRowTitle">{x.title || 'Broadcast'}</div>
                    <span className={'brStatus st-' + x.status}>{x.status}</span>
                  </div>

                  <div className="brRowPreview">
                    {(x.text || '').slice(0, 120) || '—'}
                  </div>

                  <div className="brRowMeta">
                    <span className="brPill">{x.segment || 'segment: all'}</span>
                    <span className="brDot">•</span>
                    <span className="sg-muted">{x.scheduled_at ? `scheduled: ${x.scheduled_at}` : (x.created_at || '')}</span>
                  </div>

                  <div className="brRowBars" aria-hidden="true">
                    <div className="brBar">
                      <div className="brBarLbl">del</div>
                      <div className="brTrack"><div className="brFill" style={{ width: `${pDeliver}%` }} /></div>
                      <div className="brBarVal">{pDeliver}%</div>
                    </div>
                    <div className="brBar">
                      <div className="brBarLbl">read</div>
                      <div className="brTrack"><div className="brFill" style={{ width: `${pRead}%` }} /></div>
                      <div className="brBarVal">{pRead}%</div>
                    </div>
                    <div className="brBar">
                      <div className="brBarLbl">clk</div>
                      <div className="brTrack"><div className="brFill" style={{ width: `${pClick}%` }} /></div>
                      <div className="brBarVal">{pClick}%</div>
                    </div>
                  </div>

                  <div className="brRowNums">
                    <div className="brNum"><span className="sg-muted">sent</span><b>{sent}</b></div>
                    <div className="brNum"><span className="sg-muted">read</span><b>{read}</b></div>
                    <div className="brNum"><span className="sg-muted">fail</span><b>{failed}</b></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: drawer stats */}
        <div className={'brDrawer ' + (drawerOpen ? 'is-open' : '')}>
          <div className="brDrawerInner">
            <div className="brDrawerHead">
              <div>
                <div className="brDrawerTitle">{b?.title || 'Статистика'}</div>
                <div className="brDrawerSub sg-muted">{b?.status ? `status: ${b.status}` : '—'}</div>
              </div>
              <button className="brClose" type="button" onClick={closeDrawer}>✕</button>
            </div>

            {!drawerOpen && <div />}
            {drawerOpen && qDetails.isLoading && <div className="sg-muted">Загрузка…</div>}
            {drawerOpen && qDetails.isError && <div className="sg-muted">Ошибка: {(qDetails.error as Error).message}</div>}

            {drawerOpen && !qDetails.isLoading && !qDetails.isError && qDetails.data && (
              <div className="brDrawerBody">
                {/* Funnel cards */}
                <div className="brFunnel">
                  <div className="brFunnelTile">
                    <div className="brFunnelLbl">Audience</div>
                    <div className="brFunnelVal">{Number(b?.audience)||0}</div>
                  </div>
                  <div className="brFunnelTile">
                    <div className="brFunnelLbl">Sent</div>
                    <div className="brFunnelVal">{Number(b?.sent)||0}</div>
                  </div>
                  <div className="brFunnelTile">
                    <div className="brFunnelLbl">Delivered</div>
                    <div className="brFunnelVal">{pct(Number(b?.delivered)||0, Math.max(1,Number(b?.sent)||0))}</div>
                  </div>
                  <div className="brFunnelTile">
                    <div className="brFunnelLbl">Read</div>
                    <div className="brFunnelVal">{pct(Number(b?.read)||0, Math.max(1,Number(b?.sent)||0))}</div>
                  </div>
                </div>

                {/* Timeline chart */}
                <Card className="brMiniCard">
                  <div className="brMiniHead">
                    <div className="brMiniTitle">Delivery timeline</div>
                    <div className="sg-muted">sent / delivered / read</div>
                  </div>

                  <div className="brChart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={qDetails.data.timeline || []}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="t" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="sent" stroke="var(--accent2)" fill="var(--accent2)" fillOpacity={0.10} strokeWidth={2} />
                        <Area type="monotone" dataKey="delivered" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.14} strokeWidth={2} />
                        <Area type="monotone" dataKey="read" stroke="rgba(15,23,42,.55)" fill="rgba(15,23,42,.10)" fillOpacity={0.08} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Errors + Links */}
                <div className="brTwo">
                  <Card className="brMiniCard">
                    <div className="brMiniHead">
                      <div className="brMiniTitle">Failures</div>
                      <div className="sg-muted">top error codes</div>
                    </div>
                    <div className="brBarsMini">
                      {(qDetails.data.errors || []).slice(0, 6).map((e) => (
                        <div className="brMiniRow" key={e.code}>
                          <div className="brMiniKey">{e.code}</div>
                          <div className="brMiniTrack">
                            <div className="brMiniFill" style={{ width: `${Math.min(100, (e.count / Math.max(1,(qDetails.data.errors?.[0]?.count||1))) * 100)}%` }} />
                          </div>
                          <div className="brMiniVal">{e.count}</div>
                        </div>
                      ))}
                      {!(qDetails.data.errors||[]).length && <div className="sg-muted">Нет ошибок.</div>}
                    </div>
                  </Card>

                  <Card className="brMiniCard">
                    <div className="brMiniHead">
                      <div className="brMiniTitle">Top links</div>
                      <div className="sg-muted">clicks</div>
                    </div>
                    <div className="brLinks">
                      {(qDetails.data.links || []).slice(0, 6).map((l) => (
                        <div className="brLinkRow" key={l.url}>
                          <div className="brLinkUrl">{l.url}</div>
                          <div className="brLinkClicks">{l.clicks}</div>
                        </div>
                      ))}
                      {!(qDetails.data.links||[]).length && <div className="sg-muted">Ссылок нет.</div>}
                    </div>
                  </Card>
                </div>

                {/* Actions */}
                <div className="brActions">
                  <Button variant="secondary" disabled>Duplicate</Button>
                  <Button variant="secondary" disabled>Pause</Button>
                  <Button variant="primary" disabled>Send now</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose panel (slide) */}
      <div className={'brCompose ' + (composeOpen ? 'is-open' : '')}>
        <div className="brComposeInner">
          <div className="brDrawerHead">
            <div>
              <div className="brDrawerTitle">Новая рассылка</div>
              <div className="brDrawerSub sg-muted">Сначала создаём draft, потом можно запускать.</div>
            </div>
            <button className="brClose" type="button" onClick={()=>setComposeOpen(false)}>✕</button>
          </div>

          <div className="brComposeBody">
            <div className="brField">
              <div className="brFieldLbl">Title</div>
              <Input value={draftTitle} onChange={(e:any)=>setDraftTitle(e.target.value)} placeholder="Например: Акция недели" />
            </div>

            <div className="brField">
              <div className="brFieldLbl">Segment</div>
              <Input value={draftSegment} onChange={(e:any)=>setDraftSegment(e.target.value)} placeholder="all / vip / inactive / …" />
            </div>

            <div className="brField">
              <div className="brFieldLbl">Message</div>
              <textarea
                className="brTextarea"
                value={draftText}
                onChange={(e:any)=>setDraftText(e.target.value)}
                placeholder="Текст рассылки…"
              />
            </div>

            <div className="brActions">
              <Button variant="secondary" onClick={()=>setComposeOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={createDraft} disabled={!draftText.trim()}>Create draft</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
