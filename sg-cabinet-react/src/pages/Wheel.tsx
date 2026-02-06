import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';
import type { ActivityItem } from '../lib/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type PrizeStat = {
  prize_code: string;
  title: string;
  wins: number;
  redeemed: number;
  cost?: number;
  weight?: number;
  active?: number;
};

type ChartMode = 'bar' | 'line' | 'area';
type TabMode = 'live' | 'settings';

function qs(obj: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}

function toInt(v: any, d = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.trunc(n);
}

function safeErr(e: any) {
  return String(e?.message || e || 'error');
}

export default function Wheel() {
  const { appId, range } = useAppState();
  const qc = useQueryClient();

  const [chartMode, setChartMode] = React.useState<ChartMode>('bar');
  const [tab, setTab] = React.useState<TabMode>('live');

  // ===== stats
  const statsQ = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range?.from, range?.to],
    queryFn: () =>
      apiFetch<{ ok: true; items: PrizeStat[] }>(
        `/api/cabinet/apps/${appId}/wheel/stats?${qs(range as any)}`
      ),
    staleTime: 10_000,
  });

  const items: PrizeStat[] = statsQ.data?.items || [];

  // ===== live feed (existing endpoint used in Live.tsx)
  const liveQ = useQuery({
    enabled: !!appId && tab === 'live',
    queryKey: ['activity', appId],
    queryFn: () =>
      apiFetch<{ ok: true; items: ActivityItem[] }>(
        `/api/cabinet/apps/${appId}/activity?limit=60`
      ),
    refetchInterval: tab === 'live' ? 8000 : false,
    staleTime: 0,
  });

  // ===== chart data
  const chartData = (items || []).map((p) => ({
    name: p.title || p.prize_code,
    wins: Number(p.wins || 0),
    redeemed: Number(p.redeemed || 0),
  }));

  const totals = React.useMemo(() => {
    let wins = 0;
    let redeemed = 0;
    for (const p of items) {
      wins += Number(p.wins || 0);
      redeemed += Number(p.redeemed || 0);
    }
    const redeemRate = wins > 0 ? Math.round((redeemed / wins) * 100) : 0;
    return { wins, redeemed, redeemRate };
  }, [items]);

  const topPrizes = React.useMemo(() => {
    return [...items]
      .sort((a, b) => Number(b.wins || 0) - Number(a.wins || 0))
      .slice(0, 5);
  }, [items]);

  // ===== settings draft
  const [draft, setDraft] = React.useState<Record<string, { weight: string; active: boolean }>>(
    {}
  );
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string>('');

  React.useEffect(() => {
    if (!items.length) return;

    setDraft((prev) => {
      // не затираем правки пользователя — добавляем только отсутствующие ключи
      const next = { ...prev };
      for (const p of items) {
        const key = p.prize_code;
        if (!key) continue;
        if (next[key] === undefined) {
          next[key] = {
            weight:
              (p.weight ?? '') === null || (p.weight ?? '') === undefined ? '' : String(p.weight),
            active: !!p.active,
          };
        }
      }
      return next;
    });
  }, [items]);

  function setWeight(code: string, v: string) {
    setDraft((d) => {
      const cur = d[code];
      // если записи ещё нет — берём active из items (чтобы не сбрасывать)
      const fallbackActive = (() => {
        const it = items.find((x) => x.prize_code === code);
        return it ? !!it.active : true;
      })();
      return { ...d, [code]: { weight: v, active: cur ? cur.active : fallbackActive } };
    });
  }

  function toggleActive(code: string) {
    setDraft((d) => {
      const cur = d[code];
      const fallbackWeight = (() => {
        const it = items.find((x) => x.prize_code === code);
        return it ? String(it.weight ?? '') : '';
      })();
      return {
        ...d,
        [code]: {
          weight: cur ? cur.weight : fallbackWeight,
          active: !(cur ? cur.active : false),
        },
      };
    });
  }

  async function save() {
    if (!appId) return;
    setSaveMsg('');

    const payloadItems = items
      .map((p) => {
        const code = p.prize_code;
        const d = draft[code];
        if (!code || !d) return null;
        const weight = Math.max(0, toInt(d.weight, 0));
        const active = d.active ? 1 : 0;
        return { prize_code: code, weight, active: active as 0 | 1 };
      })
      .filter(Boolean) as Array<{ prize_code: string; weight: number; active: 0 | 1 }>;

    if (!payloadItems.length) {
      setSaveMsg('Нечего сохранять.');
      return;
    }

    setSaving(true);
    try {
      const r = await apiFetch<{ ok: true; updated: number }>(
        `/api/cabinet/apps/${appId}/wheel/prizes`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items: payloadItems }),
        }
      );

      setSaveMsg(`Сохранено: ${r.updated ?? payloadItems.length}`);
      // гарантированно обновим wheel stats
      await qc.invalidateQueries({ queryKey: ['wheel', appId], exact: false });
    } catch (e: any) {
      setSaveMsg('Ошибка сохранения: ' + safeErr(e));
    } finally {
      setSaving(false);
    }
  }

  // ===== UI helpers
  const SegBtn = ({
    active,
    children,
    onClick,
  }: {
    active?: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <Button
      variant={active ? 'primary' : 'default'}
      onClick={onClick}
      style={{ padding: '10px 12px', borderRadius: 999 }}
    >
      {children}
    </Button>
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="sg-h1">Wheel</h1>
          <div className="sg-sub">Ozon-стиль: график + KPI + топы + live + настройки весов.</div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SegBtn active={chartMode === 'bar'} onClick={() => setChartMode('bar')}>Столбцы</SegBtn>
          <SegBtn active={chartMode === 'line'} onClick={() => setChartMode('line')}>Линия</SegBtn>
          <SegBtn active={chartMode === 'area'} onClick={() => setChartMode('area')}>Area</SegBtn>
        </div>
      </div>

      {!appId && (
        <Card className="" style={{ padding: 14 }}>
          Выбери проект сверху
        </Card>
      )}

      {/* main grid: left chart + right cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {/* left: chart */}
        <Card className="" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <div style={{ fontWeight: 950 }}>Распределение призов</div>
            <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12 }}>
              {range?.from} → {range?.to}
            </div>
          </div>

          {statsQ.isLoading && <div style={{ marginTop: 10, color: 'var(--muted)', fontWeight: 800 }}>Загрузка…</div>}
          {statsQ.isError && (
            <div style={{ marginTop: 10, fontWeight: 900 }}>
              Ошибка: {safeErr(statsQ.error)}. Проверь <code>/wheel/stats</code> в воркере.
            </div>
          )}

          {!statsQ.isLoading && !statsQ.isError && (
            <div style={{ height: 320, marginTop: 10 }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'bar' ? (
                  <BarChart data={chartData} margin={{ left: 6, right: 10, top: 6, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="wins" />
                    <Bar dataKey="redeemed" />
                  </BarChart>
                ) : chartMode === 'line' ? (
                  <LineChart data={chartData} margin={{ left: 6, right: 10, top: 6, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="wins" dot={false} />
                    <Line type="monotone" dataKey="redeemed" dot={false} />
                  </LineChart>
                ) : (
                  <AreaChart data={chartData} margin={{ left: 6, right: 10, top: 6, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="wins" />
                    <Area type="monotone" dataKey="redeemed" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, marginTop: 12 }}>
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ color: 'var(--muted)', fontWeight: 900, fontSize: 12 }}>Wins</div>
              <div style={{ fontSize: 20, fontWeight: 1000, marginTop: 6 }}>{totals.wins || '—'}</div>
            </div>
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ color: 'var(--muted)', fontWeight: 900, fontSize: 12 }}>Redeemed</div>
              <div style={{ fontSize: 20, fontWeight: 1000, marginTop: 6 }}>{totals.redeemed || '—'}</div>
            </div>
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ color: 'var(--muted)', fontWeight: 900, fontSize: 12 }}>Redeem rate</div>
              <div style={{ fontSize: 20, fontWeight: 1000, marginTop: 6 }}>
                {totals.wins ? `${totals.redeemRate}%` : '—'}
              </div>
            </div>
          </div>
        </Card>

        {/* right: cards */}
        <div style={{ display: 'grid', gap: 14 }}>
          <Card className="" style={{ padding: 16 }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>ТОП призов</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {topPrizes.map((p, idx) => (
                <div key={p.prize_code || String(idx)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                    <div style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--card2)', fontWeight: 900 }}>
                      {idx + 1}
                    </div>
                    <div style={{ fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title || p.prize_code}
                    </div>
                  </div>
                  <div style={{ color: 'var(--muted)', fontWeight: 950 }}>{p.wins}</div>
                </div>
              ))}
              {!topPrizes.length && <div style={{ color: 'var(--muted)', fontWeight: 800 }}>Нет данных</div>}
            </div>
          </Card>

          <Card className="" style={{ padding: 16 }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Сводка</div>
            <div style={{ display: 'grid', gap: 10, fontWeight: 850 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Активных призов</span>
                <span style={{ fontWeight: 1000 }}>{items.filter((i) => !!i.active).length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Всего призов</span>
                <span style={{ fontWeight: 1000 }}>{items.length || '—'}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Redeem rate</span>
                <span style={{ fontWeight: 1000 }}>{totals.wins ? `${totals.redeemRate}%` : '—'}</span>
              </div>
            </div>
          </Card>

          <Card className="" style={{ padding: 16 }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Режим</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <Button variant={tab === 'live' ? 'primary' : 'default'} onClick={() => setTab('live')}>Live</Button>
              <Button variant={tab === 'settings' ? 'primary' : 'default'} onClick={() => setTab('settings')}>Настройки / Веса</Button>
            </div>
          </Card>
        </div>
      </div>

      {/* bottom area: live / settings */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <Card className="" style={{ padding: 16 }}>
          {tab === 'live' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <div style={{ fontWeight: 950 }}>Live (последние события)</div>
                <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12 }}>
                  {liveQ.isFetching ? 'обновляю…' : 'auto refresh'}
                </div>
              </div>

              {liveQ.isLoading && <div style={{ marginTop: 10, color: 'var(--muted)', fontWeight: 800 }}>Загрузка…</div>}
              {liveQ.isError && <div style={{ marginTop: 10, fontWeight: 900 }}>Ошибка: {safeErr(liveQ.error)}</div>}

              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {(liveQ.data?.items || []).slice(0, 30).map((it, idx) => (
                  <div key={String((it as any).id ?? idx)} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontWeight: 950 }}>{(it as any).text || (it as any).type || 'event'}</div>
                      <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12 }}>{(it as any).ts || ''}</div>
                    </div>
                    {(((it as any).tg_id || (it as any).username) && (
                      <div style={{ marginTop: 6, color: 'var(--muted)', fontWeight: 800, fontSize: 12 }}>
                        {(it as any).username ? `@${(it as any).username}` : ''} {(it as any).tg_id ? `tg:${(it as any).tg_id}` : ''}
                      </div>
                    )) || null}
                  </div>
                ))}

                {!liveQ.isLoading && !(liveQ.data?.items || []).length && (
                  <div style={{ color: 'var(--muted)', fontWeight: 800 }}>Пока пусто</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 950 }}>Настройки (runtime override)</div>
                  <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12, marginTop: 4 }}>
                    Меняешь weight/active → сохраняешь → воркер применяет в рантайме.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {saveMsg && <div style={{ fontWeight: 850, color: 'var(--muted)' }}>{saveMsg}</div>}
                  <Button variant="primary" disabled={saving || statsQ.isLoading || !appId} onClick={save}>
                    {saving ? 'Сохраняю…' : 'Сохранить изменения'}
                  </Button>
                </div>
              </div>

              {statsQ.isError && (
                <div style={{ marginTop: 10, fontWeight: 900 }}>
                  Ошибка загрузки призов: {safeErr(statsQ.error)}.
                </div>
              )}

              <div style={{ overflow: 'auto', marginTop: 12 }}>
                <table className="sg-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Title</th>
                      <th>Wins</th>
                      <th>Redeemed</th>
                      <th style={{ minWidth: 180 }}>Weight</th>
                      <th style={{ minWidth: 120 }}>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p, idx) => {
                      const d = draft[p.prize_code] || { weight: String(p.weight ?? ''), active: !!p.active };
                      return (
                        <tr key={p.prize_code || String(idx)}>
                          <td>{p.prize_code}</td>
                          <td>{p.title}</td>
                          <td>{p.wins}</td>
                          <td>{p.redeemed}</td>
                          <td>
                            <Input value={d.weight} onChange={(e: any) => setWeight(p.prize_code, e.target.value)} placeholder="weight" />
                          </td>
                          <td>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input type="checkbox" checked={!!d.active} onChange={() => toggleActive(p.prize_code)} />
                              <span style={{ fontWeight: 800 }}>{d.active ? 'on' : 'off'}</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}

                    {!items.length && !statsQ.isLoading && (
                      <tr>
                        <td colSpan={6} style={{ opacity: 0.7, padding: 14 }}>
                          Нет призов.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <Card className="" style={{ padding: 16 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Идеи next widgets</div>
          <div style={{ color: 'var(--muted)', fontWeight: 800, lineHeight: 1.5 }}>
            • Себестоимость (cost) + ROI по колесу<br />
            • “Проблемные призы”: много wins, мало redeemed<br />
            • Авто-рекомендации по weight<br />
            • Блокировка “крутить”, если есть незабранный приз
          </div>
        </Card>
      </div>
    </div>
  );
}
