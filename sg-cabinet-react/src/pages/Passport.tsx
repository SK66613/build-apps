// src/pages/Passport.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppState } from '../app/appState';
import { apiFetch } from '../lib/api';
import { Card, Input, Button } from '../components/ui';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

/** ========= Types ========= */
type PassportSettings = {
  passport_key?: string;
  total_styles?: number;     // сколько всего "стилей" в паспорте
  require_pin?: number;      // 0|1
  passport_active?: number;  // 0|1
  show_offers?: number;      // 0|1
};

type PassportTimeseriesDay = {
  date: string; // YYYY-MM-DD
  steps: number;            // сколько раз добавили штамп (style.collect)
  active_users: number;     // уникальных tg_id за день
  completed: number;        // сколько закрыли паспорт (достигли total_styles) за день
  rewards_issued: number;   // сколько создали passport_rewards issued за день
  rewards_redeemed: number; // сколько подтверждено кассиром (если есть redeemed) за день
  pin_invalid: number;      // сколько ошибок pin_invalid за день
  pin_used: number;         // сколько ошибок pin_used за день
};

type PassportStyleStat = {
  style_id: string;
  title: string;
  collects: number;          // сколько собрали этот стиль
  unique_users: number;      // сколько уникальных пользователей собрали этот стиль
  missing_share_pct?: number; // опционально: “на этом стиле застревают”
};

/** ========= Utils ========= */
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

