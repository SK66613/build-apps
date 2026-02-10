import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input, Button } from '../components/ui';
import { LanguageSelect } from '../components/LanguageSelect';
import { useI18n } from '../i18n';

type BroadcastRow = {
  id: number;
  title?: string | null;
  segment?: string | null;
  status?: string | null;
  total?: number | null;
  sent?: number | null;
  failed?: number | null;
  blocked?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function qs(obj: Record<string, any>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || String(v) === '') continue;
    p.set(k, String(v));
  }
  return p.toString();
}

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function pct(a: number, b: number) {
  if (!b) return '0%';
  return Math.round((a / b) * 100) + '%';
}

export default function Broadcasts() {
  const { appId } = useAppState() as any;
  const qc = useQueryClient();
  const { t } = useI18n();

  const [q, setQ] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  // drawer (composer)
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [segment, setSegment] = React.useState('bot_active');
  const [text, setText] = React.useState('');
  const [btnText, setBtnText] = React.useState('');
  const [btnUrl, setBtnUrl] = React.useState('');

  const listQ = useQuery({
    enabled: !!appId,
    queryKey: ['bc.list', appId],
    queryFn: () => apiFetch<{ ok: true; items: BroadcastRow[] }>(`/api/app/${appId}/broadcasts`),
    staleTime: 8_000,
  });

  const itemsRaw = listQ.data?.items || [];
  const items = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return itemsRaw;
    return itemsRaw.filter((x) => {
      const hay = `${x.title || ''} ${x.segment || ''} ${x.status || ''} ${x.id}`.toLowerCase();
      return hay.includes(s);
    });
  }, [itemsRaw, q]);

  React.useEffect(() => {
    if (!selectedId && itemsRaw.length) setSelectedId(itemsRaw[0].id);
  }, [itemsRaw.length]); // eslint-disable-line

  const selected = React.useMemo(() => {
    if (!selectedId) return null;
    return itemsRaw.find((x) => x.id === selectedId) || null;
  }, [itemsRaw, selectedId]);

  // KPI (aggregated)
  const kpi = React.useMemo(() => {
    const total = itemsRaw.reduce((a, x) => a + n(x.total), 0);
    const sent = itemsRaw.reduce((a, x) => a + n(x.sent), 0);
    const failed = itemsRaw.reduce((a, x) => a + n(x.failed), 0);
    const blocked = itemsRaw.reduce((a, x) => a + n(x.blocked), 0);
    const done = itemsRaw.filter((x) => String(x.status || '').toLowerCase() === 'done').length;
    const failRate = pct(failed + blocked, Math.max(1, sent + failed + blocked));
    return { campaigns: itemsRaw.length, done, total, sent, failed, blocked, failRate };
  }, [itemsRaw]);

  function openCreate() {
    setTitle('');
    setSegment('bot_active');
    setText('');
    setBtnText('');
    setBtnUrl('');
    setDrawerOpen(true);
  }

  async function send() {
    if (!appId) return;
    const v = text.trim();
    if (!v) return;

    setSending(true);
    try {
      await apiFetch(`/api/app/${appId}/broadcast`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          text: v,
          segment: segment || 'bot_active',
          btn_text: btnText.trim() || null,
          btn_url: btnUrl.trim() || null,
        }),
      });

      setDrawerOpen(false);
      await qc.invalidateQueries({ queryKey: ['bc.list', appId] });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="sg-page bcPage">
      <div className="bcHead">
        <div>
          <h1 className="sg-h1">{t('nav.broadcasts')}</h1>
          <div className="sg-sub">{t('bc.subtitle')}</div>
        </div>

        <div className="cuHeadRight">
          <div className="cuSearch">
            <Input value={q} onChange={(e: any) => setQ(e.target.value)} placeholder={t('bc.search')} disabled={!appId} />
          </div>

          <Button variant="secondary" onClick={() => listQ.refetch()} disabled={listQ.isFetching}>
            {t('common.refresh')}
          </Button>

          <Button variant="primary" onClick={openCreate} disabled={!appId}>
            {t('bc.create')}
          </Button>

          <LanguageSelect className="top__select" />
        </div>
      </div>

      <div className="bcGrid">
        {/* LEFT: campaigns */}
        <div className="bcLeft">
          <Card className="bcCard">
            <div className="bcCardHead">
              <div className="bcCardHeadRow">
                <div>
                  <div className="bcCardTitle">{t('bc.campaigns')}</div>
                  <div className="bcCardSub">
                    {listQ.isLoading ? t('common.loading') : t('bc.count', { n: items.length })}
                  </div>
                </div>
              </div>
            </div>

            {listQ.isError && (
              <div className="sg-muted">
                {t('common.error')}: {(listQ.error as Error).message}
              </div>
            )}

            {!listQ.isLoading && !items.length && !listQ.isError && <div className="sg-muted">{t('bc.empty')}</div>}

            <div className="bcAlerts" style={{ marginTop: 10 }}>
              {items.map((x) => {
                const active = selectedId === x.id;
                const status = String(x.status || '—');
                return (
                  <button
                    key={x.id}
                    className={'bcAlert ' + (active ? 'is-active' : '')}
                    onClick={() => setSelectedId(x.id)}
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: 16,
                      border: '1px solid rgba(15,23,42,.10)',
                      background: active ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.72)',
                      padding: 12,
                    }}
                    type="button"
                  >
                    <div className="bcUnderHead">
                      <div>
                        <div style={{ fontWeight: 950 }}>{x.title || t('bc.untitled')}</div>
                        <div className="sg-muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {t('bc.segment')}: {x.segment || '—'} • {fmtWhen(x.created_at)}
                        </div>
                      </div>
                      <div className="bcBadgeRow">
                        <span className={'bcBadge ' + (status === 'done' ? 'ok' : 'mid')}>{status}</span>
                      </div>
                    </div>

                    <div className="bcKpiRow" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 10 }}>
                      <div className="bcKpi">
                        <div className="bcKpiLbl">total</div>
                        <div className="bcKpiVal">{n(x.total)}</div>
                      </div>
                      <div className="bcKpi">
                        <div className="bcKpiLbl">sent</div>
                        <div className="bcKpiVal">{n(x.sent)}</div>
                      </div>
                      <div className="bcKpi">
                        <div className="bcKpiLbl">failed</div>
                        <div className="bcKpiVal">{n(x.failed)}</div>
                      </div>
                      <div className="bcKpi">
                        <div className="bcKpiLbl">blocked</div>
                        <div className="bcKpiVal">{n(x.blocked)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* RIGHT: KPI + selected */}
        <div className="bcRight">
          <Card className="bcCard" style={{ position: 'sticky', top: 14 }}>
            <div className="bcCardHead">
              <div className="bcCardTitle">{t('bc.kpi')}</div>
              <div className="bcCardSub">{t('bc.kpiSub')}</div>
            </div>

            <div className="bcKpiRow">
              <div className="bcKpi">
                <div className="bcKpiLbl">{t('bc.kpi.campaigns')}</div>
                <div className="bcKpiVal">{kpi.campaigns}</div>
              </div>
              <div className="bcKpi">
                <div className="bcKpiLbl">{t('bc.kpi.done')}</div>
                <div className="bcKpiVal">{kpi.done}</div>
              </div>
              <div className="bcKpi">
                <div className="bcKpiLbl">{t('bc.kpi.sent')}</div>
                <div className="bcKpiVal">{kpi.sent}</div>
              </div>
              <div className="bcKpi">
                <div className="bcKpiLbl">{t('bc.kpi.failRate')}</div>
                <div className="bcKpiVal">{kpi.failRate}</div>
              </div>
            </div>

            <div className="bcUnder" style={{ marginTop: 14 }}>
              <div className="bcUnderPanel">
                <div className="bcUnderHead">
                  <div>
                    <div style={{ fontWeight: 950 }}>{t('bc.selected')}</div>
                    <div className="sg-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {selected ? `${t('bc.updated')}: ${fmtWhen(selected.updated_at)}` : t('bc.pick')}
                    </div>
                  </div>
                  <div className="bcBadgeRow">
                    <Button variant="primary" onClick={openCreate}>
                      {t('bc.create')}
                    </Button>
                  </div>
                </div>

                {selected ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>{selected.title || t('bc.untitled')}</div>
                    <div className="sg-muted" style={{ marginTop: 6, fontSize: 12 }}>
                      {t('bc.segment')}: {selected.segment || '—'} • {t('bc.status')}: {selected.status || '—'}
                    </div>

                    <div className="bcKpiRow" style={{ marginTop: 12 }}>
                      <div className="bcKpi">
                        <div className="bcKpiLbl">total</div>
                        <div className="bcKpiVal">{n(selected.total)}</div>
                      </div>
                      <div className="bcKpi">
                        <div className="bcKpiLbl">sent</div>
                        <div className="bcKpiVal">{n(selected.sent)}</div>
                      </div>
                      <div className="bcKpi">
                        <div className="bcKpiLbl">failed</div>
                        <div className="bcKpiVal">{n(selected.failed)}</div>
                      </div>
                      <div className="bcKpi">
                        <div className="bcKpiLbl">blocked</div>
                        <div className="bcKpiVal">{n(selected.blocked)}</div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen ? (
        <>
          <div className="sg-drawerMask" onClick={() => !sending && setDrawerOpen(false)} />
          <div className="sg-drawer">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 1000, fontSize: 18 }}>{t('bc.drawer.title')}</div>
                <div className="sg-muted" style={{ marginTop: 4 }}>{t('bc.drawer.sub')}</div>
              </div>
              <Button variant="ghost" onClick={() => !sending && setDrawerOpen(false)}>✕</Button>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gap: 10, overflow: 'auto' }}>
              <div>
                <div className="sg-muted" style={{ fontSize: 12, marginBottom: 6 }}>{t('bc.drawer.campaignTitle')}</div>
                <Input value={title} onChange={(e:any)=>setTitle(e.target.value)} placeholder={t('bc.drawer.titlePh')} />
              </div>

              <div>
                <div className="sg-muted" style={{ fontSize: 12, marginBottom: 6 }}>{t('bc.drawer.segment')}</div>
                <select className="top__select" value={segment} onChange={(e)=>setSegment(e.target.value)}>
                  <option value="bot_active">bot_active</option>
                  <option value="bot_today">bot_today</option>
                  <option value="bot_7d">bot_7d</option>
                  <option value="bot_30d">bot_30d</option>
                  <option value="all">all</option>
                </select>
              </div>

              <div>
                <div className="sg-muted" style={{ fontSize: 12, marginBottom: 6 }}>{t('bc.drawer.text')}</div>
                <textarea
                  className="cuTextarea"
                  value={text}
                  onChange={(e:any)=>setText(e.target.value)}
                  placeholder={t('bc.drawer.textPh')}
                  rows={8}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div className="sg-muted" style={{ fontSize: 12, marginBottom: 6 }}>{t('bc.drawer.btnText')}</div>
                  <Input value={btnText} onChange={(e:any)=>setBtnText(e.target.value)} />
                </div>
                <div>
                  <div className="sg-muted" style={{ fontSize: 12, marginBottom: 6 }}>{t('bc.drawer.btnUrl')}</div>
                  <Input value={btnUrl} onChange={(e:any)=>setBtnUrl(e.target.value)} />
                </div>
              </div>

              <Card className="bcCard" style={{ padding: 12 }}>
                <div style={{ fontWeight: 950 }}>{t('bc.drawer.preview')}</div>
                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{text.trim() ? text : '—'}</div>
                {(btnText.trim() || btnUrl.trim()) ? (
                  <div className="sg-muted" style={{ marginTop: 10, fontSize: 12 }}>
                    {t('bc.drawer.button')}: <b>{btnText.trim() || 'Button'}</b> — {btnUrl.trim() || 'URL'}
                  </div>
                ) : null}
              </Card>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
              <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={sending}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" onClick={send} disabled={sending || !text.trim()} style={{ marginLeft: 'auto' }}>
                {sending ? t('common.sending') : t('bc.drawer.send')}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
