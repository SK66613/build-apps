// sg-cabinet-react/src/pages/Passport.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';

import { SgPage } from '../components/sgp/layout/SgPage';
import { SgFormRow } from '../components/sgp/ui/SgFormRow';
import { SgActions, type SgSaveState } from '../components/sgp/ui/SgActions';

import {
  SgCard,
  SgCardHeader,
  SgCardTitle,
  SgCardSub,
  SgCardContent,
} from '../components/sgp/ui/SgCard';

import { SgButton } from '../components/sgp/ui/SgButton';
import { SgInput, SgSelect } from '../components/sgp/ui/SgInput';
import { SgToggle } from '../components/sgp/ui/SgToggle';

import { HealthBadge } from '../components/sgp/HealthBadge';
import { ShimmerLine } from '../components/sgp/ShimmerLine';
import { IconBtn } from '../components/sgp/IconBtn';

import { ChartState } from '../components/sgp/charts/ChartState';
import { SgSectionCard } from '../components/sgp/blocks/SgSectionCard';
import { SgTopListCard } from '../components/sgp/sections/SgTopListCard';

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
  total_styles?: number; // цель
  require_pin?: number; // 0|1
  passport_active?: number; // 0|1
  show_offers?: number; // 0|1
};

type PassportTimeseriesDay = {
  date: string; // YYYY-MM-DD
  steps: number;
  active_users: number;
  completed: number;
  rewards_issued: number;
  rewards_redeemed: number;
  pin_invalid: number;
  pin_used: number;
};

type PassportStyleStat = {
  style_id: string;
  title: string;
  collects: number;
  unique_users: number;
  missing_share_pct?: number;
};

type PassportTopUser = {
  tg_id: string;
  title?: string; // display name (optional)
  collects?: number;
  completed?: number;
  pending?: number;
};

/** ========= Helpers ========= */
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
  for (let i = 0; i < 500; i++) {
    out.push(cur);
    if (cur === toISO) break;
    cur = isoAddDays(cur, 1);
  }
  return out;
}

