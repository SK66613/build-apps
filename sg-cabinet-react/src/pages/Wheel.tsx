import React from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';

type PrizeStat = {
  prize_code: string;
  title: string;
  wins: number;
  redeemed: number;
  cost?: number;
  weight?: number;
  active?: number;
};

type WheelStatsResponse = { ok: true; items: PrizeStat[] };

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

function pct(n: number, d: number) {
  if (!d) return '0%';
  return Math.round((n / d) * 100) + '%';
}

/** маленькие иконки, чтобы табы выглядели богаче (без либ) */
function IcoBars() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 13V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 13V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 13V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IcoLine() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IcoArea() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 11l4-4 3 3 5-6v10H2V11z" fill="currentColor" opacity="0.18" />
      <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 14h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SegTabs(props: {
  value: string;
  onChange: (v: string) => void;
  items: Array<{ key: string; label: React.ReactNode }>;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={props.className || ''} style={{ display: 'flex', gap: 10 }}>
      <div className="sg-tabs" style={props.dense ? { padding: 5, gap: 8 } : undefined}>
        {props.items.map((it) => (
          <button
            key={it.key}
            type="button"
            className={'sg-tab' + (props.value === it.key ? ' is-active' : '')}
            onClick={() => props.onChange(it.key)}
            style={props.dense ? { padding: '9px 10px' } : undefined}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Wheel() {
  const { appId, range } = useAppState();
  const qc = useQueryClient();

  const [mode, setMode] = React.useState<'stats' | 'live' | 'settings'>('stats');
  const [chartType, setChartType] = React.useState<'bar' | 'line' | 'area'>('bar');

  // ===== STATS (всегда грузим, это и для Settings нужно)
  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () => apiFetch<WheelStatsResponse>(`/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`),
    staleTime: 10_000,
  });

  const items = qStats.data?.items || [];

  // ===== LIVE (включаем только когда пользователь реально в режиме live)
  const qLive = useQuery({
    enabled: !!appId && mode === 'live',
    queryKey: ['wheel.live', appId, range.from, range.to],
    queryFn: () => apiFetch<any>(`/api/cabinet/apps/${appId}/wheel/live?${qs(range)}`),
    refetchInterval: 6_000,
    retry: 0,
  });

  // ===== local form for SETTINGS (weights/active)
  const [draft, setDraft] = React.useState<Record<string, { weight: string; active: boolean }>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string>('');

  React.useEffect(() => {
    const list = items;
    if (!list.length) return;

    setDraft((prev) => {
      const next = { ...prev };
      for (const p of list) {
        const key = p.prize_code;
        if (!key) continue;
        if (next[key] === undefined) {
          next[key] = {
            weight: (p.weight ?? '') === null || (p.weight ?? '') === undefined ? '' : String(p.weight),
            active: !!p.active,
          };
        }
      }
      return next;
    });
  }, [qStats.data?.items]);

  function setWeight(code: string, v: string) {
    setDraft((d) => ({ ...d, [code]: { weight: v, active: !!d[code]?.active } }));
  }
  function toggleActive(code: string) {
    setDraft((d) => ({ ...d, [code]: { weight: d[code]?.weight ?? '', active: !d[code]?.active } }));
  }

  async function save() {
    if (!appId) return;
    setSaveMsg('');

    const payloadItems = items
      .map((p) => {
        const code = p.prize_code;
        const d = draft[code];
        if (!d) return null;

        const weight = Math.max(0, toInt(d.weight, 0));
        const active = d.active ? 1 : 0;

        return { prize_code: code, weight, active };
      })
      .filter(Boolean) as Array<{ prize_code: string; weight: number; active: 0 | 1 }>;

    if (!payloadItems.length) {
      setSaveMsg('Нечего сохранять.');
      return;
    }

    setSaving(true);
    try {
      const r = await apiFetch<{ ok: true; updated: number }>(`/api/cabinet/apps/${appId}/wheel/prizes`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      });

      setSaveMsg(`Сохранено: ${r.updated}`);
      await qc.invalidateQueries({ queryKey: ['wheel', appId] });
    } catch (e: any) {
      setSaveMsg('Ошибка сохранения: ' + String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  // ===== Derived stats
  const totalWins = items.reduce((s, x) => s + (Number(x.wins) || 0), 0);
  const totalRedeemed = items.reduce((s, x) => s + (Number(x.redeemed) || 0), 0);
  const redeemRate = pct(totalRedeemed, totalWins);

  const top = [...items].sort((a, b) => (b.wins || 0) - (a.wins || 0)).slice(0, 7);

  const chartData = items.map((p) => ({
    name: p.title || p.prize_code,
    wins: Number(p.wins) || 0,
    redeemed: Number(p.redeemed) || 0,
  }));

  const ModeTabs = (
    <SegTabs
      value={mode}
      onChange={(v) => setMode(v as any)}
      items={[
        { key: 'stats', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Статистика</span> },
        { key: 'live', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Live</span> },
        { key: 'settings', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Настройки</span> },
      ]}
    />
  );

  const ChartTypeTabs = (
    <SegTabs
      dense
      value={chartType}
      onChange={(v) => setChartType(v as any)}
      items={[
        { key: 'bar', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IcoBars /> Столбцы</span> },
        { key: 'line', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IcoLine /> Линия</span> },
        { key: 'area', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IcoArea /> Area</span> },
      ]}
    />
  );

  return (
    <div
      className="sg-grid"
      style={{
        gap: 14,
        gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
        alignItems: 'start',
        ...( { ['--chart-1' as any]: '#22d3ee', ['--chart-2' as any]: '#3b82f6' } ),
      }}
    >
      {/* LEFT */}
      <div className="sg-grid" style={{ gridTemplateColumns: '1fr', gap: 14 }}>
        {/* header + mode tabs */}
        <div className="sg-grid" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
          <div>
            <h1 className="sg-h1">Wheel</h1>
            <div className="sg-sub">График + KPI + топы + live + настройка весов (runtime override).</div>
          </div>
          {ModeTabs}
        </div>

        {/* ===== MODE: STATS ===== */}
        {mode === 'stats' && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>Распределение призов</div>
                <div className="sg-muted" style={{ marginTop: 4 }}>
                  {range?.from} — {range?.to}
                </div>
              </div>
            </div>

            {/* CHART WRAP (tabs overlay here) */}
            <div style={{ position: 'relative', marginTop: 12 }}>
              {/* tabs on the chart (top-right) */}
              <div
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 10,
                  zIndex: 5,
                }}
              >
                {ChartTypeTabs}
              </div>

              {qStats.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qStats.isError && <div className="sg-muted">Ошибка: {(qStats.error as Error).message}</div>}

              {!qStats.isLoading && !qStats.isError && (
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={chartData} barCategoryGap={18}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={46} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="wins" fill="var(--chart-1)" radius={[10, 10, 4, 4]} />
                        <Bar dataKey="redeemed" fill="var(--chart-2)" radius={[10, 10, 4, 4]} />
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={46} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="wins" stroke="var(--chart-1)" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="redeemed" stroke="var(--chart-2)" strokeWidth={3} dot={false} />
                      </LineChart>
                    ) : (
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={46} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="wins" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.16} strokeWidth={3} />
                        <Area type="monotone" dataKey="redeemed" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.14} strokeWidth={3} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* KPI under chart */}
            <div
              className="sg-grid"
              style={{
                marginTop: 12,
                gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                gap: 12,
              }}
            >
              <div className="sg-card" style={{ padding: 12, boxShadow: 'none' }}>
                <div className="sg-muted" style={{ fontWeight: 900 }}>Wins</div>
                <div style={{ fontSize: 20, fontWeight: 1000, marginTop: 2 }}>{totalWins}</div>
              </div>
              <div className="sg-card" style={{ padding: 12, boxShadow: 'none' }}>
                <div className="sg-muted" style={{ fontWeight: 900 }}>Redeemed</div>
                <div style={{ fontSize: 20, fontWeight: 1000, marginTop: 2 }}>{totalRedeemed}</div>
              </div>
              <div className="sg-card" style={{ padding: 12, boxShadow: 'none' }}>
                <div className="sg-muted" style={{ fontWeight: 900 }}>Redeem rate</div>
                <div style={{ fontSize: 20, fontWeight: 1000, marginTop: 2 }}>{redeemRate}</div>
              </div>
            </div>
          </Card>
        )}

        {/* ===== MODE: LIVE ===== */}
        {mode === 'live' && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 950 }}>Live (последние события)</div>
                <div className="sg-muted" style={{ marginTop: 4 }}>auto refresh</div>
              </div>
              <div className="sg-pill" style={{ padding: '8px 12px' }}>
                {qLive.isFetching ? 'обновляю…' : 'готово'}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {!appId && <div className="sg-muted">Выбери проект.</div>}
              {appId && qLive.isLoading && <div className="sg-muted">Загрузка…</div>}
              {appId && qLive.isError && (
                <div className="sg-muted">
                  Ошибка: {(qLive.error as Error).message || 'Not found'}
                  <div style={{ marginTop: 8, opacity: 0.8 }}>
                    Если эндпоинт другой — поменяй URL в Wheel.tsx: <code>/wheel/live</code>
                  </div>
                </div>
              )}
              {appId && qLive.data && (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(qLive.data, null, 2)}
                </pre>
              )}
              {appId && !qLive.isLoading && !qLive.isError && !qLive.data && (
                <div className="sg-muted">Пока пусто.</div>
              )}
            </div>
          </Card>
        )}

        {/* ===== MODE: SETTINGS ===== */}
        {mode === 'settings' && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 950 }}>Настройки (runtime override)</div>
                <div className="sg-muted" style={{ marginTop: 4 }}>
                  Меняешь <b>weight/active</b> — сохраняешь — воркер применяет в рантайме.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {saveMsg && <div style={{ fontWeight: 900, opacity: 0.8 }}>{saveMsg}</div>}
                <Button variant="primary" disabled={saving || qStats.isLoading || !appId} onClick={save}>
                  {saving ? 'Сохраняю…' : 'Сохранить изменения'}
                </Button>
              </div>
            </div>

            {qStats.isError && (
              <div style={{ marginTop: 10, fontWeight: 900 }}>
                Ошибка загрузки. Проверь эндпоинт <code>/wheel/stats</code> в воркере.
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
                  {items.map((p) => {
                    const d = draft[p.prize_code] || { weight: String(p.weight ?? ''), active: !!p.active };
                    return (
                      <tr key={p.prize_code}>
                        <td style={{ fontWeight: 900 }}>{p.prize_code}</td>
                        <td>{p.title}</td>
                        <td>{p.wins}</td>
                        <td>{p.redeemed}</td>
                        <td>
                          <Input
                            value={d.weight}
                            onChange={(e: any) => setWeight(p.prize_code, e.target.value)}
                            placeholder="weight"
                          />
                        </td>
                        <td>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input type="checkbox" checked={!!d.active} onChange={() => toggleActive(p.prize_code)} />
                            <span style={{ fontWeight: 900 }}>{d.active ? 'on' : 'off'}</span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                  {!items.length && !qStats.isLoading && (
                    <tr><td colSpan={6} style={{ opacity: 0.7, padding: 14 }}>Нет призов.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="sg-grid" style={{ gridTemplateColumns: '1fr', gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 950 }}>Топ призов</div>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {top.map((p, i) => (
              <div
                key={p.prize_code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 16,
                  border: '1px solid var(--border2)',
                  background: 'rgba(255,255,255,.55)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 28, height: 28,
                      borderRadius: 999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 1000,
                      border: '1px solid var(--border2)',
                      background: 'rgba(255,255,255,.9)',
                      flex: '0 0 auto',
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.title || p.prize_code}
                  </div>
                </div>
                <div style={{ fontWeight: 1000, opacity: 0.85 }}>{p.wins || 0}</div>
              </div>
            ))}
            {!top.length && <div className="sg-muted">Нет данных.</div>}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 950 }}>Сводка</div>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 850 }}>
              <span className="sg-muted">Активных призов</span>
              <span>{items.filter((x) => !!x.active).length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 850 }}>
              <span className="sg-muted">Всего призов</span>
              <span>{items.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 850 }}>
              <span className="sg-muted">Redeem rate</span>
              <span style={{ fontWeight: 1000 }}>{redeemRate}</span>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 950 }}>Идеи next widgets</div>
          <div className="sg-muted" style={{ marginTop: 10, fontWeight: 800, lineHeight: 1.55 }}>
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