function clampN(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function fmtDDMM(iso: string) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}`;
}

function daysBetweenISO(fromISO: string, toISO: string) {
  try {
    const a = new Date(fromISO + 'T00:00:00Z').getTime();
    const b = new Date(toISO + 'T00:00:00Z').getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
    const diff = Math.abs(b - a);
    const days = Math.floor(diff / (24 * 3600 * 1000)) + 1;
    return Math.max(1, days);
  } catch (_) {
    return 1;
  }
}

function isoAddDays(iso: string, deltaDays: number) {
  try {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + deltaDays);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch (_) {
    return iso;
  }
}

function listDaysISO(fromISO: string, toISO: string) {
  const out: string[] = [];
  if (!fromISO || !toISO) return out;
  let cur = fromISO;
  for (let i = 0; i < 420; i++) {
    out.push(cur);
    if (cur === toISO) break;
    cur = isoAddDays(cur, 1);
  }
  return out;
}

function safeNum(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/* ==== Toggle (тумблер) ==== */
function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={'sgSwitch ' + (checked ? 'is-on' : 'is-off') + (disabled ? ' is-disabled' : '')}
      onClick={(e) => {
        if (disabled) return;
        try {
          (e.currentTarget as any).blur?.();
        } catch (_) {}
        onChange(!checked);
      }}
      aria-pressed={checked}
      aria-disabled={!!disabled}
    >
      <span className="sgSwitch__knob" />
    </button>
  );
}

/** ===== icons for chart buttons ===== */
function IcoSteps() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <path d="M4 12V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      <path d="M12 12V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}
function IcoUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.5 7.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" stroke="currentColor" strokeWidth="2" />
      <path
        d="M2.5 13c.6-2 2.3-3 4-3s3.4 1 4 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M11 8.2a1.7 1.7 0 1 0 0-3.4" stroke="currentColor" strokeWidth="2" opacity="0.55" />
      <path
        d="M11.7 10.3c1.1.4 2.1 1.2 2.6 2.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
function IcoDone() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.3 6.1 11.2 13 4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function toneBadge(pct: number) {
  const x = clampN(pct, 0, 100);
  if (x >= 70) return { text: 'ОК', cls: 'ok' };
  if (x >= 40) return { text: 'РИСК', cls: 'mid' };
  return { text: 'ПЛОХО', cls: 'bad' };
}

export default function Passport() {
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  // ===== Under-chart tabs =====
  const [tab, setTab] = React.useState<'summary' | 'boosts' | 'settings'>('summary');

  // ===== chart layers =====
  const [showSteps, setShowSteps] = React.useState(true);
  const [showUsers, setShowUsers] = React.useState(false);
  const [showCompleted, setShowCompleted] = React.useState(true);

  // ===== quick range =====
  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  React.useEffect(() => {
    setCustomFrom(range?.from || '');
    setCustomTo(range?.to || '');
    // quick intentionally untouched
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);

  function applyRange(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) return;
    if (typeof setRange === 'function') setRange({ from: nextFrom, to: nextTo });
  }

  function pickQuick(kind: 'day' | 'week' | 'month' | 'custom') {
    setQuick(kind);
    if (kind === 'custom') return;

    const anchor = range?.to || new Date().toISOString().slice(0, 10);
    if (kind === 'day') return applyRange(anchor, anchor);
    if (kind === 'week') return applyRange(isoAddDays(anchor, -6), anchor);
    if (kind === 'month') return applyRange(isoAddDays(anchor, -29), anchor);
  }

  // ===== settings =====
  const qSettings = useQuery({
    enabled: !!appId,
    queryKey: ['passport_settings', appId],
    queryFn: () => apiFetch<{ ok: true; settings: PassportSettings }>(`/api/cabinet/apps/${appId}/passport/settings`),
    staleTime: 30_000,
  });

  // ===== timeseries =====
  const qTs = useQuery({
    enabled: !!appId,
    queryKey: ['passport_ts', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; days: PassportTimeseriesDay[]; settings?: PassportSettings; meta?: any }>(
        `/api/cabinet/apps/${appId}/passport/timeseries?${qs(range)}`
      ),
    staleTime: 10_000,
  });

  // ===== per-style stats =====
  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['passport_stats', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; items: PassportStyleStat[]; meta?: any }>(
        `/api/cabinet/apps/${appId}/passport/stats?${qs(range)}`
      ),
    staleTime: 10_000,
  });

  const isLoading = qSettings.isLoading || qTs.isLoading || qStats.isLoading;
  const isError = qSettings.isError || qTs.isError || qStats.isError;

  const settings: PassportSettings = {
    ...(qSettings.data?.settings || {}),
    ...(qTs.data?.settings || {}),
  };

  const totalStyles = Math.max(0, toInt(settings.total_styles, 0));
  const requirePin = !!toInt(settings.require_pin, 0);
  const passportActive = toInt(settings.passport_active, 1) ? true : false;
  const showOffers = toInt(settings.show_offers, 1) ? true : false;

  // ===== chart series (fill missing days to keep stable) =====
  const series = React.useMemo(() => {
    const map = new Map<string, PassportTimeseriesDay>();
    for (const d of (qTs.data?.days || [])) {
      if (d?.date) map.set(String(d.date), d);
    }
    const dates = listDaysISO(range.from, range.to);

    return dates.map((iso) => {
      const r = map.get(iso);
      return {
        date: iso,
        steps: safeNum(r?.steps, 0),
        active_users: safeNum(r?.active_users, 0),
        completed: safeNum(r?.completed, 0),
        rewards_issued: safeNum(r?.rewards_issued, 0),
        rewards_redeemed: safeNum(r?.rewards_redeemed, 0),
        pin_invalid: safeNum(r?.pin_invalid, 0),
        pin_used: safeNum(r?.pin_used, 0),
      };
    });
  }, [qTs.data?.days, range.from, range.to]);

  // ===== facts totals =====
  const fact = React.useMemo(() => {
    const days = series || [];
    const steps = days.reduce((s, d) => s + safeNum((d as any).steps, 0), 0);
    const users = days.reduce((s, d) => s + safeNum((d as any).active_users, 0), 0);
    const completed = days.reduce((s, d) => s + safeNum((d as any).completed, 0), 0);
    const issued = days.reduce((s, d) => s + safeNum((d as any).rewards_issued, 0), 0);
    const redeemed = days.reduce((s, d) => s + safeNum((d as any).rewards_redeemed, 0), 0);
    const pin_invalid = days.reduce((s, d) => s + safeNum((d as any).pin_invalid, 0), 0);
    const pin_used = days.reduce((s, d) => s + safeNum((d as any).pin_used, 0), 0);

    // heuristics
    const activated = Math.max(users, 0); // в идеале: “users with first step”; пока proxy
    const completionRatePct = activated > 0 ? Math.round((completed / activated) * 100) : 0;
    const redeemRatePct = completed > 0 ? Math.round((redeemed / completed) * 100) : 0;

    return {
      steps,
      users,
      activated,
      completed,
      issued,
      redeemed,
      pin_invalid,
      pin_used,
      completionRatePct,
      redeemRatePct,
    };
  }, [series]);

  const period = React.useMemo(() => {
    const days = daysBetweenISO(range.from, range.to);
    const stepsPerDay = days > 0 ? fact.steps / days : 0;
    const usersPerDay = days > 0 ? fact.users / days : 0;
    const completedPerDay = days > 0 ? fact.completed / days : 0;
    return { days, stepsPerDay, usersPerDay, completedPerDay };
  }, [range.from, range.to, fact.steps, fact.users, fact.completed]);

  const completionTone = React.useMemo(() => toneBadge(fact.completionRatePct), [fact.completionRatePct]);
  const redeemTone = React.useMemo(() => toneBadge(fact.redeemRatePct), [fact.redeemRatePct]);

  // ===== right column: top styles =====
  const [topMetric, setTopMetric] = React.useState<'collects' | 'missing'>('collects');

  const styleItems = qStats.data?.items || [];

  const topStyles = React.useMemo(() => {
    const arr = [...styleItems];
    if (topMetric === 'collects') {
      arr.sort((a, b) => safeNum(b.collects, 0) - safeNum(a.collects, 0));
    } else {
      // missing = “провал”: если есть missing_share_pct используем его, иначе инвертируем collects
      arr.sort((a, b) => safeNum(b.missing_share_pct, 0) - safeNum(a.missing_share_pct, 0));
    }
    return arr.slice(0, 7);
  }, [styleItems, topMetric]);

  // ===== settings drafts (tab settings) =====
  const [activeDraft, setActiveDraft] = React.useState<boolean>(passportActive);
  const [pinDraft, setPinDraft] = React.useState<boolean>(requirePin);
  const [offersDraft, setOffersDraft] = React.useState<boolean>(showOffers);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [settingsMsg, setSettingsMsg] = React.useState('');

  React.useEffect(() => {
    setActiveDraft(passportActive);
    setPinDraft(requirePin);
    setOffersDraft(showOffers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportActive, requirePin, showOffers]);

  async function savePassportSettings() {
    if (!appId) return;
    setSettingsMsg('');
    setSavingSettings(true);
    try {
      await apiFetch(`/api/cabinet/apps/${appId}/passport/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          settings: {
            passport_active: activeDraft ? 1 : 0,
            require_pin: pinDraft ? 1 : 0,
            show_offers: offersDraft ? 1 : 0,
          },
        }),
      });
      setSettingsMsg('Сохранено');
      await qc.invalidateQueries({ queryKey: ['passport_settings', appId] });
      await qc.invalidateQueries({ queryKey: ['passport_ts', appId] });
      await qc.invalidateQueries({ queryKey: ['passport_stats', appId] });
    } catch (e: any) {
      setSettingsMsg('Ошибка: ' + String(e?.message || e));
    } finally {
      setSavingSettings(false);
    }
  }

  // ===== boosts tab: local templates (UI-first; backend can be added later) =====
  type BoostTpl = {
    id: string;
    title: string;
    enabled: boolean;
    ttl_hours: number;
    limit_per_user: number;
    hint: string;
  };

  const [boosts, setBoosts] = React.useState<BoostTpl[]>([
    {
      id: 'near_goal',
      title: 'Near-goal: осталось 1 — удвоение прогресса',
      enabled: true,
      ttl_hours: 24,
      limit_per_user: 1,
      hint: 'Если у пользователя осталось 1 стиль до завершения — он может активировать буст и получить x2 на следующий сбор.',
    },
    {
      id: 'comeback',
      title: 'Comeback: не был 7 дней — x2 на 48ч',
      enabled: false,
      ttl_hours: 48,
      limit_per_user: 1,
      hint: 'Возвращаем “уснувших”. Активируется кнопкой в сообщении бота.',
    },
    {
      id: 'happy_hour',
      title: 'Happy hour: x2 в выбранные часы',
      enabled: false,
      ttl_hours: 3,
      limit_per_user: 99,
      hint: 'Технически это “окно времени”: во время окна при collect применяем x2.',
    },
  ]);

  const [boostMsg, setBoostMsg] = React.useState<string>('');

  function patchBoost(id: string, patch: Partial<BoostTpl>) {
    setBoosts((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  async function saveBoostsMock() {
    // UI-first: чтобы страница уже работала без бекенда
    // Потом заменим на PUT /offers/templates
    setBoostMsg('Сохранено (пока локально). Следующий шаг — привязать к воркеру.');
    setTimeout(() => setBoostMsg(''), 2200);
  }

  return (
    <div className="sg-page passportPage">
      <style>{`
        :root{
          --sg-r-xl: 18px;
          --sg-r-lg: 16px;
          --sg-r-md: 14px;
          --sg-r-xs: 10px;
          --sg-bd: rgba(15,23,42,.10);
          --sg-bd2: rgba(15,23,42,.08);
          --sg-bg: rgba(255,255,255,.62);
          --sg-bg2: rgba(255,255,255,.78);
          --sg-in1: inset 0 1px 0 rgba(255,255,255,.55);
          --sg-sh1: 0 10px 24px rgba(15,23,42,.06);
        }

        /* quick range wrapper (same vibe as Wheel) */
        .psQuickWrap{
          display:flex; align-items:center; gap:0; flex-wrap:nowrap;
          height:46px;
          border:1px solid rgba(15,23,42,.12);
          border-radius:12px;
          background:rgba(255,255,255,.60);
          overflow:hidden;
        }
        .psQuickTabs{ border:0 !important; border-radius:0 !important; background:transparent !important; box-shadow:none !important; }
        .psQuickRange{
          display:flex; align-items:center; gap:8px;
          height:100%;
          padding:0 12px;
          border:0; background:transparent;
          position:relative;
        }
        .psQuickRange::before{
          content:"";
          position:absolute;
          left:0; top:50%;
          transform:translateY(-50%);
          height:26px; width:1px;
          background:rgba(15,23,42,.10);
        }
        .psQuickLbl{ font-weight:900; opacity:.75; font-size:12px; }

        .psQuickDate{
          width:150px;
          height:34px;
          padding:0 12px;
          box-sizing:border-box;
          border-radius:12px;
          border:1px solid rgba(15,23,42,.12);
          background:rgba(255,255,255,.90);
          font:inherit;
          font-weight:900;
          font-size:13px;
          font-variant-numeric:tabular-nums;
          line-height:32px;
          appearance:none;
          -webkit-appearance:none;
        }

        .psApplyBtn{
          height:34px;
          line-height:34px;
          padding:0 14px;
          margin-left:6px;
          border-radius:12px;
          font:inherit;
          font-weight:900;
          font-size:13px;
          white-space:nowrap;
        }
        .psApplyBtn:disabled{ opacity:.55; cursor:not-allowed; }

        @media (max-width:1100px){
          .psQuickWrap{ flex-wrap:wrap; height:auto; padding:6px; gap:10px; }
          .psQuickRange{ width:100%; height:auto; padding:6px 8px; }
          .psQuickRange::before{ display:none; }
        }

        /* chart wrapper */
        .psChartWrap{ position:relative; width:100%; height:320px; }
        .psChartOverlay{
          position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center;
          flex-direction:column; gap:10px;
          background:rgba(255,255,255,.0);
          pointer-events:none;
        }
        .psSpinner{
          width:26px; height:26px; border-radius:999px;
          border:3px solid rgba(15,23,42,.18);
          border-top-color: rgba(15,23,42,.55);
          animation: psSpin .8s linear infinite;
        }
        @keyframes psSpin{ from{ transform:rotate(0deg);} to{ transform:rotate(360deg);} }

        /* premium panels */
        .psUnderPanel{
          border:1px solid var(--sg-bd) !important;
          border-radius: var(--sg-r-xl) !important;
          background: var(--sg-bg) !important;
          box-shadow: var(--sg-sh1), var(--sg-in1) !important;
          padding:14px !important;
        }
        .psUnderHead{
          padding-bottom:10px;
          margin-bottom:12px;
          border-bottom:1px solid rgba(15,23,42,.08);
        }
        .sg-pill{
          border:1px solid var(--sg-bd2) !important;
          border-radius: var(--sg-r-lg) !important;
          background: var(--sg-bg2) !important;
          box-shadow: var(--sg-in1) !important;
        }

        /* small cards grid like Wheel */
        .psGrid2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media (max-width: 980px){ .psGrid2{ grid-template-columns:1fr; } }

        .psCard{ padding:12px 12px; }
        .psCardHead{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .psCardTitle{ font-weight:900; }

        .psRows{ display:flex; flex-direction:column; gap:8px; }
        .psRow{
          display:flex; align-items:baseline; justify-content:space-between; gap:10px;
          padding:8px 10px;
          border-radius:14px;
          border:1px solid rgba(15,23,42,.06);
          background:rgba(255,255,255,.55);
          box-shadow: var(--sg-in1);
        }

        .psBadge{
          display:inline-flex; align-items:center;
          height:22px; padding:0 10px;
          border-radius:999px;
          font-weight:900; font-size:12px;
          border:1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.78);
          box-shadow: var(--sg-in1);
        }
        .psBadge.ok{ background: rgba(34,197,94,.10); border-color: rgba(34,197,94,.20); }
        .psBadge.mid{ background: rgba(245,158,11,.10); border-color: rgba(245,158,11,.22); }
        .psBadge.bad{ background: rgba(239,68,68,.09); border-color: rgba(239,68,68,.20); }

        /* Switch (same as Wheel premium compact) */
        .sgSwitch{
          width:64px; height:28px; border-radius:999px;
          border:1px solid rgba(15,23,42,.10);
          background:rgba(15,23,42,.05);
          position:relative;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          justify-content:flex-start;
          padding:0 5px;
          box-shadow: var(--sg-in1);
          transition: background .12s ease, border-color .12s ease, opacity .12s ease, filter .12s ease;
        }
        .sgSwitch.is-on{
          background:rgba(34,197,94,.22);
          border-color:rgba(34,197,94,.26);
          justify-content:flex-end;
          filter:saturate(1.05);
        }
        .sgSwitch.is-off{
          background:rgba(239,68,68,.07);
          border-color:rgba(239,68,68,.14);
          filter:saturate(.92);
        }
        .sgSwitch.is-disabled{ opacity:.45; cursor:not-allowed; }
        .sgSwitch__knob{
          width:18px; height:18px; border-radius:999px;
          background:#fff;
          border:1px solid rgba(15,23,42,.12);
          box-shadow: 0 8px 16px rgba(15,23,42,.10);
        }

        /* chart buttons */
        .psChartBtns{ display:flex; gap:8px; flex-wrap:wrap; }
        .psChartBtn{
          height:32px;
          padding:0 10px;
          border-radius:12px;
          border:1px solid rgba(15,23,42,.10);
          background:rgba(255,255,255,.70);
          font-weight:900;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          gap:8px;
          opacity:.9;
          box-shadow: var(--sg-in1);
        }
        .psChartBtn:hover{ opacity:1; }
        .psChartBtn.is-active{
          border-color: rgba(15,23,42,.16);
          background: rgba(15,23,42,.04);
          box-shadow: 0 12px 22px rgba(15,23,42,.06), var(--sg-in1);
          opacity:1;
        }

        /* under tabs */
        .psUnderTabs{ margin-top:10px; }
        .psMuted{ opacity:.78; }

        /* right widgets */
        .psBarTrack{ height:10px; border-radius:999px; background:rgba(15,23,42,.06); overflow:hidden; }
        .psBarFill{ height:100%; border-radius:999px; background: var(--accent); opacity:.35; }
        .psRightMeta{ display:flex; gap:10px; flex-wrap:wrap; margin-top:8px; }
        .psTopList{ display:flex; flex-direction:column; gap:10px; }
        .psTopRow{
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          padding:10px 10px;
          border-radius:16px;
          border:1px solid rgba(15,23,42,.06);
          background:rgba(255,255,255,.62);
          box-shadow: var(--sg-in1);
        }
        .psTopTitle{ font-weight:900; }
        .psTopSub{ font-size:12px; opacity:.75; margin-top:4px; }
      `}</style>

      {/* ===== Head ===== */}
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Паспорт</h1>
          <div className="sg-sub">
            Факт по шагам (styles_user / pins_pool) + завершениям и наградам (passport_rewards). Бусты — отдельный слой.
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="psQuickWrap">
            <div className="sg-tabs wheelMiniTabs psQuickTabs">
              <button
                type="button"
                className={'sg-tab ' + (quick === 'day' ? 'is-active' : '')}
                onClick={() => pickQuick('day')}
              >
                День
              </button>
              <button
                type="button"
                className={'sg-tab ' + (quick === 'week' ? 'is-active' : '')}
                onClick={() => pickQuick('week')}
              >
                Неделя
              </button>
              <button
                type="button"
                className={'sg-tab ' + (quick === 'month' ? 'is-active' : '')}
                onClick={() => pickQuick('month')}
              >
                Месяц
              </button>
              <button
                type="button"
                className={'sg-tab ' + (quick === 'custom' ? 'is-active' : '')}
                onClick={() => pickQuick('custom')}
              >
                Свой период
              </button>
            </div>

            {quick === 'custom' && (
              <div className="psQuickRange">
                <span className="psQuickLbl">от</span>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e: any) => setCustomFrom(e.target.value)}
                  className="psQuickDate"
                />
                <span className="psQuickLbl">до</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e: any) => setCustomTo(e.target.value)}
                  className="psQuickDate"
                />
                <button
                  type="button"
                  className="sg-tab is-active psApplyBtn"
                  onClick={() => applyRange(customFrom, customTo)}
                  disabled={!customFrom || !customTo}
                >
                  Применить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="wheelGrid">
        {/* LEFT */}
        <div className="wheelLeft">
          <Card className="wheelCard">
            <div className="wheelCardHead wheelCardHeadRow">
              <div>
                <div className="wheelCardTitle">Факт: шаги / пользователи / завершения</div>
                <div className="wheelCardSub">
                  {range.from} — {range.to}
                  {totalStyles > 0 ? (
                    <span className="psMuted"> · цель: {totalStyles} стилей</span>
                  ) : (
                    <span className="psMuted"> · цель: —</span>
                  )}
                </div>
              </div>

              <div className="psChartBtns" role="tablist" aria-label="Слои графика">
                <button
                  type="button"
                  className={'psChartBtn ' + (showSteps ? 'is-active' : '')}
                  onClick={() => setShowSteps((v) => !v)}
                  title="Шаги (collect)"
                >
                  <IcoSteps /> шаги
                </button>
                <button
                  type="button"
                  className={'psChartBtn ' + (showUsers ? 'is-active' : '')}
                  onClick={() => setShowUsers((v) => !v)}
                  title="Активные пользователи"
                >
                  <IcoUsers /> users
                </button>
                <button
                  type="button"
                  className={'psChartBtn ' + (showCompleted ? 'is-active' : '')}
                  onClick={() => setShowCompleted((v) => !v)}
                  title="Завершения"
                >
                  <IcoDone /> done
                </button>
              </div>
            </div>

            <div className="psChartWrap">
              {!isLoading && !isError && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.30} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      tickFormatter={(v: any) => fmtDDMM(String(v || ''))}
                    />
                    <YAxis
                      yAxisId="y"
                      tick={{ fontSize: 12 }}
                      width={54}
                      tickFormatter={(v: any) => {
                        const n = Number(v);
                        if (!Number.isFinite(n)) return '';
                        return String(Math.round(n));
                      }}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => {
                        if (name === 'steps') return [String(val), 'Шаги'];
                        if (name === 'active_users') return [String(val), 'Users'];
                        if (name === 'completed') return [String(val), 'Завершили'];
                        return [String(val), String(name)];
                      }}
                      labelFormatter={(_: any, payload: any) => {
                        const d = payload?.[0]?.payload?.date;
                        return d ? `Дата ${d}` : 'Дата';
                      }}
                    />

                    {/* bars = steps */}
                    {showSteps && (
                      <Bar
                        yAxisId="y"
                        dataKey="steps"
                        name="steps"
                        fill="var(--accent)"
                        fillOpacity={0.22}
                        radius={[10, 10, 10, 10]}
                      />
                    )}

                    {showUsers && (
                      <Line
                        yAxisId="y"
                        type="monotone"
                        dataKey="active_users"
                        name="active_users"
                        stroke="var(--accent2)"
                        strokeWidth={2}
                        dot={false}
                      />
                    )}

                    {showCompleted && (
                      <Line
                        yAxisId="y"
                        type="monotone"
                        dataKey="completed"
                        name="completed"
                        stroke="var(--accent2)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {isLoading && (
                <div className="psChartOverlay">
                  <div className="psSpinner" />
                  <div className="psMuted" style={{ fontWeight: 900 }}>Загрузка…</div>
                </div>
              )}

              {isError && (
                <div className="psChartOverlay">
                  <div className="psMuted" style={{ fontWeight: 900 }}>
                    Ошибка: {String((qTs.error as any)?.message || (qStats.error as any)?.message || (qSettings.error as any)?.message || 'UNKNOWN')}
                  </div>
                </div>
              )}
            </div>

            {/* Under tabs */}
            <div className="psUnderTabs">
              <div className="sg-tabs wheelUnderTabs__seg">
                <button className={'sg-tab ' + (tab === 'summary' ? 'is-active' : '')} onClick={() => setTab('summary')}>
                  Сводка
                </button>
                <button className={'sg-tab ' + (tab === 'boosts' ? 'is-active' : '')} onClick={() => setTab('boosts')}>
                  Бусты
                </button>
                <button
                  className={'sg-tab ' + (tab === 'settings' ? 'is-active' : '')}
                  onClick={() => setTab('settings')}
                >
                  Настройки
                </button>
              </div>

              {/* ===== TAB: SUMMARY ===== */}
              {tab === 'summary' && (
                <div className="psUnderPanel">
                  <div className="psUnderHead">
                    <div>
                      <div className="wheelCardTitle">Сводка (ФАКТ)</div>
                      <div className="wheelCardSub">
                        Шаги: <b>style.collect</b>. Завершения: достигнута цель (total_styles). Награды: <b>passport_rewards</b>.
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const days = Math.max(1, toInt(period.days, 1));

                    const steps = Math.max(0, toInt(fact.steps, 0));
                    const users = Math.max(0, toInt(fact.users, 0));
                    const completed = Math.max(0, toInt(fact.completed, 0));
                    const issued = Math.max(0, toInt(fact.issued, 0));
                    const redeemed = Math.max(0, toInt(fact.redeemed, 0));

                    const pinBad = Math.max(0, toInt(fact.pin_invalid, 0));
                    const pinUsed = Math.max(0, toInt(fact.pin_used, 0));

                    const stepsPerDay = steps / days;
                    const usersPerDay = users / days;
                    const completedPerDay = completed / days;

                    const completionRatePct = clampN(fact.completionRatePct, 0, 100);
                    const redeemRatePct = clampN(fact.redeemRatePct, 0, 100);

                    const completionBadge = completionTone;
                    const redeemBadge = redeemTone;

                    // “what blocks conversion” quick heuristics
                    const recs: Array<{ tone: 'good' | 'warn' | 'bad'; title: string; body: string }> = [];

                    if (!passportActive) {
                      recs.push({
                        tone: 'bad',
                        title: 'Паспорт выключен',
                        body: 'Сейчас пользователи не смогут собирать прогресс. Включи “Акция активна” в настройках.',
                      });
                    }

                    if (totalStyles <= 0) {
                      recs.push({
                        tone: 'warn',
                        title: 'Не задана цель (total_styles)',
                        body: 'Чтобы корректно считать completion и “near-goal” — нужен total_styles. Добавим в settings/metadata.',
                      });
                    } else if (completionRatePct < 40) {
                      recs.push({
                        tone: 'warn',
                        title: 'Низкий completion',
                        body: 'Обычно лечится бустом “остался 1 стиль → x2”, напоминаниями и более простым “дойти до кассы”.',
                      });
                    } else {
                      recs.push({
                        tone: 'good',
                        title: 'Completion выглядит ок',
                        body: 'Следи за выдачей наград и качеством PIN, чтобы не было разочарования на финале.',
                      });
                    }

                    if (requirePin && (pinBad + pinUsed) > 0) {
                      recs.push({
                        tone: 'warn',
                        title: 'Есть ошибки PIN',
                        body: 'Если pin_invalid много — кассиры/UX. Можно перейти на QR-подтверждение или укоротить код.',
                      });
                    }

                    if (redeemRatePct < 40 && completed > 0) {
                      recs.push({
                        tone: 'bad',
                        title: 'Низкая выдача наград',
                        body: 'Люди завершают, но не получают. Нужны пуши от бота и максимально простой сценарий “показать кассиру”.',
                      });
                    }

                    const recToneCls = (t: string) => (t ? `is-${t}` : '');

                    return (
                      <>
                        <div className="psGrid2">
                          <div className="sg-pill psCard">
                            <div className="psCardHead">
                              <div className="psCardTitle">Ключевые метрики</div>
                              <span className={'psBadge ' + completionBadge.cls}>
                                completion {completionBadge.text}
                              </span>
                            </div>

                            <div className="psRows">
                              <div className="psRow">
                                <span className="psMuted">Шагов (collect)</span>
                                <b>{steps}</b>
                              </div>
                              <div className="psRow">
                                <span className="psMuted">Активных пользователей</span>
                                <b>{users}</b>
                              </div>
                              <div className="psRow">
                                <span className="psMuted">Завершили</span>
                                <b>{completed}</b>
                              </div>
                              <div className="psRow">
                                <span className="psMuted">Completion rate</span>
                                <b>{completionRatePct}%</b>
                              </div>
                              <div className="psRow">
                                <span className="psMuted">Среднее / день</span>
                                <b>
                                  шаги {stepsPerDay.toFixed(1)} · users {usersPerDay.toFixed(1)} · done {completedPerDay.toFixed(1)}
                                </b>
                              </div>
                            </div>
                          </div>

                          <div className="sg-pill psCard">
                            <div className="psCardHead">
                              <div className="psCardTitle">Операционка</div>
                              <span className={'psBadge ' + redeemBadge.cls}>
                                выдача {redeemBadge.text}
                              </span>
                            </div>

                            <div className="psRows">
                              <div className="psRow">
                                <span className="psMuted">Наград issued</span>
                                <b>{issued}</b>
                              </div>
                              <div className="psRow">
                                <span className="psMuted">Наград redeemed</span>
                                <b>{redeemed}</b>
                              </div>
                              <div className="psRow">
                                <span className="psMuted">Redeem rate</span>
                                <b>{redeemRatePct}%</b>
                              </div>
                              <div className="psRow">
                                <span className="psMuted">PIN обязателен</span>
                                <b>{requirePin ? 'да' : 'нет'}</b>
                              </div>
                              <div className="psRow">
                                <span className="psMuted">Ошибки PIN (invalid / used)</span>
                                <b>{pinBad} / {pinUsed}</b>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Top “problem styles” */}
                        <div className="sg-pill psCard" style={{ marginTop: 12 }}>
                          <div className="psCardHead">
                            <div className="psCardTitle">Где чаще всего “застревают”</div>
                            <span className="psBadge mid">топ по missing_share</span>
                          </div>

                          {styleItems.length ? (
                            <div className="psTopList">
                              {[...styleItems]
                                .sort((a, b) => safeNum(b.missing_share_pct, 0) - safeNum(a.missing_share_pct, 0))
                                .slice(0, 6)
                                .map((s) => (
                                  <div key={s.style_id} className="psTopRow">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="psTopTitle" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {s.title || s.style_id}
                                      </div>
                                      <div className="psTopSub">
                                        missing: <b>{clampN(s.missing_share_pct ?? 0, 0, 100)}%</b> · collects: <b>{toInt(s.collects, 0)}</b> · users: <b>{toInt(s.unique_users, 0)}</b>
                                      </div>
                                    </div>
                                    <div style={{ width: 92, textAlign: 'right' }}>
                                      <b>{clampN(s.missing_share_pct ?? 0, 0, 100)}%</b>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="psMuted" style={{ padding: '8px 2px' }}>
                              Пока нет per-style статистики (passport/stats). Даже если данных нет — UI уже готов.
                            </div>
                          )}
                        </div>

                        {/* Recommendations */}
                        {recs.length ? (
                          <div className="sg-pill psCard" style={{ marginTop: 12 }}>
                            <div className="psCardHead">
                              <div className="psCardTitle">Рекомендации</div>
                              <span className="psBadge mid">по факту периода</span>
                            </div>

                            <div className="forecastRecsGrid" style={{ marginTop: 0 }}>
                              {recs.slice(0, 4).map((r, i) => (
                                <div key={i} className={'forecastRecCard ' + recToneCls(r.tone)}>
                                  <div className="forecastRecTitle">{r.title}</div>
                                  <div className="forecastRecBody">{r.body}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ===== TAB: BOOSTS ===== */}
              {tab === 'boosts' && (
                <div className="psUnderPanel">
                  <div className="psUnderHead">
                    <div>
                      <div className="wheelCardTitle">Бусты / Автопилот</div>
                      <div className="wheelCardSub">
                        Это слой “офферов”: бот шлёт сообщение с кнопкой “Активировать”, а воркер применяет обещание при collect / complete.
                        <span className="psMuted"> Сейчас UI-first (локально). Дальше привяжем к /offers/*.</span>
                      </div>
                    </div>
                  </div>

                  <div className="psGrid2">
                    <div className="sg-pill psCard">
                      <div className="psCardHead">
                        <div className="psCardTitle">Шаблоны</div>
                        <span className="psBadge mid">toggle + TTL</span>
                      </div>

                      <div className="psRows" style={{ gap: 10 }}>
                        {boosts.map((b) => (
                          <div key={b.id} className="psRow" style={{ alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 900, lineHeight: 1.2 }}>{b.title}</div>
                              <div className="psMuted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.25 }}>
                                {b.hint}
                              </div>

                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                                <span className="psMuted" style={{ fontSize: 12 }}>TTL (часы)</span>
                                <Input
                                  type="number"
                                  value={String(b.ttl_hours)}
                                  onChange={(e: any) => patchBoost(b.id, { ttl_hours: Math.max(1, toInt(e.target.value, 24)) })}
                                  style={{ width: 110 }}
                                />
                                <span className="psMuted" style={{ fontSize: 12 }}>лимит / юзер</span>
                                <Input
                                  type="number"
                                  value={String(b.limit_per_user)}
                                  onChange={(e: any) => patchBoost(b.id, { limit_per_user: Math.max(0, toInt(e.target.value, 1)) })}
                                  style={{ width: 110 }}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                              <Switch checked={b.enabled} onChange={(v) => patchBoost(b.id, { enabled: v })} />
                              <span className={'psBadge ' + (b.enabled ? 'ok' : 'bad')}>
                                {b.enabled ? 'вкл' : 'выкл'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" className="sg-tab is-active" onClick={saveBoostsMock}>
                          Сохранить шаблоны
                        </button>
                        {boostMsg ? <span className="psMuted" style={{ fontWeight: 800 }}>{boostMsg}</span> : null}
                      </div>
                    </div>

                    <div className="sg-pill psCard">
                      <div className="psCardHead">
                        <div className="psCardTitle">Кампании (сообщение от бота)</div>
                        <span className="psBadge mid">скоро</span>
                      </div>

                      <div className="psMuted" style={{ lineHeight: 1.35 }}>
                        Следующий шаг (воркер):
                        <ul style={{ margin: '8px 0 0 16px' }}>
                          <li>POST /offers/send_campaign (segmentation + message + button)</li>
                          <li>действие кнопки → записать “offer_armed” в D1/KV</li>
                          <li>в момент style.collect → проверить активный буст и применить (x2 / +1 / skip)</li>
                        </ul>
                        <div style={{ marginTop: 10 }}>
                          В UI здесь будут: сегмент, текст, предпросмотр кнопки, лимиты, статистика активаций.
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <Button disabled>Отправить кампанию (soon)</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== TAB: SETTINGS ===== */}
              {tab === 'settings' && (
                <div className="psUnderPanel">
                  <div className="psUnderHead">
                    <div>
                      <div className="wheelCardTitle">Настройки (live)</div>
                      <div className="wheelCardSub">
                        Оперативные тумблеры. Не завязаны на publish.
                      </div>
                    </div>
                  </div>

                  <div className="psGrid2">
                    <div className="sg-pill psCard">
                      <div className="psCardHead">
                        <div className="psCardTitle">Правила</div>
                        <span className="psBadge mid">live</span>
                      </div>

                      <div className="psRows" style={{ gap: 10 }}>
                        <div className="psRow" style={{ alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 900 }}>Акция активна</div>
                            <div className="psMuted" style={{ fontSize: 12, marginTop: 4 }}>
                              Если выключено — collect не должен засчитываться (можем enforce в mini/passport.ts).
                            </div>
                          </div>
                          <Switch checked={activeDraft} onChange={setActiveDraft} />
                        </div>

                        <div className="psRow" style={{ alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 900 }}>Требовать PIN</div>
                            <div className="psMuted" style={{ fontSize: 12, marginTop: 4 }}>
                              Если включено — style.collect требует одноразовый PIN из pins_pool.
                            </div>
                          </div>
                          <Switch checked={pinDraft} onChange={setPinDraft} />
                        </div>

                        <div className="psRow" style={{ alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 900 }}>Показывать офферы/бусты</div>
                            <div className="psMuted" style={{ fontSize: 12, marginTop: 4 }}>
                              Если включено — мини-апп может показывать пользователю активные предложения.
                            </div>
                          </div>
                          <Switch checked={offersDraft} onChange={setOffersDraft} />
                        </div>

                        <div className="psRow">
                          <span className="psMuted">passport_key</span>
                          <b>{String(settings.passport_key || 'default')}</b>
                        </div>

                        <div className="psRow">
                          <span className="psMuted">total_styles</span>
                          <b>{totalStyles > 0 ? totalStyles : '—'}</b>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="sg-tab is-active"
                          onClick={savePassportSettings}
                          disabled={savingSettings || !appId}
                        >
                          {savingSettings ? 'Сохраняю…' : 'Сохранить'}
                        </button>
                        {settingsMsg ? <span className="psMuted" style={{ fontWeight: 800 }}>{settingsMsg}</span> : null}
                      </div>
                    </div>

                    <div className="sg-pill psCard">
                      <div className="psCardHead">
                        <div className="psCardTitle">Управление витриной стилей</div>
                        <span className="psBadge mid">soon</span>
                      </div>

                      <div className="psMuted" style={{ lineHeight: 1.35 }}>
                        Это будущий аналог “Склада” из колеса — но для карточек стилей:
                        <ul style={{ margin: '8px 0 0 16px' }}>
                          <li>активен / скрыт</li>
                          <li>порядок</li>
                          <li>featured (подсветить)</li>
                        </ul>
                        Технически: live-поля в styles_dict (или отдельная styles_live).
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="wheelRight">
          {/* completion widget */}
          <Card className="wheelCard" style={{ marginBottom: 12 }}>
            <div className="wheelRedeemBar" style={{ marginTop: 0 }}>
              <div className="wheelRedeemTop">
                <div className="wheelRedeemName">Completion</div>
                <div className={'wheelRedeemBadge ' + completionTone.cls}>
                  {completionTone.text}
                </div>
              </div>

              <div className="psBarTrack" aria-hidden="true">
                <div className="psBarFill" style={{ width: `${clampN(fact.completionRatePct, 0, 100)}%` }} />
              </div>

              <div className="psRightMeta">
                <span className="psMuted">users: <b>{fact.users}</b></span>
                <span className="psMuted">done: <b>{fact.completed}</b></span>
                <span className="psMuted">rate: <b>{clampN(fact.completionRatePct, 0, 100)}%</b></span>
              </div>

              <div className="psRightMeta" style={{ marginTop: 6 }}>
                <span className="psMuted">issued: <b>{fact.issued}</b></span>
                <span className="psMuted">redeemed: <b>{fact.redeemed}</b></span>
                <span className="psMuted">redeem: <b>{clampN(fact.redeemRatePct, 0, 100)}%</b></span>
              </div>
            </div>
          </Card>

          {/* top styles */}
          <Card className="wheelCard wheelStickyTop">
            <div className="wheelCardHead wheelTopHead">
              <div className="wheelCardTitle">Топ стилей</div>

              <div className="sg-tabs wheelMiniTabs">
                <button
                  type="button"
                  className={'sg-tab ' + (topMetric === 'collects' ? 'is-active' : '')}
                  onClick={() => setTopMetric('collects')}
                >
                  Собирают
                </button>
                <button
                  type="button"
                  className={'sg-tab ' + (topMetric === 'missing' ? 'is-active' : '')}
                  onClick={() => setTopMetric('missing')}
                >
                  Провал
                </button>
              </div>
            </div>

            <div className="psTopList">
              {topStyles.map((s) => (
                <div key={s.style_id} className="psTopRow">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="psTopTitle" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.title || s.style_id}
                    </div>
                    <div className="psTopSub">
                      collects: <b>{toInt(s.collects, 0)}</b> · users: <b>{toInt(s.unique_users, 0)}</b>
                      {topMetric === 'missing' ? (
                        <>
                          {' '}· missing: <b>{clampN(s.missing_share_pct ?? 0, 0, 100)}%</b>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ width: 90, textAlign: 'right' }}>
                    <b>
                      {topMetric === 'collects'
                        ? toInt(s.collects, 0)
                        : `${clampN(s.missing_share_pct ?? 0, 0, 100)}%`}
                    </b>
                  </div>
                </div>
              ))}

              {!topStyles.length && !qStats.isLoading && (
                <div className="psMuted">Пока пусто</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
