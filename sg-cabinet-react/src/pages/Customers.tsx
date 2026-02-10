import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input, Button } from '../components/ui';
import { useI18n } from '../i18n';

type CabCustomer = {
  tg_user_id?: string | number;
  tg_username?: string | null;
  coins?: number;
  first_seen?: string;
  last_seen?: string;
  total_opens?: number;
  total_spins?: number;
  total_prizes?: number;
};

type DialogRow = {
  tg_user_id: string | number;
  tg_username?: string | null;
  bot_last_seen?: string | null;
  bot_started_at?: string | null;
  in_count?: number;
  out_count?: number;
  last_text?: string | null;
  last_dir?: 'in' | 'out' | null;
};

type DialogMsg = {
  id: number;
  direction: 'in' | 'out';
  msg_type?: string | null;
  text?: string | null;
  created_at: string;
};

function qs(obj: Record<string, any>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || String(v) === '') continue;
    p.set(k, String(v));
  }
  return p.toString();
}

function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function displayUser(tgId: string, username?: string | null) {
  if (username) return '@' + String(username).replace(/^@/, '');
  return `tg:${tgId}`;
}

function avatarLetter(username?: string | null, tgId?: string) {
  const s = (username || tgId || 'U').toString().trim();
  return (s[0] || 'U').toUpperCase();
}