function fmtDDMM(iso: string) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}`;
}

function safeNum(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** ========= Premium tiny UI bits ========= */
function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={(active ? 'sgp-seg__btn is-active ' : 'sgp-seg__btn ') + 'sgp-press'}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Hint({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  children: React.ReactNode;
}) {
  return <div className={`sgp-hint tone-${tone}`}>{children}</div>;
}

/** ========= Chart helpers ========= */
type SeriesRow = {
  date: string;
  steps: number;
  users: number;
  completed: number;
  rewards_issued: number;
  rewards_redeemed: number;
  pin_errors: number;
};

function toneByPct(pct: number): 'good' | 'warn' | 'bad' {
  const x = clampN(pct, 0, 100);
  if (x >= 70) return 'good';
  if (x >= 40) return 'warn';
  return 'bad';
}

/** ========= Page ========= */
export default function Passport() {
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  type OpenedKey = 'summary' | 'ranks' | 'boosts' | 'limits' | null;

  const [opened, setOpened] = React.useState<OpenedKey>('summary');
  const [openSummary, setOpenSummary] = React.useState(true);
  const [openRanks, setOpenRanks] = React.useState(true);
  const [openBoosts, setOpenBoosts] = React.useState(true);
  const [openLimits, setOpenLimits] = React.useState(true);

  function openOnly(k: Exclude<OpenedKey, null>) {
    setOpened(k);
    setOpenSummary(k === 'summary');
    setOpenRanks(k === 'ranks');
    setOpenBoosts(k === 'boosts');
    setOpenLimits(k === 'limits');
  }

  function toggleOnly(k: Exclude<OpenedKey, null>) {
    if (opened === k) {
      setOpened(null);
      setOpenSummary(false);
      setOpenRanks(false);
      setOpenBoosts(false);
      setOpenLimits(false);
      return;
    }
    openOnly(k);
  }

  // ===== chart layers / basis =====
  const [rewardBasis, setRewardBasis] = React.useState<'issued' | 'redeemed'>('issued');

  const [showSteps, setShowSteps] = React.useState(true);
  const [showUsers, setShowUsers] = React.useState(true);
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [showRewards, setShowRewards] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);

  // ===== quick range =====
  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  React.useEffect(() => {
    setCustomFrom(range?.from || '');
    setCustomTo(range?.to || '');
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
    enabled: !!appId && !!range?.from && !!range?.to,
    queryKey: ['passport_ts', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; days: PassportTimeseriesDay[]; settings?: PassportSettings; meta?: any }>(
        `/api/cabinet/apps/${appId}/passport/timeseries?${qs(range)}`
      ),
    staleTime: 10_000,
  });

  // ===== per-style stats (optional, can be used later) =====
  const qStyleStats = useQuery({
    enabled: !!appId && !!range?.from && !!range?.to,
    queryKey: ['passport_style_stats', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; items: PassportStyleStat[]; meta?: any }>(
        `/api/cabinet/apps/${appId}/passport/stats?${qs(range)}`
      ),
    staleTime: 10_000,
  });

  const settings: PassportSettings = {
    ...(qSettings.data?.settings || {}),
    ...(qTs.data?.settings || {}),
  };

  const totalStyles = Math.max(0, toInt(settings.total_styles, 0));
  const passportActive = !!toInt(settings.passport_active, 1);
  const requirePin = !!toInt(settings.require_pin, 0);
  const showOffers = !!toInt(settings.show_offers, 1);

  // ===== series (stable by days) =====
  const series: SeriesRow[] = React.useMemo(() => {
    const map = new Map<string, PassportTimeseriesDay>();
    for (const d of (qTs.data?.days || [])) if (d?.date) map.set(String(d.date), d);

    const dates = listDaysISO(range.from, range.to);
    return dates.map((iso) => {
      const r = map.get(iso);
      const pin_invalid = safeNum(r?.pin_invalid, 0);
      const pin_used = safeNum(r?.pin_used, 0);
      return {
        date: iso,
        steps: safeNum(r?.steps, 0),
        users: safeNum(r?.active_users, 0),
        completed: safeNum(r?.completed, 0),
        rewards_issued: safeNum(r?.rewards_issued, 0),
        rewards_redeemed: safeNum(r?.rewards_redeemed, 0),
        pin_errors: Math.max(0, pin_invalid + pin_used),
      };
    });
  }, [qTs.data?.days, range.from, range.to]);

  // ===== facts totals =====
  const fact = React.useMemo(() => {
    const days = series || [];
    const steps = days.reduce((s, d) => s + safeNum(d.steps, 0), 0);
    const users = days.reduce((s, d) => s + safeNum(d.users, 0), 0);
    const completed = days.reduce((s, d) => s + safeNum(d.completed, 0), 0);
    const issued = days.reduce((s, d) => s + safeNum(d.rewards_issued, 0), 0);
    const redeemed = days.reduce((s, d) => s + safeNum(d.rewards_redeemed, 0), 0);
    const pinErrors = days.reduce((s, d) => s + safeNum(d.pin_errors, 0), 0);

    const completionRatePct = users > 0 ? Math.round((completed / users) * 100) : 0;
    const redeemRatePct = completed > 0 ? Math.round((redeemed / completed) * 100) : 0;
    const pending = Math.max(0, issued - redeemed);

    return {
      steps,
      users,
      completed,
      issued,
      redeemed,
      pending,
      pinErrors,
      completionRatePct: clampN(completionRatePct, 0, 100),
      redeemRatePct: clampN(redeemRatePct, 0, 100),
    };
  }, [series]);

  const completionTone = toneByPct(fact.completionRatePct);
  const redeemTone = toneByPct(fact.redeemRatePct);

  // ===== chart computed (rewards basis) =====
  const chartData = React.useMemo(() => {
    return series.map((d) => ({
      ...d,
      rewards: rewardBasis === 'redeemed' ? d.rewards_redeemed : d.rewards_issued,
    }));
  }, [series, rewardBasis]);

  // ===== top users (right column) =====
  const [topMetric, setTopMetric] = React.useState<'collects' | 'completed' | 'pending'>('collects');

  const qTopUsers = useQuery({
    enabled: !!appId && !!range?.from && !!range?.to,
    queryKey: ['passport_top_users', appId, range.from, range.to, topMetric],
    queryFn: () =>
      apiFetch<{ ok: true; items: PassportTopUser[] }>(
        `/api/cabinet/apps/${appId}/passport/users/top?${qs({ ...range, metric: topMetric })}`
      ),
    staleTime: 10_000,
  });

  const topUsers: PassportTopUser[] = (qTopUsers.data?.items || []).slice(0, 7);

  // ===== Limits: live toggles + collect limits (draft) =====
  const [activeDraft, setActiveDraft] = React.useState<boolean>(passportActive);
  const [pinDraft, setPinDraft] = React.useState<boolean>(requirePin);
  const [offersDraft, setOffersDraft] = React.useState<boolean>(showOffers);

  React.useEffect(() => {
    setActiveDraft(passportActive);
    setPinDraft(requirePin);
    setOffersDraft(showOffers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportActive, requirePin, showOffers]);

  const [maxCollectsPerDayDraft, setMaxCollectsPerDayDraft] = React.useState<string>('0');
  const [maxCollectsPerUserPerDayDraft, setMaxCollectsPerUserPerDayDraft] = React.useState<string>('0');
  const [blockWhenInactiveDraft, setBlockWhenInactiveDraft] = React.useState<boolean>(true);

  const [savingLimits, setSavingLimits] = React.useState(false);
  const [limitsMsg, setLimitsMsg] = React.useState('');

  async function saveLimits() {
    if (!appId) return;
    setLimitsMsg('');
    setSavingLimits(true);
    try {
      // 1) live toggles (already exists)
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

      // 2) limits (TODO: bind when backend is ready)
      // await apiFetch(`/api/cabinet/apps/${appId}/passport/limits`, {...})
      // For now: UI-first – still store locally in draft, just show "saved".
      const max_collects_per_day = Math.max(0, toInt(maxCollectsPerDayDraft, 0));
      const max_collects_per_user_per_day = Math.max(0, toInt(maxCollectsPerUserPerDayDraft, 0));
      const block_when_inactive = blockWhenInactiveDraft ? 1 : 0;
      void max_collects_per_day;
      void max_collects_per_user_per_day;
      void block_when_inactive;

      setLimitsMsg('Сохранено');
      await qc.invalidateQueries({ queryKey: ['passport_settings', appId] });
      await qc.invalidateQueries({ queryKey: ['passport_ts', appId] });
      await qc.invalidateQueries({ queryKey: ['passport_style_stats', appId] });
    } catch (e: any) {
      setLimitsMsg('Ошибка: ' + String(e?.message || e));
    } finally {
      setSavingLimits(false);
    }
  }

  const limitsSaveState: SgSaveState =
    savingLimits ? 'saving' : limitsMsg === 'Сохранено' ? 'saved' : limitsMsg.startsWith('Ошибка') ? 'error' : 'idle';

  // ===== Boosts (UI-first, later bind to /offers/*) =====
  type BoostId = 'near_goal' | 'dormant_7d' | 'reward_waiting' | 'season_ends';
  type BoostRow = {
    id: BoostId;
    title: string;
    enabled: boolean;
    ttl_hours: number;
    limit_per_user: number;
    button_label: string;
    message_text: string;
    hint: string;
  };

  const [boostsOn, setBoostsOn] = React.useState<boolean>(true);
  const [boosts, setBoosts] = React.useState<BoostRow[]>([
    {
      id: 'near_goal',
      title: 'Остался 1 штамп — дожать до приза',
      enabled: true,
      ttl_hours: 24,
      limit_per_user: 1,
      button_label: 'Дожать до приза',
      message_text: 'Остался всего 1 штамп до приза 🎁 Загляни к кассиру сегодня — добьём!',
      hint: 'Сегмент: пользователи, у которых осталось 1 до закрытия текущего круга/тира.',
    },
    {
      id: 'dormant_7d',
      title: 'Не было 7 дней — вернуть',
      enabled: false,
      ttl_hours: 48,
      limit_per_user: 1,
      button_label: 'Вернуться',
      message_text: 'Мы скучали! Вернись в ближайшие 48 часов — у тебя есть шанс добрать штампы ✨',
      hint: 'Сегмент: нет collect 7 дней. Триггерится по расписанию.',
    },
    {
      id: 'reward_waiting',
      title: 'Приз выдан, но не забран — напоминание',
      enabled: true,
      ttl_hours: 72,
      limit_per_user: 3,
      button_label: 'Забрать приз',
      message_text: 'Твой приз уже готов 🎉 Покажи QR кассиру — забери подарок!',
      hint: 'Сегмент: у пользователя есть passport_rewards issued (не redeemed).',
    },
    {
      id: 'season_ends',
      title: 'Сезон скоро закончится — срочно добрать',
      enabled: false,
      ttl_hours: 72,
      limit_per_user: 1,
      button_label: 'Успеть',
      message_text: 'Сезон заканчивается скоро ⏳ Успей собрать штампы и получить приз!',
      hint: 'Сегмент: сезонный паспорт, до конца ≤ N дней (премиум).',
    },
  ]);

  function patchBoost(id: BoostId, patch: Partial<BoostRow>) {
    setBoosts((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  const [savingBoosts, setSavingBoosts] = React.useState(false);
  const [boostsMsg, setBoostsMsg] = React.useState('');

  async function saveBoosts() {
    setBoostsMsg('');
    setSavingBoosts(true);
    try {
      // TODO: PUT /api/cabinet/apps/:id/passport/boosts
      // await apiFetch(`/api/cabinet/apps/${appId}/passport/boosts`, {...})
      setBoostsMsg('Сохранено');
    } catch (e: any) {
      setBoostsMsg('Ошибка: ' + String(e?.message || e));
    } finally {
      setSavingBoosts(false);
    }
  }

  const boostsSaveState: SgSaveState =
    savingBoosts ? 'saving' : boostsMsg === 'Сохранено' ? 'saved' : boostsMsg.startsWith('Ошибка') ? 'error' : 'idle';

  // ===== Ranks (settings UI-first) =====
  type RankRule = {
    id: string;
    rank: string; // e.g. "Bronze"
    condition: 'steps_total' | 'completed_total' | 'completion_rate' | 'custom';
    threshold: number; // meaning depends on condition
    note?: string;
    enabled: boolean;
  };

  const [rankRules, setRankRules] = React.useState<RankRule[]>([
    {
      id: 'r1',
      rank: 'Bronze',
      condition: 'steps_total',
      threshold: 50,
      note: 'Дать ранг если шагов за период ≥ 50',
      enabled: true,
    },
    {
      id: 'r2',
      rank: 'Silver',
      condition: 'completed_total',
      threshold: 10,
      note: 'Дать ранг если завершений за период ≥ 10',
      enabled: true,
    },
    {
      id: 'r3',
      rank: 'Gold',
      condition: 'completion_rate',
      threshold: 60,
      note: 'Дать ранг если completion ≥ 60%',
      enabled: false,
    },
  ]);

  function patchRankRule(id: string, patch: Partial<RankRule>) {
    setRankRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRankRule() {
    const id = 'r' + Math.random().toString(16).slice(2, 8);
    setRankRules((prev) => [
      ...prev,
      { id, rank: 'New', condition: 'custom', threshold: 0, note: 'описание условия', enabled: false },
    ]);
  }

  function removeRankRule(id: string) {
    setRankRules((prev) => prev.filter((r) => r.id !== id));
  }

  const [savingRanks, setSavingRanks] = React.useState(false);
  const [ranksMsg, setRanksMsg] = React.useState('');

  async function saveRanks() {
    setRanksMsg('');
    setSavingRanks(true);
    try {
      // TODO: PUT /api/cabinet/apps/:id/passport/ranks/settings
      // await apiFetch(`/api/cabinet/apps/${appId}/passport/ranks/settings`, {...})
      setRanksMsg('Сохранено');
    } catch (e: any) {
      setRanksMsg('Ошибка: ' + String(e?.message || e));
    } finally {
      setSavingRanks(false);
    }
  }

  const ranksSaveState: SgSaveState =
    savingRanks ? 'saving' : ranksMsg === 'Сохранено' ? 'saved' : ranksMsg.startsWith('Ошибка') ? 'error' : 'idle';

  // ===== states =====
  const isLoading = qSettings.isLoading || qTs.isLoading || qStyleStats.isLoading || qTopUsers.isLoading;
  const isError = qSettings.isError || qTs.isError || qStyleStats.isError || qTopUsers.isError;

  const summaryBadgeTone: 'good' | 'warn' | 'bad' =
    !passportActive ? 'bad' : (fact.users <= 0 ? 'warn' : completionTone);

  return (
    <SgPage
      className="sgp-passport"
      title="Паспорт"
      subtitle={
        <span>
          Факт по <b>style.collect</b> + завершения/награды. Управление: <b>ранги</b>, <b>бусты</b>, <b>лимиты</b>.
        </span>
      }
      actions={
        <div className="sgp-rangebar">
          <div className="sgp-rangebar__row">
            <div className="sgp-seg">
              <SegBtn active={quick === 'day'} onClick={() => pickQuick('day')}>День</SegBtn>
              <SegBtn active={quick === 'week'} onClick={() => pickQuick('week')}>Неделя</SegBtn>
              <SegBtn active={quick === 'month'} onClick={() => pickQuick('month')}>Месяц</SegBtn>
              <SegBtn active={quick === 'custom'} onClick={() => pickQuick('custom')}>Свой</SegBtn>
            </div>

            <div className={quick === 'custom' ? 'sgp-rangebar__customWrap is-open' : 'sgp-rangebar__customWrap'}>
              <div className="sgp-rangebar__custom">
                <span className="sgp-muted">от</span>
                <input
                  type="date"
                  className="sgp-input sgp-date sgp-press"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <span className="sgp-muted">до</span>
                <input
                  type="date"
                  className="sgp-input sgp-date sgp-press"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
                <SgButton
                  variant="secondary"
                  size="sm"
                  onClick={() => applyRange(customFrom, customTo)}
                  disabled={!customFrom || !customTo}
                >
                  Применить
                </SgButton>
              </div>
            </div>
          </div>
        </div>
      }
      aside={
        <div className="sgp-aside">
          <SgCard>
            <SgCardHeader
              right={
                <HealthBadge
                  tone={summaryBadgeTone}
                  title={!passportActive ? 'OFF' : (fact.users <= 0 ? 'NO DATA' : summaryBadgeTone.toUpperCase())}
                />
              }
            >
              <div>
                <SgCardTitle>Состояние паспорта</SgCardTitle>
                <SgCardSub>за выбранный период</SgCardSub>
              </div>
            </SgCardHeader>

            <SgCardContent>
              <div className="sgp-kv">
                <div className="sgp-kv__row"><span>Шагов</span><b>{fact.steps}</b></div>
                <div className="sgp-kv__row"><span>Users</span><b>{fact.users}</b></div>
                <div className="sgp-kv__row"><span>Завершили</span><b>{fact.completed}</b></div>
                <div className="sgp-kv__row"><span>Completion</span><b>{fact.completionRatePct}%</b></div>
                <div className="sgp-kv__row"><span>Выдано / подтверждено</span><b>{fact.issued} / {fact.redeemed}</b></div>
                <div className="sgp-kv__row"><span>Ожидают выдачи</span><b>{fact.pending}</b></div>
              </div>

              <div style={{ marginTop: 10 }}>
                {!passportActive ? (
                  <Hint tone="bad">Паспорт выключен. Пользователи не смогут собирать прогресс.</Hint>
                ) : fact.users <= 0 ? (
                  <Hint tone="warn">Нет данных за период или ещё не было активности.</Hint>
                ) : completionTone === 'good' ? (
                  <Hint tone="good">Completion высокий — пользователи доходят до финала.</Hint>
                ) : completionTone === 'warn' ? (
                  <Hint tone="warn">Можно улучшить completion: подключи бусты “остался 1” и “приз ждёт”.</Hint>
                ) : (
                  <Hint tone="bad">Низкий completion. Проверь цель, правила и коммуникации.</Hint>
                )}
              </div>
            </SgCardContent>
          </SgCard>

          <div style={{ height: 12 }} />

          <SgTopListCard
            title="Топ пользователей"
            subtitle={`по ${topMetric === 'collects' ? 'шагам' : topMetric === 'completed' ? 'завершениям' : 'ожиданию приза'}`}
            items={topUsers}
            getId={(u: any) => String(u.tg_id || u.title || Math.random())}
            getTitle={(u: any) => String(u.title || u.tg_id || 'user')}
            metrics={[
              {
                key: 'collects',
                label: 'шагам',
                value: (u: any) => Number(u.collects) || 0,
                sub: (u: any) => `done: ${Number(u.completed) || 0} · pending: ${Number(u.pending) || 0}`,
              },
              {
                key: 'completed',
                label: 'завершениям',
                value: (u: any) => Number(u.completed) || 0,
                sub: (u: any) => `steps: ${Number(u.collects) || 0} · pending: ${Number(u.pending) || 0}`,
              },
              {
                key: 'pending',
                label: 'ожиданию',
                value: (u: any) => Number(u.pending) || 0,
                sub: (u: any) => `steps: ${Number(u.collects) || 0} · done: ${Number(u.completed) || 0}`,
              },
            ]}
            metricKey={topMetric}
            onMetricKeyChange={(k) => setTopMetric(k as any)}
            limit={7}
          />

          {!qTopUsers.isLoading && !topUsers.length ? (
            <div style={{ marginTop: 10 }}>
              <Hint tone="warn">
                Топ пустой. Нужен эндпоинт <b>/passport/users/top</b> (или пока отдадим mock).
              </Hint>
            </div>
          ) : null}
        </div>
      }
    >
      {/* ===== FACT CHART ===== */}
      <SgSectionCard
        title="Факт: шаги / users / завершения"
        sub={<>{range.from} — {range.to}{totalStyles > 0 ? <> · цель: <b>{totalStyles}</b></> : null}</>}
        right={
          <div className="sgp-chartbar">
            <div className="sgp-seg">
              <SegBtn active={rewardBasis === 'issued'} onClick={() => setRewardBasis('issued')}>
                rewards created
              </SegBtn>
              <SegBtn active={rewardBasis === 'redeemed'} onClick={() => setRewardBasis('redeemed')}>
                rewards redeemed
              </SegBtn>
            </div>

            <div className="sgp-iconGroup">
              <IconBtn active={showSteps} title="Шаги (steps)" onClick={() => setShowSteps((v) => !v)}>
                S
              </IconBtn>
              <IconBtn active={showUsers} title="Активные пользователи" onClick={() => setShowUsers((v) => !v)}>
                U
              </IconBtn>
              <IconBtn active={showCompleted} title="Завершили" onClick={() => setShowCompleted((v) => !v)}>
                D
              </IconBtn>
              <IconBtn active={showRewards} title="Награды (issued/redeemed)" onClick={() => setShowRewards((v) => !v)}>
                R
              </IconBtn>
              <IconBtn active={showErrors} title="Ошибки PIN (sum)" onClick={() => setShowErrors((v) => !v)}>
                E
              </IconBtn>
            </div>
          </div>
        }
        contentStyle={{ padding: 12 }}
      >
        <ChartState
          height={340}
          isLoading={qTs.isLoading}
          isError={qTs.isError}
          errorText={String((qTs.error as any)?.message || 'UNKNOWN')}
        >
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
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
                    if (name === 'users') return [String(val), 'Users'];
                    if (name === 'completed') return [String(val), 'Завершили'];
                    if (name === 'rewards') return [String(val), rewardBasis === 'redeemed' ? 'Rewards redeemed' : 'Rewards created'];
                    if (name === 'pin_errors') return [String(val), 'Ошибки PIN'];
                    return [String(val), String(name)];
                  }}
                  labelFormatter={(_: any, payload: any) => {
                    const d = payload?.[0]?.payload?.date;
                    return d ? `Дата ${d}` : 'Дата';
                  }}
                />

                {showSteps ? (
                  <Bar
                    yAxisId="y"
                    dataKey="steps"
                    name="steps"
                    fill="var(--accent)"
                    fillOpacity={0.18}
                    radius={[10, 10, 10, 10]}
                  />
                ) : null}

                {showUsers ? (
                  <Line
                    yAxisId="y"
                    type="monotone"
                    dataKey="users"
                    name="users"
                    stroke="var(--accent2)"
                    strokeWidth={2}
                    dot={false}
                  />
                ) : null}

                {showCompleted ? (
                  <Line
                    yAxisId="y"
                    type="monotone"
                    dataKey="completed"
                    name="completed"
                    stroke="var(--accent2)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    opacity={0.95}
                  />
                ) : null}

                {showRewards ? (
                  <Line
                    yAxisId="y"
                    type="monotone"
                    dataKey="rewards"
                    name="rewards"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                    opacity={0.85}
                  />
                ) : null}

                {showErrors ? (
                  <Line
                    yAxisId="y"
                    type="monotone"
                    dataKey="pin_errors"
                    name="pin_errors"
                    stroke="currentColor"
                    strokeWidth={2}
                    dot={false}
                    opacity={0.55}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartState>
      </SgSectionCard>

      {/* ===== TABS BAR BETWEEN CARDS ===== */}
      <div className="sgp-wheelTabsBar">
        <div className="sgp-seg">
          <SegBtn active={opened === 'summary'} onClick={() => openOnly('summary')}>Сводка</SegBtn>
          <SegBtn active={opened === 'ranks'} onClick={() => openOnly('ranks')}>Ранги</SegBtn>
          <SegBtn active={opened === 'boosts'} onClick={() => openOnly('boosts')}>Бусты</SegBtn>
          <SegBtn active={opened === 'limits'} onClick={() => openOnly('limits')}>Лимиты</SegBtn>
        </div>
      </div>

      {/* ===== ACC: SUMMARY ===== */}
      <SgSectionCard
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Сводка</span>
            <HealthBadge tone={completionTone} title={`${fact.completionRatePct}%`} />
            <HealthBadge tone={redeemTone} title={`redeem ${fact.redeemRatePct}%`} />
          </div>
        }
        collapsible
        open={opened === 'summary' && openSummary}
        onToggleOpen={() => toggleOnly('summary')}
      >
        <div className="sgp-metrics">
          <div className="sgp-metric"><div className="sgp-metric__k">ШАГОВ</div><div className="sgp-metric__v">{fact.steps}</div></div>
          <div className="sgp-metric"><div className="sgp-metric__k">USERS</div><div className="sgp-metric__v">{fact.users}</div></div>
          <div className="sgp-metric"><div className="sgp-metric__k">ЗАВЕРШИЛИ</div><div className="sgp-metric__v">{fact.completed}</div></div>
          <div className="sgp-metric"><div className="sgp-metric__k">COMPLETION</div><div className="sgp-metric__v">{fact.completionRatePct}%</div></div>
          <div className="sgp-metric"><div className="sgp-metric__k">REWARDS ISSUED</div><div className="sgp-metric__v">{fact.issued}</div></div>
          <div className="sgp-metric"><div className="sgp-metric__k">REWARDS REDEEMED</div><div className="sgp-metric__v">{fact.redeemed}</div></div>
          <div className="sgp-metric"><div className="sgp-metric__k">PENDING</div><div className="sgp-metric__v">{fact.pending}</div></div>
          <div className="sgp-metric"><div className="sgp-metric__k">PIN ERRORS</div><div className="sgp-metric__v">{fact.pinErrors}</div></div>
        </div>

        <div style={{ marginTop: 12 }}>
          {!passportActive ? (
            <Hint tone="bad">Паспорт выключен: включи в “Лимиты → Операционные тумблеры”.</Hint>
          ) : totalStyles <= 0 ? (
            <Hint tone="warn">Не задана цель (total_styles). Completion будет грубым, а бусты “остался 1” — неточными.</Hint>
          ) : completionTone === 'bad' ? (
            <Hint tone="warn">Подключи бусты: “остался 1” + “приз ждёт”. И проверь простоту сценария у кассира.</Hint>
          ) : (
            <Hint tone="good">Ок. Дальше можно докрутить ранги и лимиты, чтобы всё работало само.</Hint>
          )}
        </div>
      </SgSectionCard>

      {/* ===== ACC: RANKS ===== */}
      <SgSectionCard
        title="Ранги"
        sub="Настройки правил выдачи ранга по условиям (UI-first)"
        collapsible
        open={opened === 'ranks' && openRanks}
        onToggleOpen={() => toggleOnly('ranks')}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SgButton variant="secondary" size="sm" onClick={addRankRule}>
            + Добавить правило
          </SgButton>
          <span className="sgp-muted">
            Сейчас это настройки. Позже подключим реальную систему рангов и расчёт.
          </span>
        </div>

        <div style={{ height: 10 }} />

        {rankRules.map((r) => (
          <SgCard key={r.id} style={{ marginTop: 10 }}>
            <SgCardHeader
              right={
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <SgToggle checked={r.enabled} onChange={(v) => patchRankRule(r.id, { enabled: v })} />
                  <SgButton variant="ghost" size="sm" onClick={() => removeRankRule(r.id)}>
                    Удалить
                  </SgButton>
                </div>
              }
            >
              <div>
                <SgCardTitle>{r.rank}</SgCardTitle>
                <SgCardSub>{r.enabled ? 'включено' : 'выключено'}</SgCardSub>
              </div>
            </SgCardHeader>

            <SgCardContent>
              <SgFormRow label="Название ранга">
                <SgInput value={r.rank} onChange={(e) => patchRankRule(r.id, { rank: (e.target as any).value })} />
              </SgFormRow>

              <SgFormRow label="Условие">
                <SgSelect
                  value={r.condition}
                  onChange={(e) => patchRankRule(r.id, { condition: (e.target as any).value })}
                >
                  <option value="steps_total">steps_total (шагов за период)</option>
                  <option value="completed_total">completed_total (завершений за период)</option>
                  <option value="completion_rate">completion_rate (%)</option>
                  <option value="custom">custom (позже)</option>
                </SgSelect>
              </SgFormRow>

              <SgFormRow label="Порог" hint={r.condition === 'completion_rate' ? 'в процентах' : 'в штуках'}>
                <SgInput
                  value={String(r.threshold)}
                  onChange={(e) => patchRankRule(r.id, { threshold: Math.max(0, toInt((e.target as any).value, 0)) })}
                />
              </SgFormRow>

              <SgFormRow label="Комментарий (для мерчанта)">
                <SgInput
                  value={r.note || ''}
                  onChange={(e) => patchRankRule(r.id, { note: String((e.target as any).value || '') })}
                  placeholder="Например: даём Silver если закрыли 10 паспортов за период"
                />
              </SgFormRow>
            </SgCardContent>
          </SgCard>
        ))}

        <div style={{ height: 12 }} />

        <SgActions
          primaryLabel="Сохранить ранги"
          onPrimary={saveRanks}
          state={ranksSaveState}
          errorText={ranksMsg.startsWith('Ошибка') ? ranksMsg : undefined}
          left={<span className="sgp-muted">TODO: сохранить на бэкенд и включить расчёт рангов.</span>}
        />
      </SgSectionCard>

      {/* ===== ACC: BOOSTS ===== */}
      <SgSectionCard
        title="Бусты"
        sub="Автоматизация (UI-first, позже привязка к /offers/*)"
        collapsible
        open={opened === 'boosts' && openBoosts}
        onToggleOpen={() => toggleOnly('boosts')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="sgp-muted">Общий тумблер</span>
            <SgToggle checked={boostsOn} onChange={setBoostsOn} />
          </div>

          <span className="sgp-muted">
            Рекомендация: включи “приз ждёт” если растёт pending = {fact.pending}.
          </span>
        </div>

        <div style={{ height: 10 }} />

        {boosts.map((b) => (
          <SgCard key={b.id} style={{ marginTop: 10 }}>
            <SgCardHeader
              right={
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <SgToggle
                    checked={!!(boostsOn && b.enabled)}
                    onChange={(v) => patchBoost(b.id, { enabled: v })}
                  />
                  <HealthBadge tone={boostsOn && b.enabled ? 'good' : 'warn'} title={boostsOn && b.enabled ? 'ON' : 'OFF'} />
                </div>
              }
            >
              <div>
                <SgCardTitle>{b.title}</SgCardTitle>
                <SgCardSub>{b.hint}</SgCardSub>
              </div>
            </SgCardHeader>

            <SgCardContent>
              <SgFormRow label="Текст сообщения">
                <SgInput
                  value={b.message_text}
                  onChange={(e) => patchBoost(b.id, { message_text: String((e.target as any).value || '') })}
                />
              </SgFormRow>

              <SgFormRow label="Кнопка">
                <SgInput
                  value={b.button_label}
                  onChange={(e) => patchBoost(b.id, { button_label: String((e.target as any).value || '') })}
                />
              </SgFormRow>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SgFormRow label="TTL (часы)">
                  <SgInput
                    value={String(b.ttl_hours)}
                    onChange={(e) => patchBoost(b.id, { ttl_hours: Math.max(1, toInt((e.target as any).value, 24)) })}
                  />
                </SgFormRow>

                <SgFormRow label="Лимит / юзер">
                  <SgInput
                    value={String(b.limit_per_user)}
                    onChange={(e) => patchBoost(b.id, { limit_per_user: Math.max(0, toInt((e.target as any).value, 1)) })}
                  />
                </SgFormRow>
              </div>

              <div style={{ marginTop: 10 }}>
                <Hint tone="neutral">
                  Пример оценки охвата (приближённо):{' '}
                  <b>
                    {b.id === 'reward_waiting'
                      ? `${fact.pending} pending`
                      : b.id === 'near_goal'
                      ? `~${Math.max(0, Math.round(fact.completed * 0.6))} near-goal`
                      : b.id === 'dormant_7d'
                      ? `~${Math.max(0, Math.round(fact.users * 0.25))} dormant`
                      : 'season зависит от политики'}
                  </b>
                </Hint>
              </div>
            </SgCardContent>
          </SgCard>
        ))}

        <div style={{ height: 12 }} />

        <SgActions
          primaryLabel="Сохранить бусты"
          onPrimary={saveBoosts}
          state={boostsSaveState}
          errorText={boostsMsg.startsWith('Ошибка') ? boostsMsg : undefined}
          left={<span className="sgp-muted">TODO: привязать к воркеру/кампаниям.</span>}
        />
      </SgSectionCard>

      {/* ===== ACC: LIMITS ===== */}
      <SgSectionCard
        title="Лимиты"
        sub="Операционные тумблеры + лимиты collect (часть UI-first)"
        collapsible
        open={opened === 'limits' && openLimits}
        onToggleOpen={() => toggleOnly('limits')}
      >
        <SgCard>
          <SgCardHeader>
            <div>
              <SgCardTitle>Операционные тумблеры</SgCardTitle>
              <SgCardSub>live-настройки (уже есть endpoint settings)</SgCardSub>
            </div>
          </SgCardHeader>

          <SgCardContent>
            <SgFormRow label="Акция активна" hint="Если выключено — collect должен блокироваться">
              <SgToggle checked={activeDraft} onChange={setActiveDraft} />
            </SgFormRow>

            <SgFormRow label="Требовать PIN" hint="Если включено — collect требует одноразовый PIN">
              <SgToggle checked={pinDraft} onChange={setPinDraft} />
            </SgFormRow>

            <SgFormRow label="Показывать офферы/бусты" hint="Мини-апп показывает предложения пользователю">
              <SgToggle checked={offersDraft} onChange={setOffersDraft} />
            </SgFormRow>

            <div style={{ marginTop: 10 }}>
              <Hint tone={passportActive ? 'neutral' : 'warn'}>
                passport_key: <b>{String(settings.passport_key || 'default')}</b> · total_styles:{' '}
                <b>{totalStyles > 0 ? totalStyles : '—'}</b>
              </Hint>
            </div>
          </SgCardContent>
        </SgCard>

        <div style={{ height: 12 }} />

        <SgCard>
          <SgCardHeader>
            <div>
              <SgCardTitle>Лимиты collect</SgCardTitle>
              <SgCardSub>UI-first: сохраним, когда появится endpoint</SgCardSub>
            </div>
          </SgCardHeader>

          <SgCardContent>
            <SgFormRow label="Лимит collect в день (всего)" hint="0 = без лимита">
              <SgInput
                value={maxCollectsPerDayDraft}
                onChange={(e) => setMaxCollectsPerDayDraft(String((e.target as any).value || '0'))}
                placeholder="0"
              />
            </SgFormRow>

            <SgFormRow label="Лимит collect / юзер / день" hint="0 = без лимита">
              <SgInput
                value={maxCollectsPerUserPerDayDraft}
                onChange={(e) => setMaxCollectsPerUserPerDayDraft(String((e.target as any).value || '0'))}
                placeholder="0"
              />
            </SgFormRow>

            <SgFormRow label="Блокировать collect если акция выключена">
              <SgToggle checked={blockWhenInactiveDraft} onChange={setBlockWhenInactiveDraft} />
            </SgFormRow>

            <div style={{ marginTop: 10 }}>
              <Hint tone="neutral">
                Подсказка: если в дни пиков pending растёт, добавь лимит на collect/юзер и включи буст “приз ждёт”.
              </Hint>
            </div>
          </SgCardContent>
        </SgCard>

        <div style={{ height: 12 }} />

        <SgActions
          primaryLabel="Сохранить лимиты"
          onPrimary={saveLimits}
          state={limitsSaveState}
          errorText={limitsMsg.startsWith('Ошибка') ? limitsMsg : undefined}
          left={<span className="sgp-muted">Settings сохраняем сразу, limits — TODO endpoint.</span>}
        />
      </SgSectionCard>

      {isLoading ? <ShimmerLine /> : null}
      {isError ? (
        <div style={{ marginTop: 12 }}>
          <Hint tone="bad">
            Ошибка: {String((qSettings.error as any)?.message || (qTs.error as any)?.message || (qTopUsers.error as any)?.message || 'UNKNOWN')}
          </Hint>
        </div>
      ) : null}
    </SgPage>
  );
}
