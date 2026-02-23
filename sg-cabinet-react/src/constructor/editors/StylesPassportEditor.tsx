// sg-cabinet-react/src/constructor/editors/StylesPassportEditor.tsx
import React from 'react';
import { Input } from '../../components/ui';
import { useConstructorStore } from '../state/constructorStore';

type Props = {
  value: any;
  onChange: (next: any) => void;
};

type Stamp = {
  code: string;
  name: string;
  desc: string;
  image: string;
};

type TierRewardKind = 'none' | 'item' | 'coins';

type Tier = {
  id: 't1' | 't2' | 't3';

  // progression
  goal: number;            // how many stamps to complete this tier
  window_days: number;     // rolling window from user start (0 = no limit)

  // reward (independent from wheel)
  reward_enabled: boolean;
  reward_kind: TierRewardKind;

  reward_title: string;
  reward_text: string;
  reward_img: string;

  // if reward_kind = coins
  reward_coins: number;

  // economics (in coins) — расход владельца
  reward_cost_coins: number; // cost of this tier reward in coins (for analytics)
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

function ensureTierDefaults(t: any, id: Tier['id'], idx: number): Tier {
  const dGoal = idx === 0 ? 3 : idx === 1 ? 6 : 10;
  const dWindow = idx === 0 ? 30 : idx === 1 ? 60 : 90;

  const out: Tier = {
    id,

    goal: clamp(Math.round(toNum(t?.goal, dGoal)), 1, 999),
    window_days: clamp(Math.round(toNum(t?.window_days, dWindow)), 0, 3650),

    reward_enabled: t?.reward_enabled === undefined ? true : !!t.reward_enabled,
    reward_kind: (['none', 'item', 'coins'].includes(String(t?.reward_kind)) ? String(t?.reward_kind) : 'item') as TierRewardKind,

    reward_title: toStr(t?.reward_title) || (idx === 0 ? '🎁 Приз за 1 круг' : idx === 1 ? '🎁 Приз за 2 круг' : '🎁 Приз за 3 круг'),
    reward_text: toStr(t?.reward_text) || 'Приз будет выдан после завершения уровня.',
    reward_img: toStr(t?.reward_img),

    reward_coins: clamp(Math.round(toNum(t?.reward_coins, 0)), 0, 1_000_000),

    reward_cost_coins: clamp(Math.round(toNum(t?.reward_cost_coins, 0)), 0, 1_000_000),
  };

  // normalize for kind
  if (!out.reward_enabled) {
    out.reward_kind = 'none';
  } else {
    if (out.reward_kind === 'coins') {
      // ok
    } else if (out.reward_kind === 'item') {
      // ok
    } else {
      out.reward_kind = 'item';
    }
  }

  return out;
}

function ensureDefaults(src: any) {
  const p = { ...(src || {}) };

  // stamps
  if (!Array.isArray(p.styles)) p.styles = [];
  p.styles = (p.styles || []).map((st: any) => ({
    code: toStr(st?.code),
    name: toStr(st?.name),
    desc: toStr(st?.desc),
    image: toStr(st?.image),
  })) as Stamp[];

  // layout
  if (p.grid_cols === undefined) p.grid_cols = 3;

  // ✅ PIN always on
  p.require_pin = true;

  // economics: coins per stamp
  if (p.collect_coins === undefined) p.collect_coins = 0;
  if (p.collect_cost_coins === undefined) p.collect_cost_coins = 0; // cost for granting collect_coins (optional, base analytics)

  // texts
  if (p.title === undefined) p.title = 'Паспорт';
  if (p.subtitle === undefined) p.subtitle = '';
  if (p.cover_url === undefined) p.cover_url = '';
  if (p.btn_collect === undefined) p.btn_collect = 'Отметить';
  if (p.btn_done === undefined) p.btn_done = 'Получено';

  // campaign (global deadline)
  if (p.campaign_deadline_enabled === undefined) p.campaign_deadline_enabled = false;
  if (p.campaign_end_date === undefined) p.campaign_end_date = ''; // YYYY-MM-DD
  if (p.campaign_title === undefined) p.campaign_title = '⏳ До конца акции';
  if (p.campaign_text === undefined) p.campaign_text = 'Соберите уровни до завершения акции.';

  // rolling policy (config only here; runtime later)
  if (p.expire_policy === undefined) p.expire_policy = 'freeze'; // freeze | reset_all | reset_tier
  if (p.grace_days_redeem === undefined) p.grace_days_redeem = 7;

  // tiers
  if (!Array.isArray(p.tiers)) p.tiers = [];
  const t1 = ensureTierDefaults(p.tiers?.[0], 't1', 0);
  const t2 = ensureTierDefaults(p.tiers?.[1], 't2', 1);
  const t3 = ensureTierDefaults(p.tiers?.[2], 't3', 2);
  p.tiers = [t1, t2, t3];

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
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string; children: React.ReactNode }
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
  // (appId может пригодиться позже, оставим)
  useConstructorStore((s) => s.appId);

  const v = React.useMemo(() => ensureDefaults(value), [value]);

  const setP = (patch: any) => {
    const next = ensureDefaults({ ...clone(v), ...(patch || {}) });
    next.require_pin = true;
    onChange(next);
  };

  const setTier = (idx: 0 | 1 | 2, patch: Partial<Tier>) => {
    const next = clone(v);
    next.tiers = Array.isArray(next.tiers) ? next.tiers : [];
    next.tiers[idx] = ensureTierDefaults({ ...(next.tiers[idx] || {}), ...(patch || {}) }, (idx === 0 ? 't1' : idx === 1 ? 't2' : 't3'), idx);
    next.require_pin = true;
    onChange(ensureDefaults(next));
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

  const uploadTierImg = async (idx: 0 | 1 | 2, file: File) => {
    const url = await fileToDataUrl(file);
    setTier(idx, { reward_img: url });
  };

  const [open, setOpen] = React.useState<Record<string, boolean>>({
    texts: true,
    cover: true,
    economy: true,
    deadlines: true,
    tiers: true,
    stamps: true,
  });

  const [stampOpen, setStampOpen] = React.useState<Record<number, boolean>>({});
  React.useEffect(() => {
    setStampOpen((m) => {
      if (Object.keys(m).length) return m;
      return v.styles?.length ? { 0: true } : {};
    });
  }, [v.styles?.length]);

  const tiers: Tier[] = (Array.isArray(v.tiers) ? v.tiers : []) as any;

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
            <Input value={toStr(v.btn_collect)} onChange={(e) => setP({ btn_collect: e.target.value })} />
          </Field>

          <Field label='Кнопка “Получено”'>
            <Input value={toStr(v.btn_done)} onChange={(e) => setP({ btn_done: e.target.value })} />
          </Field>
        </div>

        <div className="beHint">
          PIN в паспорте <b>всегда включён</b> (переключатель убран, чтобы не ломать логику кассира).
        </div>
      </Acc>

      <Acc
        title="Обложка"
        sub={<span className="beMut">картинка + превью</span>}
        open={!!open.cover}
        onToggle={() => setOpen((m) => ({ ...m, cover: !m.cover }))}
      >
        <Field label="Картинка (обложка)" hint="Можно вставить ссылку или загрузить файлом (сохраним как dataURL).">
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
            <button type="button" className="beMiniBtn" disabled={!v.cover_url} onClick={() => setP({ cover_url: '' })}>
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
        title="Сетка и экономика"
        sub={<span className="beMut">колонки + монеты за штамп + себестоимость</span>}
        open={!!open.economy}
        onToggle={() => setOpen((m) => ({ ...m, economy: !m.economy }))}
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

          <Field label="Монеты за штамп" hint="Начислять при каждом подтверждённом штампе (server-side).">
            <Input
              type="number"
              value={String(v.collect_coins)}
              onChange={(e) => setP({ collect_coins: Math.max(0, Math.round(toNum(e.target.value, 0))) })}
              min={0}
              step={1}
            />
          </Field>
        </div>

        <div className="beGrid2">
          <Field
            label="Себестоимость “монет за штамп”"
            hint="В монетах. Если монеты за штамп — это расход, укажи сколько это стоит владельцу (для базовой аналитики)."
          >
            <Input
              type="number"
              value={String(v.collect_cost_coins)}
              onChange={(e) => setP({ collect_cost_coins: Math.max(0, Math.round(toNum(e.target.value, 0))) })}
              min={0}
              step={1}
            />
          </Field>

          <div className="beField">
            <div className="beLab">Подсказка</div>
            <div className="beHint" style={{ opacity: 0.85 }}>
              Стоимость 1 монеты (в руб/eur/usd) берём из настроек проекта. Здесь мы фиксируем расходы в монетах —
              чтобы в кабинете сразу считать деньги.
            </div>
          </div>
        </div>
      </Acc>

      <Acc
        title="Дедлайны"
        sub={<span className="beMut">общий дедлайн + сроки уровней от старта</span>}
        open={!!open.deadlines}
        onToggle={() => setOpen((m) => ({ ...m, deadlines: !m.deadlines }))}
      >
        <div className="beGrid2">
          <Toggle
            checked={!!v.campaign_deadline_enabled}
            onChange={(x) => setP({ campaign_deadline_enabled: !!x })}
            label="Включить общий дедлайн паспорта"
            hint="Когда дедлайн включён — после даты окончания сбор штампов блокируется (runtime поддержим отдельно)."
          />

          <Field label="Дата окончания" hint="YYYY-MM-DD (локальная дата владельца)">
            <Input
              type="date"
              value={toStr(v.campaign_end_date)}
              onChange={(e) => setP({ campaign_end_date: e.target.value })}
              disabled={!v.campaign_deadline_enabled}
            />
          </Field>
        </div>

        <div className="beGrid2">
          <Field label="Заголовок дедлайна">
            <Input value={toStr(v.campaign_title)} onChange={(e) => setP({ campaign_title: e.target.value })} />
          </Field>
          <Field label="Текст дедлайна">
            <Input value={toStr(v.campaign_text)} onChange={(e) => setP({ campaign_text: e.target.value })} />
          </Field>
        </div>

        <div className="beGrid2">
          <Field label="Политика после истечения tier-window" hint="Пока конфиг в blueprint (реализация в worker/runtime).">
            <select
              className="beSelect"
              value={toStr(v.expire_policy)}
              onChange={(e) => setP({ expire_policy: e.target.value })}
            >
              <option value="freeze">Freeze (заморозить прогресс)</option>
              <option value="reset_tier">Reset tier (сбросить текущий уровень)</option>
              <option value="reset_all">Reset all (сбросить всё)</option>
            </select>
          </Field>

          <Field label="Грейс-период на выдачу (дней)" hint="После дедлайна/окна можно ещё выдать приз N дней.">
            <Input
              type="number"
              min={0}
              step={1}
              value={String(toNum(v.grace_days_redeem, 7))}
              onChange={(e) => setP({ grace_days_redeem: clamp(toNum(e.target.value, 7), 0, 365) })}
            />
          </Field>
        </div>

        <div className="beHint">
          У каждого пользователя будет <b>start_at</b> при первом штампе. Для каждого tier можно задать свой срок
          <b>window_days</b> “со дня начала”.
        </div>
      </Acc>

      <Acc
        title="Уровни (3 tiers)"
        sub={<span className="beMut">порог, срок, награда, себестоимость</span>}
        open={!!open.tiers}
        onToggle={() => setOpen((m) => ({ ...m, tiers: !m.tiers }))}
      >
        <div className="beAccList">
          {([0, 1, 2] as const).map((i) => {
            const t = tiers[i] || ensureTierDefaults(null, i === 0 ? 't1' : i === 1 ? 't2' : 't3', i);
            const title =
              i === 0 ? `Tier 1` : i === 1 ? `Tier 2` : `Tier 3`;

            return (
              <div key={t.id} className="beAcc">
                <div className="beAcc__hdr" style={{ cursor: 'default' }}>
                  <div className="beAcc__left">
                    <div className="beAcc__title">{title}</div>
                    <div className="beAcc__sub">
                      <span className="beMut">
                        цель: <b>{t.goal}</b>
                      </span>
                      <span className="beDot" />
                      <span className="beMut">
                        срок: <b>{t.window_days ? `${t.window_days} дн.` : 'без лимита'}</b>
                      </span>
                      <span className="beDot" />
                      <span className="beMut">
                        награда: <b>{t.reward_enabled ? t.reward_kind : 'OFF'}</b>
                      </span>
                    </div>
                  </div>
                  <div className="beAcc__right">
                    <Toggle
                      checked={!!t.reward_enabled}
                      onChange={(x) => setTier(i, { reward_enabled: !!x, reward_kind: x ? (t.reward_kind === 'none' ? 'item' : t.reward_kind) : 'none' })}
                      label="Награда"
                    />
                  </div>
                </div>

                <div className="beAcc__body">
                  <div className="beGrid2">
                    <Field label="Порог (штампов)" hint="Сколько штампов нужно, чтобы закрыть этот уровень.">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={String(t.goal)}
                        onChange={(e) => setTier(i, { goal: clamp(toNum(e.target.value, t.goal), 1, 999) })}
                      />
                    </Field>

                    <Field
                      label="Срок уровня (дней от старта)"
                      hint="0 = без ограничения. Старт фиксируется при первом штампе пользователя."
                    >
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={String(t.window_days)}
                        onChange={(e) => setTier(i, { window_days: clamp(toNum(e.target.value, t.window_days), 0, 3650) })}
                      />
                    </Field>
                  </div>

                  <div className="beGrid2">
                    <Field label="Тип награды" hint="Независимо от колеса. Дальше в runtime/боте выдадим по этой структуре.">
                      <select
                        className="beSelect"
                        value={toStr(t.reward_kind)}
                        onChange={(e) => setTier(i, { reward_kind: e.target.value as any })}
                        disabled={!t.reward_enabled}
                      >
                        <option value="item">Товар/услуга (redeem)</option>
                        <option value="coins">Монеты</option>
                        <option value="none">Без награды</option>
                      </select>
                    </Field>

                    <Field label="Себестоимость награды (в монетах)" hint="Расход владельца для базовой аналитики.">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={String(t.reward_cost_coins)}
                        onChange={(e) => setTier(i, { reward_cost_coins: Math.max(0, Math.round(toNum(e.target.value, 0))) })}
                        disabled={!t.reward_enabled || t.reward_kind === 'none'}
                      />
                    </Field>
                  </div>

                  {t.reward_enabled && t.reward_kind === 'coins' ? (
                    <div className="beGrid2">
                      <Field label="Сколько монет выдать" hint="Начислим пользователю при закрытии уровня.">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={String(t.reward_coins)}
                          onChange={(e) => setTier(i, { reward_coins: Math.max(0, Math.round(toNum(e.target.value, 0))) })}
                        />
                      </Field>

                      <div className="beField">
                        <div className="beLab">Подсказка</div>
                        <div className="beHint" style={{ opacity: 0.85 }}>
                          Если награда — монеты, обычно <b>reward_cost_coins</b> = reward_coins (если 1 монета “стоит”
                          владельцу 1 монету). Можно задать иначе, если есть маржа/схема.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="beGrid2">
                    <Field label="Заголовок награды">
                      <Input
                        value={toStr(t.reward_title)}
                        onChange={(e) => setTier(i, { reward_title: e.target.value })}
                        disabled={!t.reward_enabled || t.reward_kind === 'none'}
                      />
                    </Field>

                    <Field label="Текст награды">
                      <Input
                        value={toStr(t.reward_text)}
                        onChange={(e) => setTier(i, { reward_text: e.target.value })}
                        disabled={!t.reward_enabled || t.reward_kind === 'none'}
                      />
                    </Field>
                  </div>

                  <Field label="Картинка награды" hint="URL или загрузка (dataURL). Покажем рядом со штампами в UI.">
                    <div className="beRow">
                      <Input
                        value={toStr(t.reward_img)}
                        onChange={(e) => setTier(i, { reward_img: e.target.value })}
                        placeholder="https://..."
                        style={{ flex: 1 }}
                        disabled={!t.reward_enabled || t.reward_kind === 'none'}
                      />
                      <label className="beUploadBtn" style={{ cursor: 'pointer', opacity: (!t.reward_enabled || t.reward_kind === 'none') ? 0.5 : 1 }}>
                        Загрузить
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadTierImg(i, f);
                            e.currentTarget.value = '';
                          }}
                          disabled={!t.reward_enabled || t.reward_kind === 'none'}
                        />
                      </label>
                      <button
                        type="button"
                        className="beMiniBtn"
                        disabled={!t.reward_enabled || t.reward_kind === 'none' || !t.reward_img}
                        onClick={() => setTier(i, { reward_img: '' })}
                      >
                        Убрать
                      </button>
                    </div>

                    {t.reward_img ? (
                      <div style={{ marginTop: 10 }}>
                        <img
                          src={String(t.reward_img)}
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
              </div>
            );
          })}
        </div>

        <div className="beHint">
          Идея: tiers — это “круги”. В runtime мы показываем текущий tier + следующую награду, а по закрытию создаём
          reward (issued) и переводим пользователя на следующий tier.
        </div>
      </Acc>

      <Acc
        title="Карточки / штампы"
        sub={<span className="beMut">{v.styles.length} шт.</span>}
        open={!!open.stamps}
        onToggle={() => setOpen((m) => ({ ...m, stamps: !m.stamps }))}
        right={
          <button className="beMiniBtn" type="button" onClick={addStamp}>
            + Добавить
          </button>
        }
      >
        {v.styles.length ? (
          <div className="beAccList" style={{ marginTop: 4 }}>
            {v.styles.map((st: any, idx: number) => {
              const isOpen = !!stampOpen[idx];
              const imgLabel = st?.image ? (String(st.image).startsWith('data:') ? 'Загружено' : 'URL') : 'Нет';

              return (
                <div key={idx} className={'beAcc' + (isOpen ? ' is-open' : '')}>
                  <div
                    className="beAcc__hdr"
                    onClick={() => setStampOpen((m) => ({ ...m, [idx]: !m[idx] }))}
                  >
                    <div className="beAcc__left">
                      <div className="beAcc__title">
                        {toStr(st?.name) ? toStr(st?.name) : `Карточка #${idx + 1}`}
                      </div>
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
                      <IconBtn title="Вниз" disabled={idx === v.styles.length - 1} onClick={() => moveStamp(idx, 1)}>
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