export default function Customers() {
  const { appId } = useAppState() as any;
  const qc = useQueryClient();
  const { t } = useI18n();

  const [mode, setMode] = React.useState<'customers' | 'dialogs'>('customers');
  const [q, setQ] = React.useState('');
  const [range, setRange] = React.useState<'today' | '7d' | '30d' | 'all'>('30d');

  const [activeTgId, setActiveTgId] = React.useState<string>('');
  const [activeUsername, setActiveUsername] = React.useState<string | null>(null);

  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);

  // LEFT LIST
  const customersQ = useQuery({
    enabled: !!appId && mode === 'customers',
    queryKey: ['cust.search', appId, q],
    queryFn: () =>
      apiFetch<{ ok: true; customers: CabCustomer[] }>(
        `/api/cabinet/apps/${appId}/customers?${qs({ query: q, limit: 200 })}`
      ),
    staleTime: 10_000,
  });

  const dialogsQ = useQuery({
    enabled: !!appId && mode === 'dialogs',
    queryKey: ['dlg.list', appId, range],
    queryFn: () => apiFetch<{ ok: true; items: DialogRow[] }>(`/api/app/${appId}/dialogs?${qs({ range })}`),
    staleTime: 8_000,
  });

  const leftItems = React.useMemo(() => {
    if (mode === 'customers') {
      const arr = customersQ.data?.customers || [];
      return arr.map((x) => {
        const tgId = String(x.tg_user_id || '');
        return {
          kind: 'cust' as const,
          tgId,
          username: x.tg_username || null,
          last: null as string | null,
          meta: x.last_seen ? `${t('cust.lastSeen')}: ${fmtWhen(x.last_seen)}` : '—',
        };
      });
    }

    const arr = dialogsQ.data?.items || [];
    return arr.map((x) => {
      const tgId = String(x.tg_user_id || '');
      const seen = x.bot_last_seen || x.bot_started_at;
      return {
        kind: 'dlg' as const,
        tgId,
        username: x.tg_username || null,
        last: x.last_text || null,
        meta: seen ? fmtWhen(seen) : '—',
      };
    });
  }, [mode, customersQ.data, dialogsQ.data, t]);

  // RIGHT CHAT
  const msgsQ = useQuery({
    enabled: !!appId && !!activeTgId,
    queryKey: ['dlg.msgs', appId, activeTgId],
    queryFn: () =>
      apiFetch<{ ok: true; items: DialogMsg[] }>(`/api/app/${appId}/dialog/${activeTgId}?${qs({ limit: 120 })}`),
    staleTime: 2_000,
  });

  // auto pick first
  React.useEffect(() => {
    if (!activeTgId && leftItems.length) {
      const first = leftItems[0];
      setActiveTgId(first.tgId);
      setActiveUsername(first.username || null);
    }
  }, [leftItems.length]); // eslint-disable-line

  // autoscroll
  const chatRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgsQ.data?.items?.length, msgsQ.isFetching]);

  async function send() {
    if (!appId || !activeTgId) return;
    const v = text.trim();
    if (!v) return;

    setSending(true);
    try {
      await apiFetch(`/api/app/${appId}/dialog/${activeTgId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: v }),
      });

      setText('');
      await qc.invalidateQueries({ queryKey: ['dlg.msgs', appId, activeTgId] });
      await qc.invalidateQueries({ queryKey: ['dlg.list', appId] });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="sg-page cuPage">
      <div className="cuHead">
        <div>
          <h1 className="sg-h1">{t('nav.customers')}</h1>
          <div className="sg-sub">{t('cust.subtitle')}</div>
        </div>

        <div className="cuHeadRight">
          <div className="sg-tabs cuSegTabs">
            <button className={'sg-tab ' + (mode === 'customers' ? 'is-active' : '')} onClick={() => setMode('customers')}>
              {t('cust.mode.users')}
            </button>
            <button className={'sg-tab ' + (mode === 'dialogs' ? 'is-active' : '')} onClick={() => setMode('dialogs')}>
              {t('cust.mode.dialogs')}
            </button>
          </div>

          {mode === 'dialogs' && (
            <div className="sg-tabs cuSegTabs">
              <button className={'sg-tab ' + (range === 'today' ? 'is-active' : '')} onClick={() => setRange('today')}>
                {t('cust.range.today')}
              </button>
              <button className={'sg-tab ' + (range === '7d' ? 'is-active' : '')} onClick={() => setRange('7d')}>
                {t('cust.range.7d')}
              </button>
              <button className={'sg-tab ' + (range === '30d' ? 'is-active' : '')} onClick={() => setRange('30d')}>
                {t('cust.range.30d')}
              </button>
              <button className={'sg-tab ' + (range === 'all' ? 'is-active' : '')} onClick={() => setRange('all')}>
                {t('cust.range.all')}
              </button>
            </div>
          )}

          <div className="cuSearch">
            <Input
              value={q}
              onChange={(e: any) => setQ(e.target.value)}
              placeholder={mode === 'customers' ? t('cust.searchUsers') : t('cust.searchDialogsHint')}
              disabled={!appId}
            />
          </div>
        </div>
      </div>

      <div className="cuGrid">
        {/* LEFT */}
        <div className="cuLeft">
          <Card className="cuCard cuStickyList">
            <div className="cuCardHead">
              <div className="cuCardTitle">{mode === 'customers' ? t('cust.people') : t('cust.dialogs')}</div>
              <div className="cuCardSub">{leftItems.length ? t('cust.found', { n: leftItems.length }) : '—'}</div>
            </div>

            <div className="cuList">
              {mode === 'customers' && customersQ.isLoading && <div className="sg-muted">{t('common.loading')}</div>}
              {mode === 'dialogs' && dialogsQ.isLoading && <div className="sg-muted">{t('common.loading')}</div>}

              {mode === 'customers' && customersQ.isError && (
                <div className="sg-muted">
                  {t('common.error')}: {(customersQ.error as Error).message}
                </div>
              )}
              {mode === 'dialogs' && dialogsQ.isError && (
                <div className="sg-muted">
                  {t('common.error')}: {(dialogsQ.error as Error).message}
                </div>
              )}

              {!leftItems.length && !(customersQ.isLoading || dialogsQ.isLoading) && (
                <div className="sg-muted">{t('cust.empty')}</div>
              )}

              {leftItems.map((it) => {
                const active = activeTgId === it.tgId;
                return (
                  <button
                    key={it.kind + ':' + it.tgId}
                    type="button"
                    className={'cuRow ' + (active ? 'is-active' : '')}
                    onClick={() => {
                      setActiveTgId(it.tgId);
                      setActiveUsername(it.username || null);
                    }}
                  >
                    <div className="cuAvatar">
                      <div className="cuAvatarStub">{avatarLetter(it.username, it.tgId)}</div>
                    </div>

                    <div className="cuRowMid">
                      <div className="cuRowTop">
                        <div className="cuName">{displayUser(it.tgId, it.username)}</div>
                        {it.kind === 'cust' ? (
                          <div className="cuCoins" title="Coins">
                            {(() => {
                              const c = (customersQ.data?.customers || []).find((x) => String(x.tg_user_id) === it.tgId);
                              const coins = Number(c?.coins || 0);
                              return coins ? `${coins} 💠` : '';
                            })()}
                          </div>
                        ) : null}
                      </div>

                      <div className="cuMeta">
                        <span className="sg-muted">{it.last ? it.last : it.meta || '—'}</span>
                      </div>
                    </div>

                    <div className="cuRowRight">
                      <span className="cuBadge mid">{active ? '•' : ''}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="cuRight">
          <Card className="cuCard cuStickyProfile">
            <div className="cuCardHead">
              <div className="cuCardTitle">{activeTgId ? displayUser(activeTgId, activeUsername) : t('cust.pick')}</div>
              <div className="cuCardSub">{activeTgId ? `tg_id: ${activeTgId}` : '—'}</div>
            </div>

            <div className="cuBody">
              {!activeTgId ? (
                <div className="sg-muted">{t('cust.pickHint')}</div>
              ) : (
                <>
                  <div className="cuChat" ref={chatRef}>
                    {msgsQ.isLoading && <div className="sg-muted">{t('common.loading')}</div>}
                    {msgsQ.isError && (
                      <div className="sg-muted">
                        {t('common.error')}: {(msgsQ.error as Error).message}
                      </div>
                    )}

                    {!msgsQ.isLoading && !msgsQ.isError && !(msgsQ.data?.items || []).length && (
                      <div className="sg-muted">{t('cust.noMessages')}</div>
                    )}

                    {(msgsQ.data?.items || []).map((m) => (
                      <div key={m.id} className={'cuMsg ' + (m.direction === 'out' ? 'is-out' : 'is-in')}>
                        <div className="cuMsgBubble">
                          <div className="cuMsgText">{m.text || ''}</div>
                          <div className="cuMsgMeta sg-muted">{fmtWhen(m.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ height: 10 }} />

                  <div className="cuNoteComposer" style={{ marginTop: 0 }}>
                    <textarea
                      className="cuTextarea"
                      value={text}
                      onChange={(e: any) => setText(e.target.value)}
                      placeholder={t('cust.typeMessage')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    <div className="cuNoteActions">
                      <Button variant="secondary" onClick={() => msgsQ.refetch()} disabled={msgsQ.isFetching}>
                        {t('common.refresh')}
                      </Button>
                      <Button variant="primary" onClick={send} disabled={!text.trim() || sending}>
                        {sending ? t('common.sending') : t('cust.send')}
                      </Button>
                    </div>
                    <div className="sg-muted" style={{ fontSize: 11, marginTop: 6 }}>
                      {t('cust.tipCtrlEnter')}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
