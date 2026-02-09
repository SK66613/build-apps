// src/pages/Calendar.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Button, Input } from '../components/ui';

/** ===== Types ===== */
type Master = {
  id: string;
  title: string;
  active?: number;
};

type Service = {
  id: string;
  title: string;
  duration_min?: number;
  price?: number;
};

type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'done'
  | 'cancelled'
  | 'noshow';

type Appointment = {
  id: string;
  start_at: string; // ISO
  end_at: string;   // ISO
  master_id?: string | null;
  service_id?: string | null;

  client_name?: string | null;
  client_phone?: string | null;
  tg_id?: string | null;

  status: AppointmentStatus;
  price?: number | null;

  note?: string | null;
  source?: string | null; // tg/site/manual
  created_at?: string | null;
};

type CalendarResponse = {
  ok: true;
  masters: Master[];
  services: Service[];
  items: Appointment[];
};

type StatsResponse = {
  ok: true;
  // summary
  total: number;
  confirmed: number;
  arrived: number;
  done: number;
  cancelled: number;
  noshow: number;
  revenue_plan?: number;
  revenue_fact?: number;
  utilization?: number; // 0..100
};

type ActivityItem = {
  ts?: string;
  type?: string;
  label?: string;
  user?: string;
};

/** ===== Utils ===== */
function qs(obj: Record<string, any>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)){
    if (v === undefined || v === null || String(v) === '') continue;
    p.set(k, String(v));
  }
  return p.toString();
}
function clamp(n: number, a: number, b: number){ return Math.max(a, Math.min(b, n)); }
function fmtDate(d: Date){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function addDays(d: Date, days: number){
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function startOfWeek(d: Date){
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0,0,0,0);
  return x;
}
function hhmm(dateIso: string){
  const d = new Date(dateIso);
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${h}:${m}`;
}

/** ===== Tiny icons (same vibe as Wheel) ===== */
function IcoDay(){ return (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 4h10M4.5 2v3M11.5 2v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M3 6.5h10v7H3v-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
); }
function IcoWeek(){ return (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 4h10M4.5 2v3M11.5 2v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M3 6.5h10v7H3v-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M6 6.5v7M10 6.5v7" stroke="currentColor" strokeWidth="2"/>
  </svg>
); }
function IcoMonth(){ return (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 4h10M4.5 2v3M11.5 2v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M3 6.5h10v7H3v-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M3 9h10" stroke="currentColor" strokeWidth="2"/>
    <path d="M6 6.5v7M10 6.5v7" stroke="currentColor" strokeWidth="2" opacity=".35"/>
  </svg>
); }
function IcoList(){ return (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 4h10M4 8h10M4 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M2 4h.01M2 8h.01M2 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
); }

/** ===== Seg Tabs ===== */
function SegTabs(props: {
  value: string;
  onChange: (v: string) => void;
  items: Array<{ key: string; label: React.ReactNode }>;
  className?: string;
}){
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

/** ===== Main ===== */
export default function Calendar(){
  const { appId, range } = useAppState();
  const qc = useQueryClient();

  // View modes
  const [view, setView] = React.useState<'day'|'week'|'month'|'list'>('week');

  // Right panel tabs (как Wheel: маленькие режимы)
  const [sideTab, setSideTab] = React.useState<'summary'|'queue'|'conflicts'>('summary');

  // Filters/search
  const [q, setQ] = React.useState('');
  const [masterId, setMasterId] = React.useState<string>('');
  const [status, setStatus] = React.useState<string>('');
  const [source, setSource] = React.useState<string>('');

  // Selected appointment drawer
  const [selected, setSelected] = React.useState<Appointment | null>(null);

  // Focus date (независимо от range — удобно для day/week переключений)
  const [focusDate, setFocusDate] = React.useState(() => {
    // если range.from есть — используем его, иначе today
    const base = range?.from ? new Date(range.from) : new Date();
    base.setHours(0,0,0,0);
    return base;
  });

  // Compute window for view
  const windowFromTo = React.useMemo(() => {
    const d = new Date(focusDate);
    if (view === 'day'){
      const from = fmtDate(d);
      const to = fmtDate(addDays(d, 1));
      return { from, to };
    }
    if (view === 'week'){
      const s = startOfWeek(d);
      const from = fmtDate(s);
      const to = fmtDate(addDays(s, 7));
      return { from, to };
    }
    if (view === 'month'){
      const s = new Date(d.getFullYear(), d.getMonth(), 1);
      const e = new Date(d.getFullYear(), d.getMonth()+1, 1);
      return { from: fmtDate(s), to: fmtDate(e) };
    }
    // list view — берем range из appState
    return { from: range.from, to: range.to };
  }, [focusDate, view, range.from, range.to]);

  const qCal = useQuery({
    enabled: !!appId,
    queryKey: ['calendar', appId, view, windowFromTo.from, windowFromTo.to, q, masterId, status, source],
    queryFn: () => apiFetch<CalendarResponse>(
      `/api/cabinet/apps/${appId}/calendar?` + qs({
        from: windowFromTo.from,
        to: windowFromTo.to,
        q,
        master_id: masterId || undefined,
        status: status || undefined,
        source: source || undefined,
      })
    ),
    staleTime: 8_000,
  });

  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['calendar.stats', appId, windowFromTo.from, windowFromTo.to, masterId],
    queryFn: () => apiFetch<StatsResponse>(
      `/api/cabinet/apps/${appId}/calendar/stats?` + qs({
        from: windowFromTo.from,
        to: windowFromTo.to,
        master_id: masterId || undefined,
      })
    ),
    staleTime: 10_000,
  });

  const qActivity = useQuery({
    enabled: !!appId && sideTab !== 'summary',
    queryKey: ['calendar.activity', appId, windowFromTo.from, windowFromTo.to, sideTab],
    queryFn: () => apiFetch<{ ok: true; items: ActivityItem[] }>(
      `/api/cabinet/apps/${appId}/activity?` + qs({ from: windowFromTo.from, to: windowFromTo.to })
    ),
    refetchInterval: 8_000,
    retry: 0,
  });

  const masters = qCal.data?.masters || [];
  const services = qCal.data?.services || [];
  const items = qCal.data?.items || [];

  // Derived: top next appointment (for right panel)
  const nextAppt = React.useMemo(() => {
    const now = Date.now();
    const sorted = [...items].sort((a,b) => +new Date(a.start_at) - +new Date(b.start_at));
    return sorted.find(x => +new Date(x.end_at) >= now) || sorted[0] || null;
  }, [items]);

  function navPrev(){
    setFocusDate(d => {
      if (view === 'day') return addDays(d, -1);
      if (view === 'week') return addDays(d, -7);
      if (view === 'month') return new Date(d.getFullYear(), d.getMonth()-1, 1);
      return addDays(d, -7);
    });
  }
  function navNext(){
    setFocusDate(d => {
      if (view === 'day') return addDays(d, 1);
      if (view === 'week') return addDays(d, 7);
      if (view === 'month') return new Date(d.getFullYear(), d.getMonth()+1, 1);
      return addDays(d, 7);
    });
  }
  function navToday(){
    const t = new Date(); t.setHours(0,0,0,0);
    setFocusDate(t);
  }

  return (
    <div className="sg-page calPage">
      {/* ===== Header ===== */}
      <div className="calHead">
        <div>
          <h1 className="sg-h1">Calendar</h1>
          <div className="sg-sub">Универсальная CRM-запись: расписание + карточка клиента + сводка.</div>
        </div>

        <div className="calHeadRight">
          <Button onClick={navPrev}>←</Button>
          <Button onClick={navToday}>Сегодня</Button>
          <Button onClick={navNext}>→</Button>

          <Button variant="primary" onClick={() => alert('TODO: open create modal')}>
            + Запись
          </Button>
        </div>
      </div>

      {/* ===== Toolbar (sticky) ===== */}
      <Card className="calToolbar">
        <div className="calToolbarRow">
          <div className="calSearch">
            <Input value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="Поиск: клиент / телефон / услуга / заметка" />
          </div>

          <div className="calFilters">
            <select className="calSelect" value={masterId} onChange={(e) => setMasterId(e.target.value)}>
              <option value="">Все мастера</option>
              {masters.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>

            <select className="calSelect" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="arrived">arrived</option>
              <option value="done">done</option>
              <option value="cancelled">cancelled</option>
              <option value="noshow">noshow</option>
            </select>

            <select className="calSelect" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Все источники</option>
              <option value="tg">tg</option>
              <option value="site">site</option>
              <option value="manual">manual</option>
            </select>
          </div>

          <SegTabs
            value={view}
            onChange={(v) => setView(v as any)}
            items={[
              { key: 'day', label: <span className="calTabI"><IcoDay/> День</span> },
              { key: 'week', label: <span className="calTabI"><IcoWeek/> Неделя</span> },
              { key: 'month', label: <span className="calTabI"><IcoMonth/> Месяц</span> },
              { key: 'list', label: <span className="calTabI"><IcoList/> Список</span> },
            ]}
            className="calViewTabs"
          />
        </div>
      </Card>

      {/* ===== 2 columns (like Wheel) ===== */}
      <div className="calGrid">
        {/* LEFT MAIN */}
        <div className="calLeft">
          <Card className="calMainCard">
            <div className="calMainHead">
              <div>
                <div className="calMainTitle">
                  {view === 'day' ? 'День' : view === 'week' ? 'Неделя' : view === 'month' ? 'Месяц' : 'Список'}
                </div>
                <div className="calMainSub">{windowFromTo.from} — {windowFromTo.to}</div>
              </div>

              <div className="calLegend">
                <span className="calDot pending"/> pending
                <span className="calDot confirmed"/> confirmed
                <span className="calDot arrived"/> arrived
                <span className="calDot done"/> done
                <span className="calDot cancelled"/> cancelled
                <span className="calDot noshow"/> noshow
              </div>
            </div>

            {/* CONTENT */}
            <div className="calMainBody">
              {qCal.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qCal.isError && <div className="sg-muted">Ошибка: {(qCal.error as Error).message}</div>}

              {!qCal.isLoading && !qCal.isError && (
                <>
                  {view === 'list' ? (
                    <div className="calList">
                      {items.length ? items.map(a => (
                        <button
                          key={a.id}
                          className={'calListRow st-' + a.status}
                          onClick={() => setSelected(a)}
                          type="button"
                        >
                          <div className="calListTime">{hhmm(a.start_at)}–{hhmm(a.end_at)}</div>
                          <div className="calListMid">
                            <div className="calListTitle">
                              {a.client_name || 'Клиент'} • {a.service_id ? (services.find(s=>s.id===a.service_id)?.title || 'Услуга') : 'Услуга'}
                            </div>
                            <div className="calListSub">
                              {a.master_id ? (masters.find(m=>m.id===a.master_id)?.title || 'Мастер') : '—'}
                              {a.source ? ` • ${a.source}` : ''}
                              {a.note ? ` • ${a.note}` : ''}
                            </div>
                          </div>
                          <div className="calListRight">
                            <div className="calStatusPill">{a.status}</div>
                            <div className="calListPrice">{a.price ? `${a.price}` : ''}</div>
                          </div>
                        </button>
                      )) : (
                        <div className="sg-muted">Пока пусто.</div>
                      )}
                    </div>
                  ) : (
                    <div className="calTimeline">
                      {/* v1: простой таймлайн без dnd, карточки списком по времени */}
                      {items.length ? items
                        .slice()
                        .sort((a,b) => +new Date(a.start_at) - +new Date(b.start_at))
                        .map(a => (
                          <button
                            key={a.id}
                            className={'calAppt st-' + a.status}
                            onClick={() => setSelected(a)}
                            type="button"
                          >
                            <div className="calApptLeft">
                              <div className="calApptTime">{hhmm(a.start_at)}–{hhmm(a.end_at)}</div>
                              <div className="calApptMeta">
                                {a.master_id ? (masters.find(m=>m.id===a.master_id)?.title || 'Мастер') : '—'}
                                {a.source ? ` • ${a.source}` : ''}
                              </div>
                            </div>

                            <div className="calApptMid">
                              <div className="calApptTitle">{a.client_name || 'Клиент'}</div>
                              <div className="calApptSub">
                                {a.service_id ? (services.find(s=>s.id===a.service_id)?.title || 'Услуга') : 'Услуга'}
                                {a.note ? ` • ${a.note}` : ''}
                              </div>
                              <div className="calApptBadges">
                                <span className="calStatusPill">{a.status}</span>
                                {a.price ? <span className="calMoneyPill">{a.price}</span> : null}
                              </div>
                            </div>
                          </button>
                        )) : (
                          <div className="sg-muted">Нет записей в выбранном окне.</div>
                        )
                      }
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT SIDEBAR (sticky) */}
        <div className="calRight">
          <Card className="calSideCard calSideSticky">
            <div className="calSideHead">
              <div className="calSideTitle">Панель</div>

              <SegTabs
                value={sideTab}
                onChange={(v) => setSideTab(v as any)}
                items={[
                  { key: 'summary', label: 'Сводка' },
                  { key: 'queue', label: 'Очередь' },
                  { key: 'conflicts', label: 'Конфликты' },
                ]}
                className="calSideTabs"
              />
            </div>

            <div className="calSideBody">
              {sideTab === 'summary' && (
                <>
                  <div className="calSumTiles">
                    <div className="calTile">
                      <div className="calTileLbl">Всего</div>
                      <div className="calTileVal">{qStats.data?.total ?? '—'}</div>
                    </div>
                    <div className="calTile">
                      <div className="calTileLbl">Подтв.</div>
                      <div className="calTileVal">{qStats.data?.confirmed ?? '—'}</div>
                    </div>
                    <div className="calTile calTileStrong">
                      <div className="calTileLbl">Выручка</div>
                      <div className="calTileVal">{qStats.data?.revenue_fact ?? '—'}</div>
                    </div>
                  </div>

                  <div className="calBarBox">
                    <div className="calBarTop">
                      <div className="calBarName">Загрузка</div>
                      <div className="calBadge">
                        {clamp(Number(qStats.data?.utilization ?? 0), 0, 100)}%
                      </div>
                    </div>
                    <div className="calBarTrack">
                      <div
                        className="calBarFill"
                        style={{ width: `${clamp(Number(qStats.data?.utilization ?? 0), 0, 100)}%` }}
                      />
                    </div>
                    <div className="calBarMeta">
                      <span className="sg-muted">done: <b>{qStats.data?.done ?? '—'}</b></span>
                      <span className="sg-muted">no-show: <b>{qStats.data?.noshow ?? '—'}</b></span>
                    </div>
                  </div>

                  <div className="calNextBox">
                    <div className="calNextTitle">Следующая запись</div>
                    {nextAppt ? (
                      <>
                        <div className="calNextRow">
                          <div className="calNextWho">{nextAppt.client_name || 'Клиент'}</div>
                          <div className="calStatusPill">{nextAppt.status}</div>
                        </div>
                        <div className="calNextSub">
                          {hhmm(nextAppt.start_at)} • {nextAppt.master_id ? (masters.find(m=>m.id===nextAppt.master_id)?.title || 'Мастер') : '—'}
                        </div>
                        <div className="calNextActions">
                          <Button onClick={() => alert('TODO confirm')}>Подтвердить</Button>
                          <Button onClick={() => alert('TODO remind')}>Напомнить</Button>
                          <Button onClick={() => setSelected(nextAppt)}>Открыть</Button>
                        </div>
                      </>
                    ) : (
                      <div className="sg-muted">Нет ближайших записей.</div>
                    )}
                  </div>
                </>
              )}

              {sideTab !== 'summary' && (
                <>
                  <div className="calLiveHead">
                    <div className="calLiveTitle">{sideTab === 'queue' ? 'Очередь/события' : 'Конфликты/риски'}</div>
                    <div className="sg-pill" style={{ padding: '8px 12px' }}>
                      {qActivity.isFetching ? 'обновляю…' : 'готово'}
                    </div>
                  </div>

                  {qActivity.isLoading && <div className="sg-muted">Загрузка…</div>}
                  {qActivity.isError && <div className="sg-muted">Ошибка: {(qActivity.error as Error).message}</div>}

                  {!qActivity.isLoading && !qActivity.isError && (
                    <div className="calLiveList">
                      {(qActivity.data?.items || []).slice(0, 16).map((e, i) => (
                        <div key={i} className="calLiveRow">
                          <div className="calLiveType">{e.type || 'event'}</div>
                          <div className="calLiveLabel">{e.label || e.user || '—'}</div>
                          <div className="calLiveTs">{e.ts || ''}</div>
                        </div>
                      ))}
                      {!(qActivity.data?.items || []).length && <div className="sg-muted">Пока пусто.</div>}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Drawer / modal skeleton (v1 simple) */}
          {selected && (
            <div className="calDrawerBack" onClick={() => setSelected(null)} role="presentation">
              <div className="calDrawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="calDrawerHead">
                  <div>
                    <div className="calDrawerTitle">{selected.client_name || 'Клиент'}</div>
                    <div className="calDrawerSub">
                      {hhmm(selected.start_at)}–{hhmm(selected.end_at)} • {selected.status}
                    </div>
                  </div>
                  <Button onClick={() => setSelected(null)}>✕</Button>
                </div>

                <div className="calDrawerBody">
                  <div className="calDrawerGrid">
                    <div className="calDrawerField">
                      <div className="calFieldLbl">Телефон</div>
                      <div className="calFieldVal">{selected.client_phone || '—'}</div>
                    </div>
                    <div className="calDrawerField">
                      <div className="calFieldLbl">Источник</div>
                      <div className="calFieldVal">{selected.source || '—'}</div>
                    </div>
                    <div className="calDrawerField">
                      <div className="calFieldLbl">Мастер</div>
                      <div className="calFieldVal">{selected.master_id ? (masters.find(m=>m.id===selected.master_id)?.title || '—') : '—'}</div>
                    </div>
                    <div className="calDrawerField">
                      <div className="calFieldLbl">Услуга</div>
                      <div className="calFieldVal">{selected.service_id ? (services.find(s=>s.id===selected.service_id)?.title || '—') : '—'}</div>
                    </div>
                  </div>

                  {selected.note ? (
                    <div className="calNoteBox">
                      <div className="calFieldLbl">Заметка</div>
                      <div className="calNoteText">{selected.note}</div>
                    </div>
                  ) : null}

                  <div className="calDrawerActions">
                    <Button onClick={() => alert('TODO set status confirmed')}>Подтвердить</Button>
                    <Button onClick={() => alert('TODO arrived')}>Пришёл</Button>
                    <Button onClick={() => alert('TODO done')}>Закрыть</Button>
                    <Button onClick={() => alert('TODO cancel')}>Отменить</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
