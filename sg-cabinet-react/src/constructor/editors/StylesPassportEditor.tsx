// sg-cabinet-react/src/constructor/editors/StylesPassportEditor.tsx
import React from 'react';
import { Button, Input } from '../../components/ui';
import { useConstructorStore } from '../state/constructorStore';
import { apiFetch } from '../../lib/api';

type Props = {
  value: any;
  onChange: (next: any) => void;
};

type WheelPrize = {
  code: string;
  title?: string;
  coins?: number;
  active?: number | boolean;
  img?: string;
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? null));
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function toNum(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function toStr(v: any) {
  return String(v ?? '');
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result || ''));
    rd.onerror = () => reject(new Error('file read error'));
    rd.readAsDataURL(file);
  });
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function fmtYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function lastDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function genCampaignId(prefix = 'passport') {
  const d = new Date();
  const ym = `${d.getFullYear()}${pad2(d.getMonth() + 1)}`;
  const rnd = Math.random().toString(16).slice(2, 6);
  return `${prefix}_${ym}_${rnd}`;
}

// Простая “slug” для code штампа
function toCodeSlug(s: string) {
  const raw = String(s || '').trim().toLowerCase();
  const rep = raw
    .replace(/[ё]/g, 'e')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return rep || '';
}

function ensureDefaults(src: any) {
  const p = { ...(src || {}) };

  if (!Array.isArray(p.styles)) p.styles = [];

  // layout
  if (p.grid_cols === undefined) p.grid_cols = 3;

  // ✅ PIN всегда включен (UI убрали)
  p.require_pin = true;

  // server coins per stamp
  if (p.collect_coins === undefined) p.collect_coins = 0;

  // texts
  if (p.title === undefined) p.title = 'Паспорт';
  if (p.subtitle === undefined) p.subtitle = '';
  if (p.cover_url === undefined) p.cover_url = '';

  if (p.btn_collect === undefined) p.btn_collect = 'Отметить';
  if (p.btn_done === undefined) p.btn_done = 'Получено';

  // reward
  if (p.reward_enabled === undefined) p.reward_enabled = true;
  if (p.reward_title === undefined) p.reward_title = '🎁 Приз';
  if (p.reward_text === undefined)
    p.reward_text = 'Приз будет отправлен вам в бот после завершения паспорта.';
  if (p.reward_prize_code === undefined) p.reward_prize_code = '';

  // ===== campaign v2 (YYYY-MM-DD) =====
  if (p.campaign_id === undefined) p.campaign_id = '';
  if (p.campaign_enabled === undefined) p.campaign_enabled = false;
  if (p.campaign_title === undefined) p.campaign_title = 'Акция';
  if (p.campaign_start === undefined) p.campaign_start = ''; // YYYY-MM-DD
  if (p.campaign_end === undefined) p.campaign_end = ''; // YYYY-MM-DD
  // on_end: freeze | freeze_allow_claim | ignore
  if (p.campaign_on_end === undefined) p.campaign_on_end = 'freeze_allow_claim';
  if (p.campaign_grace_days === undefined) p.campaign_grace_days = 3;
  if (p.campaign_badge_text === undefined) p.campaign_badge_text = '';
  if (p.campaign_note === undefined) p.campaign_note = '';

  // ===== reward snapshot (avoid wheel changes trash) =====
  if (!p.reward) p.reward = {};
  if (p.reward.source === undefined) p.reward.source = 'wheel';
  if (p.reward.prize_code === undefined) p.reward.prize_code = '';
  if (p.reward.prize_title === undefined) p.reward.prize_title = '';
  if (p.reward.coins === undefined) p.reward.coins = 0;
  if (p.reward.wheel_campaign_id === undefined) p.reward.wheel_campaign_id = '';

  // normalize stamps
  p.styles = p.styles.map((st: any) => ({
    code: toStr(st?.code),
    name: toStr(st?.name),
    desc: toStr(st?.desc),
    image: toStr(st?.image),
  }));

  return p;
}

function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="beField">
      <div className="beLab">{label}</div>
      <div>{children}</div>
      {hint ? <div className="beHint">{hint}</div> : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="beField">
      <label className="beChk" style={{ cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(!!e.target.checked)}
        />
        <span style={{ fontWeight: 800 }}>{label}</span>
      </label>
      {hint ? <div className="beHint">{hint}</div> : null}
    </div>
  );
}

function IconBtn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    title: string;
    children: React.ReactNode;
  }
) {
  const { title, children, className, ...rest } = props;
  return (
    <button type="button" title={title} className={'beMini ' + (className || '')} {...rest}>
      {children}
    </button>
  );
}

function Acc({
  title,
  sub,
  open,
  onToggle,
  right,
  children,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={'beAcc' + (open ? ' is-open' : '')}>
      <div className="beAcc__hdr" onClick={onToggle}>
        <div className="beAcc__left">
          <div className="beAcc__title">{title}</div>
          {sub ? <div className="beAcc__sub">{sub}</div> : null}
        </div>
        <div className="beAcc__right" onClick={(e) => e.stopPropagation()}>
          {right}
          <button type="button" className="beChevron" onClick={onToggle}>
            {open ? '▴' : '▾'}
          </button>
        </div>
      </div>
      {open ? <div className="beAcc__body">{children}</div> : null}
    </div>
  );
}

export default function StylesPassportEditor({ value, onChange }: Props) {
  const appId = useConstructorStore((s) => s.appId);

  const v = React.useMemo(() => ensureDefaults(value), [value]);

  const setP = (patch: any) => {
    const next = ensureDefaults({ ...clone(v), ...(patch || {}) });

    // ✅ всегда
    next.require_pin = true;

    // ✅ keep legacy in sync (if reward snapshot is used)
    if (next.reward && typeof next.reward === 'object') {
      const snapCode = String(next.reward.prize_code || '').trim();
      if (snapCode) next.reward_prize_code = snapCode;
    }

    onChange(next);
  };

  const setStamp = (idx: number, patch: any) => {
    const next = clone(v);
    next.styles[idx] = { ...(next.styles[idx] || {}), ...(patch || {}) };
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const addStamp = () => {
    const next = clone(v);
    next.styles.push({ code: '', name: '', desc: '', image: '' });
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const deleteStamp = (idx: number) => {
    const next = clone(v);
    next.styles.splice(idx, 1);
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const moveStamp = (idx: number, dir: -1 | 1) => {
    const next = clone(v);
    const j = idx + dir;
    if (j < 0 || j >= next.styles.length) return;
    const tmp = next.styles[idx];
    next.styles[idx] = next.styles[j];
    next.styles[j] = tmp;
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const uploadCover = async (file: File) => {
    const url = await fileToDataUrl(file);
    setP({ cover_url: url });
  };

  const uploadStampImg = async (idx: number, file: File) => {
    const url = await fileToDataUrl(file);
    setStamp(idx, { image: url });
  };

  // ===== wheel prizes dropdown =====
  const [wheelPrizes, setWheelPrizes] = React.useState<WheelPrize[]>([]);
  const [wheelErr, setWheelErr] = React.useState<string>('');
  const [wheelCampaignId, setWheelCampaignId] = React.useState<string>('');

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setWheelErr('');
      if (!appId) return;

      try {
        // ⬇️ endpoint from worker: /api/app/:id/wheel/prizes
        const res = await apiFetch<any>(`/api/app/${encodeURIComponent(appId)}/wheel/prizes`, {
          method: 'GET',
        });

        const list: WheelPrize[] = Array.isArray(res?.prizes)
          ? res.prizes
          : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.results)
          ? res.results
          : [];

        const normalized = (list || [])
          .map((x: any) => ({
            code: String(x.code || ''),
            title: String(x.title || x.name || x.code || ''),
            coins: Number(x.coins || 0),
            active: x.active,
            img: x.img ? String(x.img) : '',
          }))
          .filter((x) => x.code);

        if (alive) {
          setWheelPrizes(normalized);
          setWheelCampaignId(String(res?.campaign_id || ''));
        }
      } catch (e: any) {
        if (alive) setWheelErr(e?.message || String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [appId]);

  // если старый конфиг без snapshot reward — подтягиваем в reward.prize_code
  React.useEffect(() => {
    const legacy = String(v.reward_prize_code || '').trim();
    const snap = String(v.reward?.prize_code || '').trim();
    if (legacy && !snap) {
      setP({
        reward: {
          ...(v.reward || {}),
          source: 'wheel',
          prize_code: legacy,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  const rewardWarn =
    !!v.reward_enabled &&
    (!String(v.reward?.prize_code || '').trim() && !String(v.reward_prize_code || '').trim());

  // ===== section accordions =====
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    texts: true,
    cover: true,
    layout: true,
    reward: true,
    campaign: false,
    stamps: true,
  });

  // ===== stamps accordion open map =====
  const [stampOpen, setStampOpen] = React.useState<Record<number, boolean>>({});
  React.useEffect(() => {
    setStampOpen((m) => {
      if (Object.keys(m).length) return m;
      return v.styles?.length ? { 0: true } : {};
    });
  }, [v.styles?.length]);

  const campaignSummary = (() => {
    if (!v.campaign_enabled) return 'выключено';
    const s = String(v.campaign_start || '').trim();
    const e = String(v.campaign_end || '').trim();
    const id = String(v.campaign_id || '').trim();
    const parts = [
      v.campaign_title ? String(v.campaign_title) : 'Акция',
      s && e ? `${s} → ${e}` : s ? `c ${s}` : e ? `до ${e}` : 'без дат',
      id ? `id: ${id}` : 'id: —',
    ];
    return parts.join(' · ');
  })();

  return (
    <div className="be">
      <Acc
        title="Тексты"
        sub={<span className="beMut">заголовок, подзаголовок, кнопки</span>}
        open={!!open.texts}
        onToggle={() => setOpen((m) => ({ ...m, texts: !m.texts }))}
      >
        <div className="beGrid2">
          <Field label="Заголовок">
            <Input value={toStr(v.title)} onChange={(e) => setP({ title: e.target.value })} />
          </Field>
          <Field label="Подзаголовок">
            <Input value={toStr(v.subtitle)} onChange={(e) => setP({ subtitle: e.target.value })} />
          </Field>
        </div>

        <div className="beGrid2">
          <Field label='Кнопка “Отметить”'>
            <Input
              value={toStr(v.btn_collect)}
              onChange={(e) => setP({ btn_collect: e.target.value })}
            />
          </Field>

          <Field label='Кнопка “Получено”'>
            <Input value={toStr(v.btn_done)} onChange={(e) => setP({ btn_done: e.target.value })} />
          </Field>
        </div>

        <div className="beHint">
          PIN в паспорте <b>всегда включён</b> (мы убрали переключатель, чтобы не ломать логику кассира).
        </div>
      </Acc>

      <Acc
        title="Обложка"
        sub={<span className="beMut">картинка + превью</span>}
        open={!!open.cover}
        onToggle={() => setOpen((m) => ({ ...m, cover: !m.cover }))}
      >
        <Field
          label="Картинка (обложка)"
          hint="Можно вставить ссылку или загрузить файлом (сохраним как dataURL)."
        >
          <div className="beRow">
            <Input
              value={toStr(v.cover_url)}
              onChange={(e) => setP({ cover_url: e.target.value })}
              placeholder="https://..."
              style={{ flex: 1 }}
            />
            <label className="beUploadBtn" style={{ cursor: 'pointer' }}>
              Загрузить
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCover(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <button
              type="button"
              className="beMiniBtn"
              disabled={!v.cover_url}
              onClick={() => setP({ cover_url: '' })}
            >
              Убрать
            </button>
          </div>

          {v.cover_url ? (
            <div style={{ marginTop: 10 }}>
              <img
                src={String(v.cover_url)}
                alt=""
                style={{
                  width: '100%',
                  maxHeight: 180,
                  objectFit: 'cover',
                  borderRadius: 14,
                  border: '1px solid rgba(15,23,42,.10)',
                }}
              />
            </div>
          ) : null}
        </Field>
      </Acc>

      <Acc
        title="Сетка и начисления"
        sub={<span className="beMut">колонки + монеты за штамп</span>}
        open={!!open.layout}
        onToggle={() => setOpen((m) => ({ ...m, layout: !m.layout }))}
      >
        <div className="beGrid2">
          <Field label="Колонки сетки" hint="1..6">
            <Input
              type="number"
              value={String(v.grid_cols)}
              onChange={(e) => setP({ grid_cols: clamp(toNum(e.target.value, 3), 1, 6) })}
              min={1}
              max={6}
              step={1}
            />
          </Field>

          <Field label="Монеты за штамп" hint="server-side: начислять при каждом подтверждённом штампе">
            <Input
              type="number"
              value={String(v.collect_coins)}
              onChange={(e) =>
                setP({ collect_coins: Math.max(0, Math.round(toNum(e.target.value, 0))) })
              }
              min={0}
              step={1}
            />
          </Field>
        </div>
      </Acc>

      <Acc
        title="Акция / период"
        sub={<span className="beMut">{campaignSummary}</span>}
        open={!!open.campaign}
        onToggle={() => setOpen((m) => ({ ...m, campaign: !m.campaign }))}
        right={
          <Toggle
            checked={!!v.campaign_enabled}
            onChange={(x) => setP({ campaign_enabled: !!x })}
            label="Включено"
            hint={null}
          />
        }
      >
        <div className="beRow" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="beMiniBtn"
            onClick={() => {
              const now = new Date();
              const s = fmtYYYYMMDD(firstDayOfMonth(now));
              const e = fmtYYYYMMDD(lastDayOfMonth(now));
              setP({ campaign_start: s, campaign_end: e });
            }}
            disabled={!v.campaign_enabled}
          >
            Этот месяц
          </button>

          <button
            type="button"
            className="beMiniBtn"
            onClick={() => {
              const now = new Date();
              const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
              const s = fmtYYYYMMDD(firstDayOfMonth(next));
              const e = fmtYYYYMMDD(lastDayOfMonth(next));
              setP({ campaign_start: s, campaign_end: e });
            }}
            disabled={!v.campaign_enabled}
          >
            Следующий месяц
          </button>

          <button
            type="button"
            className="beMiniBtn"
            onClick={() => {
              const s = fmtYYYYMMDD(new Date());
              const e = fmtYYYYMMDD(addDays(new Date(), 7));
              setP({ campaign_start: s, campaign_end: e });
            }}
            disabled={!v.campaign_enabled}
          >
            7 дней
          </button>

          <button
            type="button"
            className="beMiniBtn"
            onClick={() => {
              const s = fmtYYYYMMDD(new Date());
              const e = fmtYYYYMMDD(addDays(new Date(), 14));
              setP({ campaign_start: s, campaign_end: e });
            }}
            disabled={!v.campaign_enabled}
          >
            14 дней
          </button>

          <span style={{ flex: 1 }} />

          <button
            type="button"
            className="beMiniBtn"
            onClick={() => setP({ campaign_id: genCampaignId('passport') })}
          >
            Новая акция (id)
          </button>
        </div>

        <div className="beGrid2" style={{ marginTop: 10 }}>
          <Field label="Название акции" hint="Для кабинета/мини-аппа (бейдж/заголовок периода)">
            <Input
              value={toStr(v.campaign_title)}
              onChange={(e) => setP({ campaign_title: e.target.value })}
              disabled={!v.campaign_enabled}
            />
          </Field>

          <Field
            label="campaign_id"
            hint="Ключ акции. Новый id = новый прогресс (не смешивается с прошлым)."
          >
            <Input
              value={toStr(v.campaign_id)}
              onChange={(e) => setP({ campaign_id: e.target.value })}
              placeholder="passport_202602_ab12"
              disabled={!v.campaign_enabled}
            />
          </Field>
        </div>

        <div className="beGrid2">
          <Field label="Дата начала (YYYY-MM-DD)">
            <Input
              value={toStr(v.campaign_start)}
              onChange={(e) => setP({ campaign_start: e.target.value })}
              placeholder="2026-02-01"
              disabled={!v.campaign_enabled}
            />
          </Field>

          <Field label="Дата окончания (YYYY-MM-DD)">
            <Input
              value={toStr(v.campaign_end)}
              onChange={(e) => setP({ campaign_end: e.target.value })}
              placeholder="2026-02-29"
              disabled={!v.campaign_enabled}
            />
          </Field>
        </div>

        <div className="beGrid2">
          <Field
            label="Поведение после окончания"
            hint="freeze — блокируем штампы и выдачу. freeze_allow_claim — штампы блокируем, но приз можно забрать ещё N дней. ignore — только для аналитики/бейджа."
          >
            <select
              className="beSelect"
              value={toStr(v.campaign_on_end)}
              onChange={(e) => setP({ campaign_on_end: e.target.value })}
              disabled={!v.campaign_enabled}
            >
              <option value="freeze_allow_claim">freeze_allow_claim (рекоменд.)</option>
              <option value="freeze">freeze (жёстко)</option>
              <option value="ignore">ignore (только инфо)</option>
            </select>
          </Field>

          <Field label="grace_days" hint="Сколько дней после окончания можно забрать приз (только для freeze_allow_claim)">
            <Input
              type="number"
              min={0}
              step={1}
              value={String(toNum(v.campaign_grace_days, 3))}
              onChange={(e) => setP({ campaign_grace_days: clamp(toNum(e.target.value, 3), 0, 365) })}
              disabled={!v.campaign_enabled || toStr(v.campaign_on_end) !== 'freeze_allow_claim'}
            />
          </Field>
        </div>

        <div className="beGrid2">
          <Field label="Текст бейджа" hint="Короткий текст (например “до 2026-02-29”). Можно оставить пустым.">
            <Input
              value={toStr(v.campaign_badge_text)}
              onChange={(e) => setP({ campaign_badge_text: e.target.value })}
              placeholder="до 2026-02-29"
              disabled={!v.campaign_enabled}
            />
          </Field>

          <Field label="Комментарий" hint="Только для кабинета (внутренние заметки).">
            <Input
              value={toStr(v.campaign_note)}
              onChange={(e) => setP({ campaign_note: e.target.value })}
              placeholder="мартовская акция для бариста"
              disabled={!v.campaign_enabled}
            />
          </Field>
        </div>

        <div className="beHint">
          Важно: campaign_id нужен, чтобы новая акция (6 кофе → 10 пиво) начиналась с нуля и не смешивалась с прошлой.
          Даты — для UI/аналитики + контроля поведения “после окончания” (это реализуем в воркере).
        </div>
      </Acc>

      <Acc
        title="Приз за завершение"
        sub={
          <span className="beMut">
            сохраняем <b>snapshot</b> приза (чтобы изменения колеса не ломали паспорт)
          </span>
        }
        open={!!open.reward}
        onToggle={() => setOpen((m) => ({ ...m, reward: !m.reward }))}
        right={
          <Toggle checked={!!v.reward_enabled} onChange={(x) => setP({ reward_enabled: !!x })} label="Включено" />
        }
      >
        <div className="beGrid2">
          <Field label="Заголовок приза">
            <Input value={toStr(v.reward_title)} onChange={(e) => setP({ reward_title: e.target.value })} />
          </Field>

          <Field label="Текст">
            <Input value={toStr(v.reward_text)} onChange={(e) => setP({ reward_text: e.target.value })} />
          </Field>
        </div>

        <Field
          label="Приз из колеса"
          hint={
            <>
              Подтягиваем призы колеса и сохраняем <b>snapshot</b> в <code>reward</code> (code/title/coins). Поэтому если
              потом призы колеса поменяются — паспорт всё равно выдаст выбранный приз.
            </>
          }
        >
          <div className="beRow">
            <select
              className="beSelect"
              value={toStr(v.reward?.prize_code || v.reward_prize_code)}
              onChange={(e) => {
                const code = e.target.value;
                const pr = wheelPrizes.find((x) => x.code === code);
                const coins = Math.max(0, Math.floor(Number(pr?.coins || 0)));

                setP({
                  reward_prize_code: code, // legacy
                  reward: {
                    source: 'wheel',
                    prize_code: code,
                    prize_title: String(pr?.title || code || ''),
                    coins,
                    wheel_campaign_id: wheelCampaignId || '',
                  },
                });
              }}
              style={{ flex: 1 }}
              disabled={!v.reward_enabled}
            >
              <option value="">— выбрать приз —</option>
              {wheelPrizes
                .filter((p) => p.code)
                .map((p) => {
                  const coins = Math.max(0, Math.floor(Number(p.coins || 0)));
                  const active = p.active === undefined ? true : !!Number(p.active);
                  const label = `${p.title || p.code} — (${p.code})${coins > 0 ? ` · ${coins} мон.` : ''}${
                    !active ? ' · OFF' : ''
                  }`;
                  return (
                    <option key={p.code} value={p.code}>
                      {label}
                    </option>
                  );
                })}
            </select>

            <button
              type="button"
              className="beMiniBtn"
              onClick={() =>
                setP({
                  reward_prize_code: '',
                  reward: { ...(v.reward || {}), prize_code: '', prize_title: '', coins: 0 },
                })
              }
              disabled={!v.reward_enabled || !(v.reward?.prize_code || v.reward_prize_code)}
            >
              Очистить
            </button>
          </div>

          {wheelErr ? (
            <div className="beHint" style={{ marginTop: 8, opacity: 0.9 }}>
              Не удалось загрузить призы колеса: <b>{wheelErr}</b> (проверь endpoint).
            </div>
          ) : null}

          {rewardWarn ? (
            <div className="beHint" style={{ marginTop: 8, color: '#ffcc66', opacity: 1 }}>
              Включена выдача приза, но не выбран приз — приз не будет выдан.
            </div>
          ) : null}

          {v.reward?.prize_code ? (
            <div className="beHint" style={{ marginTop: 8 }}>
              Snapshot: <b>{toStr(v.reward.prize_title || v.reward.prize_code)}</b>
              {Number(v.reward?.coins || 0) > 0 ? (
                <>
                  {' '}
                  · <b>{Math.max(0, Math.floor(Number(v.reward.coins || 0)))} мон.</b>
                </>
              ) : null}
              {v.reward?.wheel_campaign_id ? (
                <>
                  {' '}
                  · wheel_campaign_id: <code>{toStr(v.reward.wheel_campaign_id)}</code>
                </>
              ) : null}
            </div>
          ) : null}
        </Field>

        {/* fallback manual input (на всякий) */}
        <Field label="(Ручной ввод) reward_prize_code" hint="Если не хочешь зависеть от списка — можно вписать вручную.">
          <Input
            value={toStr(v.reward?.prize_code || v.reward_prize_code)}
            onChange={(e) =>
              setP({
                reward_prize_code: e.target.value,
                reward: { ...(v.reward || {}), source: 'wheel', prize_code: e.target.value },
              })
            }
            placeholder="free_coffee_6"
            disabled={!v.reward_enabled}
          />
        </Field>
      </Acc>

      <Acc
        title="Карточки / штампы"
        sub={<span className="beMut">{v.styles.length} шт.</span>}
        open={!!open.stamps}
        onToggle={() => setOpen((m) => ({ ...m, stamps: !m.stamps }))}
        right={
          <div className="beRow" style={{ gap: 8 }}>
            <button
              className="beMiniBtn"
              type="button"
              onClick={() => {
                // автокоды, если пустые: name -> code
                const next = clone(v);
                next.styles = (next.styles || []).map((st: any, i: number) => {
                  const code = String(st?.code || '').trim();
                  if (code) return st;
                  const name = String(st?.name || '').trim();
                  const slug = toCodeSlug(name);
                  return { ...st, code: slug || `item_${i + 1}` };
                });
                next.require_pin = true;
                onChange(ensureDefaults(next));
              }}
              title="Заполнить пустые code из name"
            >
              Авто code
            </button>

            <button className="beMiniBtn" type="button" onClick={addStamp}>
              + Добавить
            </button>
          </div>
        }
      >
        {v.styles.length ? (
          <div className="beAccList" style={{ marginTop: 4 }}>
            {v.styles.map((st: any, idx: number) => {
              const isOpen = !!stampOpen[idx];
              const imgLabel = st?.image
                ? String(st.image).startsWith('data:')
                  ? 'Загружено'
                  : 'URL'
                : 'Нет';

              return (
                <div key={idx} className={'beAcc' + (isOpen ? ' is-open' : '')}>
                  <div className="beAcc__hdr" onClick={() => setStampOpen((m) => ({ ...m, [idx]: !m[idx] }))}>
                    <div className="beAcc__left">
                      <div className="beAcc__title">{toStr(st?.name) ? toStr(st?.name) : `Карточка #${idx + 1}`}</div>
                      <div className="beAcc__sub">
                        <span className="beMut">
                          code: <b>{toStr(st?.code) || '—'}</b>
                        </span>
                        <span className="beDot" />
                        <span className="beMut">
                          картинка: <b>{imgLabel}</b>
                        </span>
                      </div>
                    </div>

                    <div className="beAcc__right" onClick={(e) => e.stopPropagation()}>
                      <IconBtn title="Вверх" disabled={idx === 0} onClick={() => moveStamp(idx, -1)}>
                        ↑
                      </IconBtn>
                      <IconBtn
                        title="Вниз"
                        disabled={idx === v.styles.length - 1}
                        onClick={() => moveStamp(idx, 1)}
                      >
                        ↓
                      </IconBtn>
                      <button
                        type="button"
                        className="beDanger"
                        onClick={() => {
                          if (confirm('Удалить эту карточку?')) deleteStamp(idx);
                        }}
                      >
                        Удалить
                      </button>
                      <button
                        type="button"
                        className="beChevron"
                        onClick={() => setStampOpen((m) => ({ ...m, [idx]: !m[idx] }))}
                      >
                        {isOpen ? '▴' : '▾'}
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="beAcc__body">
                      <div className="beGrid2">
                        <Field label="code" hint="ID для D1/API (лучше без пробелов)">
                          <Input
                            value={toStr(st?.code)}
                            onChange={(e) => setStamp(idx, { code: e.target.value })}
                            placeholder="day1"
                          />
                        </Field>

                        <Field label="name">
                          <Input
                            value={toStr(st?.name)}
                            onChange={(e) => setStamp(idx, { name: e.target.value })}
                            placeholder="День 1"
                          />
                        </Field>
                      </div>

                      <Field label="desc">
                        <Input
                          value={toStr(st?.desc)}
                          onChange={(e) => setStamp(idx, { desc: e.target.value })}
                          placeholder="Сделайте покупку"
                        />
                      </Field>

                      <Field label="image" hint="Можно вставить ссылку или загрузить файлом (dataURL).">
                        <div className="beRow">
                          <Input
                            value={toStr(st?.image)}
                            onChange={(e) => setStamp(idx, { image: e.target.value })}
                            placeholder="https://..."
                            style={{ flex: 1 }}
                          />
                          <label className="beUploadBtn" style={{ cursor: 'pointer' }}>
                            Загрузить
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadStampImg(idx, f);
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="beMiniBtn"
                            disabled={!st?.image}
                            onClick={() => setStamp(idx, { image: '' })}
                          >
                            Убрать
                          </button>
                        </div>

                        {st?.image ? (
                          <div style={{ marginTop: 10 }}>
                            <img
                              src={String(st.image)}
                              alt=""
                              style={{
                                width: '100%',
                                maxHeight: 160,
                                objectFit: 'cover',
                                borderRadius: 14,
                                border: '1px solid rgba(15,23,42,.10)',
                              }}
                            />
                          </div>
                        ) : null}
                      </Field>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="beHint">Карточек пока нет — нажми “+ Добавить”.</div>
        )}
      </Acc>

      {/* local styles (same vibe as wheel editor) */}
      <style>{`
        .be{ display:grid; gap:12px; }
        .beGrid2{ display:grid; gap:12px; grid-template-columns: 1fr 1fr; }
        .beField{ display:grid; gap:6px; }
        .beLab{ font-weight: 800; }
        .beHint{ font-size: 12px; opacity: .75; line-height: 1.35; }
        .beAccList{ display:grid; gap:10px; }
        .beAcc{ border-radius: 16px; border: 1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.6); overflow:hidden; }
        .beAcc__hdr{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; cursor:pointer; }
        .beAcc__left{ min-width:0; }
        .beAcc__title{ font-weight: 900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .beAcc__sub{ display:flex; align-items:center; gap:8px; margin-top:2px; flex-wrap:wrap; }
        .beAcc__right{ display:flex; align-items:center; gap:8px; }
        .beDot{ width:4px; height:4px; border-radius:999px; background: rgba(15,23,42,.35); }
        .beMut{ font-size:12px; opacity:.75; }
        .beAcc__body{ padding:12px; border-top:1px solid rgba(15,23,42,.10); background: rgba(255,255,255,.55); }
        .beMini{ border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); border-radius:10px; padding:6px 10px; cursor:pointer; }
        .beMini:disabled{ opacity:.5; cursor:not-allowed; }
        .beMiniBtn{ border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); border-radius:999px; padding:6px 10px; cursor:pointer; }
        .beMiniBtn:disabled{ opacity:.5; cursor:not-allowed; }
        .beDanger{ border:1px solid rgba(239,68,68,.35); background: rgba(239,68,68,.10); border-radius:10px; padding:6px 10px; cursor:pointer; }
        .beChevron{ border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); border-radius:10px; padding:6px 10px; cursor:pointer; }
        .beRow{ display:flex; align-items:center; gap:10px; }
        .beChk{ display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; border:1px solid rgba(15,23,42,.10); background: rgba(255,255,255,.6); }
        .beUploadBtn{ display:inline-flex; align-items:center; justify-content:center;
          border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65);
          border-radius:999px; padding:6px 12px; cursor:pointer; }
        .beSelect{ height: 40px; border-radius: 12px; padding: 0 10px; border: 1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); width:100%; }
        @media (max-width: 900px){
          .beGrid2{ grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
