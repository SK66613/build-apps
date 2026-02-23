// sg-cabinet-react/src/constructor/editors/StylesPassportEditor.tsx
import React from 'react';
import { Input } from '../../components/ui';

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

type TierRewardKind = 'item' | 'coins';

type Tier = {
  tier_id: 1 | 2 | 3;
  enabled: boolean;

  title: string;
  subtitle: string;

  // days from first stamp (start)
  window_days: number;

  reward_enabled: boolean;
  reward_title: string;
  reward_text: string;

  reward_kind: TierRewardKind;

  // if reward_kind === 'coins'
  reward_coins: number;

  // if reward_kind === 'item'
  reward_cost_coins: number;

  reward_img: string;

  stamps: Stamp[];
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
function toInt(v: any, d = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.trunc(n);
}
function toStr(v: any) {
  return String(v ?? '');
}
function normDateYYYYMMDD(v: any): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
}
async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result || ''));
    rd.onerror = () => reject(new Error('file read error'));
    rd.readAsDataURL(file);
  });
}

function ensureStamp(src: any): Stamp {
  return {
    code: toStr(src?.code),
    name: toStr(src?.name),
    desc: toStr(src?.desc),
    image: toStr(src?.image),
  };
}

function ensureTier(src: any, tierId: 1 | 2 | 3): Tier {
  const t: Tier = {
    tier_id: tierId,
    enabled: src?.enabled === false ? false : true,

    title: toStr(src?.title || (tierId === 1 ? 'Уровень 1' : tierId === 2 ? 'Уровень 2' : 'Уровень 3')),
    subtitle: toStr(src?.subtitle || ''),

    window_days: clamp(toInt(src?.window_days ?? (tierId === 1 ? 30 : tierId === 2 ? 60 : 90), 30), 1, 365),

    reward_enabled: src?.reward_enabled === false ? false : true,
    reward_title: toStr(src?.reward_title || (tierId === 1 ? '🎁 Награда' : '🎁 Награда')),
    reward_text: toStr(src?.reward_text || 'Приз будет выдан кассиром после подтверждения.'),

    reward_kind: (String(src?.reward_kind || 'item') === 'coins' ? 'coins' : 'item') as TierRewardKind,
    reward_coins: Math.max(0, toInt(src?.reward_coins ?? 0, 0)),
    reward_cost_coins: Math.max(0, toInt(src?.reward_cost_coins ?? 0, 0)),
    reward_img: toStr(src?.reward_img || ''),

    stamps: Array.isArray(src?.stamps) ? src.stamps.map(ensureStamp) : [],
  };

  // normalize empty codes (keep as-is, but trim)
  t.stamps = (t.stamps || []).map((s) => ({ ...s, code: toStr(s.code).trim() }));

  return t;
}

function ensureDefaults(src: any) {
  const p = { ...(src || {}) };

  // layout
  if (p.grid_cols === undefined) p.grid_cols = 3;

  // ✅ PIN всегда включен
  p.require_pin = true;

  // coins per stamp (server-side award on collected stamp)
  if (p.collect_coins === undefined) p.collect_coins = 0;

  // texts
  if (p.title === undefined) p.title = 'Паспорт';
  if (p.subtitle === undefined) p.subtitle = '';
  if (p.cover_url === undefined) p.cover_url = '';

  if (p.btn_collect === undefined) p.btn_collect = 'Отметить';
  if (p.btn_done === undefined) p.btn_done = 'Получено';

  // global passport deadline (hard stop), ISO YYYY-MM-DD or empty
  if (p.until_date === undefined) p.until_date = '';

  // tiers: fixed 3
  const rawTiers = Array.isArray(p.tiers) ? p.tiers : [];
  const byId: Record<number, any> = {};
  for (const t of rawTiers) {
    const id = Number(t?.tier_id);
    if (id === 1 || id === 2 || id === 3) byId[id] = t;
  }
  p.tiers = [
    ensureTier(byId[1], 1),
    ensureTier(byId[2], 2),
    ensureTier(byId[3], 3),
  ];

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
        <span style={{ fontWeight: 900 }}>{label}</span>
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

function coins(n: number) {
  const v = Math.max(0, Math.floor(Number(n || 0)));
  return v.toLocaleString('ru-RU');
}

export default function StylesPassportEditor({ value, onChange }: Props) {
  const v = React.useMemo(() => ensureDefaults(value), [value]);

  const setP = (patch: any) => {
    const next = ensureDefaults({ ...clone(v), ...(patch || {}) });
    next.require_pin = true; // ✅ always
    onChange(next);
  };

  const setTier = (tierId: 1 | 2 | 3, patch: any) => {
    const next = clone(v);
    const i = (tierId - 1) as 0 | 1 | 2;
    next.tiers[i] = ensureTier({ ...(next.tiers[i] || {}), ...(patch || {}), tier_id: tierId }, tierId);
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const setStamp = (tierId: 1 | 2 | 3, idx: number, patch: any) => {
    const next = clone(v);
    const i = (tierId - 1) as 0 | 1 | 2;
    const t = ensureTier(next.tiers[i], tierId);
    t.stamps[idx] = ensureStamp({ ...(t.stamps[idx] || {}), ...(patch || {}) });
    next.tiers[i] = t;
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const addStamp = (tierId: 1 | 2 | 3) => {
    const next = clone(v);
    const i = (tierId - 1) as 0 | 1 | 2;
    const t = ensureTier(next.tiers[i], tierId);
    t.stamps.push({ code: '', name: '', desc: '', image: '' });
    next.tiers[i] = t;
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const deleteStamp = (tierId: 1 | 2 | 3, idx: number) => {
    const next = clone(v);
    const i = (tierId - 1) as 0 | 1 | 2;
    const t = ensureTier(next.tiers[i], tierId);
    t.stamps.splice(idx, 1);
    next.tiers[i] = t;
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const moveStamp = (tierId: 1 | 2 | 3, idx: number, dir: -1 | 1) => {
    const next = clone(v);
    const i = (tierId - 1) as 0 | 1 | 2;
    const t = ensureTier(next.tiers[i], tierId);
    const j = idx + dir;
    if (j < 0 || j >= t.stamps.length) return;
    const tmp = t.stamps[idx];
    t.stamps[idx] = t.stamps[j];
    t.stamps[j] = tmp;
    next.tiers[i] = t;
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const uploadCover = async (file: File) => {
    const url = await fileToDataUrl(file);
    setP({ cover_url: url });
  };

  const uploadTierRewardImg = async (tierId: 1 | 2 | 3, file: File) => {
    const url = await fileToDataUrl(file);
    setTier(tierId, { reward_img: url });
  };

  const uploadStampImg = async (tierId: 1 | 2 | 3, idx: number, file: File) => {
    const url = await fileToDataUrl(file);
    setStamp(tierId, idx, { image: url });
  };

  // ===== UI open maps =====
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    texts: true,
    cover: true,
    layout: true,
    deadline: true,
    economy: true,
    tiers: true,
  });

  const [tierOpen, setTierOpen] = React.useState<Record<number, boolean>>({ 1: true, 2: false, 3: false });

  // ===== Economy (coins) =====
  const collectCoins = Math.max(0, toInt(v.collect_coins ?? 0, 0));
  const tierCosts = (v.tiers || []).map((t: Tier) => {
    const stampsCount = (t.stamps || []).length;
    const stampsCost = stampsCount * collectCoins;

    const rewardCost =
      !t.reward_enabled
        ? 0
        : t.reward_kind === 'coins'
        ? Math.max(0, toInt(t.reward_coins ?? 0, 0))
        : Math.max(0, toInt(t.reward_cost_coins ?? 0, 0));

    return {
      tier_id: t.tier_id,
      enabled: !!t.enabled,
      stampsCount,
      stampsCost,
      rewardCost,
      total: stampsCost + rewardCost,
    };
  });

  const totalCostAll = tierCosts.reduce((a: number, x: any) => a + (x.enabled ? x.total : 0), 0);

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
          PIN в паспорте <b>всегда включён</b> (переключатель убрали, чтобы не ломать логику кассира).
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

          <Field
            label="Монеты за штамп"
            hint="Если > 0 — при каждом подтверждённом штампе начисляем монеты пользователю (это расход в монетах)."
          >
            <Input
              type="number"
              value={String(collectCoins)}
              onChange={(e) => setP({ collect_coins: Math.max(0, Math.round(toNum(e.target.value, 0))) })}
              min={0}
              step={1}
            />
          </Field>
        </div>
      </Acc>

      <Acc
        title="Дедлайн паспорта"
        sub={<span className="beMut">жёстко остановить акцию датой</span>}
        open={!!open.deadline}
        onToggle={() => setOpen((m) => ({ ...m, deadline: !m.deadline }))}
      >
        <div className="beGrid2">
          <Field
            label="Дата окончания (YYYY-MM-DD)"
            hint="Пусто = без дедлайна. Если дедлайн прошёл — collect/выдача должны блокироваться (допишем в runtime/worker)."
          >
            <Input
              value={toStr(v.until_date)}
              onChange={(e) => setP({ until_date: normDateYYYYMMDD(e.target.value) || e.target.value })}
              placeholder="2026-06-01"
            />
          </Field>

          <div className="beField">
            <div className="beLab">Подсказка</div>
            <div className="beHint" style={{ opacity: 0.9 }}>
              Типовой кейс: “Акция на 3 месяца” или “только до конца весны”. Это простой флажок “стоп” без сложных
              сбросов.
            </div>
          </div>
        </div>
      </Acc>

      <Acc
        title="Экономика (в монетах)"
        sub={<span className="beMut">расход = штампы (монеты) + награда</span>}
        open={!!open.economy}
        onToggle={() => setOpen((m) => ({ ...m, economy: !m.economy }))}
      >
        <div className="beEco">
          <div className="beEco__row">
            <div className="beEco__k">Монеты за 1 штамп</div>
            <div className="beEco__v">{coins(collectCoins)} мон.</div>
          </div>

          <div className="beEco__hr" />

          {tierCosts.map((t: any) => (
            <div key={t.tier_id} className={'beEco__tier' + (t.enabled ? '' : ' is-off')}>
              <div className="beEco__row">
                <div className="beEco__k">
                  Tier {t.tier_id} {t.enabled ? '' : <span className="beTagOff">OFF</span>}
                </div>
                <div className="beEco__v">{coins(t.enabled ? t.total : 0)} мон.</div>
              </div>
              <div className="beEco__sub">
                Штампы: {t.stampsCount} × {coins(collectCoins)} = <b>{coins(t.stampsCost)}</b> мон.
                <span className="beDot" />
                Награда: <b>{coins(t.rewardCost)}</b> мон.
              </div>
            </div>
          ))}

          <div className="beEco__hr" />

          <div className="beEco__row">
            <div className="beEco__k" style={{ fontWeight: 900 }}>
              Суммарный расход (все включённые tiers)
            </div>
            <div className="beEco__v" style={{ fontWeight: 900 }}>
              {coins(totalCostAll)} мон.
            </div>
          </div>

          <div className="beHint" style={{ marginTop: 10 }}>
            Тут всё считается в <b>монетах</b>. Перевод в ₽/$/€ — через стоимость монеты в настройках проекта (это уже в
            кабинете/аналитике).
          </div>
        </div>
      </Acc>

      <Acc
        title="Tiers (3 уровня) + карточки внутри"
        sub={<span className="beMut">каждый tier — своё окно по времени и своя награда</span>}
        open={!!open.tiers}
        onToggle={() => setOpen((m) => ({ ...m, tiers: !m.tiers }))}
      >
        <div className="beAccList" style={{ marginTop: 4 }}>
          {(v.tiers as Tier[]).map((t) => {
            const isOpen = !!tierOpen[t.tier_id];
            const stampsCount = (t.stamps || []).length;

            return (
              <div key={t.tier_id} className={'beAcc' + (isOpen ? ' is-open' : '')}>
                <div className="beAcc__hdr" onClick={() => setTierOpen((m) => ({ ...m, [t.tier_id]: !m[t.tier_id] }))}>
                  <div className="beAcc__left">
                    <div className="beAcc__title">
                      Tier {t.tier_id}: {toStr(t.title) || `Уровень ${t.tier_id}`}
                      {!t.enabled ? <span className="beTagOff" style={{ marginLeft: 10 }}>OFF</span> : null}
                    </div>
                    <div className="beAcc__sub">
                      <span className="beMut">
                        окно: <b>{Math.max(1, toInt(t.window_days, 30))} дн.</b>
                      </span>
                      <span className="beDot" />
                      <span className="beMut">
                        карточек: <b>{stampsCount}</b>
                      </span>
                      <span className="beDot" />
                      <span className="beMut">
                        награда:{' '}
                        <b>
                          {t.reward_enabled
                            ? t.reward_kind === 'coins'
                              ? `${coins(t.reward_coins)} мон.`
                              : `${coins(t.reward_cost_coins)} мон.`
                            : 'выкл'}
                        </b>
                      </span>
                    </div>
                  </div>

                  <div className="beAcc__right" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="beMiniBtn"
                      type="button"
                      onClick={() => addStamp(t.tier_id)}
                      disabled={!t.enabled}
                      title={!t.enabled ? 'Включи tier, чтобы добавлять карточки' : 'Добавить карточку'}
                    >
                      + Карточка
                    </button>
                    <button type="button" className="beChevron" onClick={() => setTierOpen((m) => ({ ...m, [t.tier_id]: !m[t.tier_id] }))}>
                      {isOpen ? '▴' : '▾'}
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="beAcc__body">
                    <div className="beGrid2">
                      <Toggle
                        checked={!!t.enabled}
                        onChange={(x) => setTier(t.tier_id, { enabled: !!x })}
                        label="Tier включён"
                        hint="Если выключено — tier не участвует (и в экономике, и в выдаче)."
                      />

                      <Field label="Окно (дней со старта)" hint="Сколько дней даём на закрытие этого tier с первого штампа.">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          step={1}
                          value={String(Math.max(1, toInt(t.window_days, 30)))}
                          onChange={(e) => setTier(t.tier_id, { window_days: clamp(toInt(e.target.value, 30), 1, 365) })}
                          disabled={!t.enabled}
                        />
                      </Field>
                    </div>

                    <div className="beGrid2">
                      <Field label="Заголовок tier">
                        <Input
                          value={toStr(t.title)}
                          onChange={(e) => setTier(t.tier_id, { title: e.target.value })}
                          disabled={!t.enabled}
                        />
                      </Field>

                      <Field label="Подзаголовок tier">
                        <Input
                          value={toStr(t.subtitle)}
                          onChange={(e) => setTier(t.tier_id, { subtitle: e.target.value })}
                          disabled={!t.enabled}
                        />
                      </Field>
                    </div>

                    <div className="beHr" />

                    <div className="beGrid2">
                      <Toggle
                        checked={!!t.reward_enabled}
                        onChange={(x) => setTier(t.tier_id, { reward_enabled: !!x })}
                        label="Награда включена"
                        hint="Если выключено — tier может быть просто прогрессом/квестом без награды."
                      />

                      <Field label="Тип награды" hint="Монеты — прямой расход в монетах. Приз/товар — укажи себестоимость в монетах.">
                        <select
                          className="beSelect"
                          value={toStr(t.reward_kind)}
                          onChange={(e) => setTier(t.tier_id, { reward_kind: e.target.value === 'coins' ? 'coins' : 'item' })}
                          disabled={!t.enabled || !t.reward_enabled}
                        >
                          <option value="item">Приз / товар</option>
                          <option value="coins">Монеты</option>
                        </select>
                      </Field>
                    </div>

                    <div className="beGrid2">
                      <Field label="Заголовок награды">
                        <Input
                          value={toStr(t.reward_title)}
                          onChange={(e) => setTier(t.tier_id, { reward_title: e.target.value })}
                          disabled={!t.enabled || !t.reward_enabled}
                        />
                      </Field>

                      <Field label="Текст награды">
                        <Input
                          value={toStr(t.reward_text)}
                          onChange={(e) => setTier(t.tier_id, { reward_text: e.target.value })}
                          disabled={!t.enabled || !t.reward_enabled}
                        />
                      </Field>
                    </div>

                    <div className="beGrid2">
                      {t.reward_kind === 'coins' ? (
                        <Field label="Награда (монет)" hint="Это и есть себестоимость tier (в монетах).">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={String(Math.max(0, toInt(t.reward_coins, 0)))}
                            onChange={(e) => setTier(t.tier_id, { reward_coins: Math.max(0, Math.round(toNum(e.target.value, 0))) })}
                            disabled={!t.enabled || !t.reward_enabled}
                          />
                        </Field>
                      ) : (
                        <Field label="Себестоимость приза (в монетах)" hint="Сколько это стоит магазину. Перевод в валюту — через стоимость монеты.">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={String(Math.max(0, toInt(t.reward_cost_coins, 0)))}
                            onChange={(e) => setTier(t.tier_id, { reward_cost_coins: Math.max(0, Math.round(toNum(e.target.value, 0))) })}
                            disabled={!t.enabled || !t.reward_enabled}
                          />
                        </Field>
                      )}

                      <Field label="Картинка награды (URL или upload)">
                        <div className="beRow">
                          <Input
                            value={toStr(t.reward_img)}
                            onChange={(e) => setTier(t.tier_id, { reward_img: e.target.value })}
                            placeholder="https://..."
                            style={{ flex: 1 }}
                            disabled={!t.enabled || !t.reward_enabled}
                          />
                          <label className="beUploadBtn" style={{ cursor: 'pointer' }}>
                            Загрузить
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadTierRewardImg(t.tier_id, f);
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="beMiniBtn"
                            disabled={!t.reward_img || !t.enabled || !t.reward_enabled}
                            onClick={() => setTier(t.tier_id, { reward_img: '' })}
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
                                maxHeight: 140,
                                objectFit: 'cover',
                                borderRadius: 14,
                                border: '1px solid rgba(15,23,42,.10)',
                              }}
                            />
                          </div>
                        ) : null}
                      </Field>
                    </div>

                    <div className="beHr" />

                    <div className="beStampsHdr">
                      <div>
                        <div className="beLab" style={{ marginBottom: 4 }}>Карточки / штампы внутри tier</div>
                        <div className="beHint">Коды лучше без пробелов. Эти карточки и будут “плиткой” в мини-аппе.</div>
                      </div>
                      <button className="beMiniBtn" type="button" onClick={() => addStamp(t.tier_id)} disabled={!t.enabled}>
                        + Добавить
                      </button>
                    </div>

                    {t.stamps.length ? (
                      <div className="beAccList" style={{ marginTop: 10 }}>
                        {t.stamps.map((st: Stamp, idx: number) => {
                          const imgLabel = st?.image ? (String(st.image).startsWith('data:') ? 'Загружено' : 'URL') : 'Нет';

                          return (
                            <div key={idx} className="beStampCard">
                              <div className="beStampCard__top">
                                <div className="beStampCard__title">
                                  {toStr(st?.name) ? toStr(st?.name) : `Карточка #${idx + 1}`}
                                </div>
                                <div className="beStampCard__right">
                                  <IconBtn title="Вверх" disabled={idx === 0} onClick={() => moveStamp(t.tier_id, idx, -1)}>
                                    ↑
                                  </IconBtn>
                                  <IconBtn
                                    title="Вниз"
                                    disabled={idx === t.stamps.length - 1}
                                    onClick={() => moveStamp(t.tier_id, idx, 1)}
                                  >
                                    ↓
                                  </IconBtn>
                                  <button
                                    type="button"
                                    className="beDanger"
                                    onClick={() => {
                                      if (confirm('Удалить эту карточку?')) deleteStamp(t.tier_id, idx);
                                    }}
                                  >
                                    Удалить
                                  </button>
                                </div>
                              </div>

                              <div className="beStampCard__meta">
                                <span className="beMut">
                                  code: <b>{toStr(st?.code) || '—'}</b>
                                </span>
                                <span className="beDot" />
                                <span className="beMut">
                                  картинка: <b>{imgLabel}</b>
                                </span>
                              </div>

                              <div className="beGrid2" style={{ marginTop: 10 }}>
                                <Field label="code" hint="ID для D1/API (лучше без пробелов)">
                                  <Input
                                    value={toStr(st?.code)}
                                    onChange={(e) => setStamp(t.tier_id, idx, { code: e.target.value })}
                                    placeholder="visit_1"
                                    disabled={!t.enabled}
                                  />
                                </Field>

                                <Field label="name">
                                  <Input
                                    value={toStr(st?.name)}
                                    onChange={(e) => setStamp(t.tier_id, idx, { name: e.target.value })}
                                    placeholder="Посещение 1"
                                    disabled={!t.enabled}
                                  />
                                </Field>
                              </div>

                              <Field label="desc">
                                <Input
                                  value={toStr(st?.desc)}
                                  onChange={(e) => setStamp(t.tier_id, idx, { desc: e.target.value })}
                                  placeholder="Сделайте покупку"
                                  disabled={!t.enabled}
                                />
                              </Field>

                              <Field label="image" hint="Можно вставить ссылку или загрузить файлом (dataURL).">
                                <div className="beRow">
                                  <Input
                                    value={toStr(st?.image)}
                                    onChange={(e) => setStamp(t.tier_id, idx, { image: e.target.value })}
                                    placeholder="https://..."
                                    style={{ flex: 1 }}
                                    disabled={!t.enabled}
                                  />
                                  <label className="beUploadBtn" style={{ cursor: 'pointer' }}>
                                    Загрузить
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) uploadStampImg(t.tier_id, idx, f);
                                        e.currentTarget.value = '';
                                      }}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="beMiniBtn"
                                    disabled={!st?.image || !t.enabled}
                                    onClick={() => setStamp(t.tier_id, idx, { image: '' })}
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
                                        maxHeight: 140,
                                        objectFit: 'cover',
                                        borderRadius: 14,
                                        border: '1px solid rgba(15,23,42,.10)',
                                      }}
                                    />
                                  </div>
                                ) : null}
                              </Field>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="beHint">В этом tier пока нет карточек — нажми “+ Добавить”.</div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Acc>

      <style>{`
        .be{ display:grid; gap:12px; }
        .beGrid2{ display:grid; gap:12px; grid-template-columns: 1fr 1fr; }
        .beField{ display:grid; gap:6px; }
        .beLab{ font-weight: 900; }
        .beHint{ font-size: 12px; opacity: .75; line-height: 1.35; }
        .beAccList{ display:grid; gap:10px; }
        .beAcc{ border-radius: 16px; border: 1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.6); overflow:hidden; }
        .beAcc__hdr{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; cursor:pointer; }
        .beAcc__left{ min-width:0; }
        .beAcc__title{ font-weight: 950; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
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
        .beHr{ height:1px; background: rgba(15,23,42,.10); margin: 12px 0; }
        .beTagOff{ display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:900;
          border:1px solid rgba(239,68,68,.35); background: rgba(239,68,68,.10); color: rgba(239,68,68,.95); }
        .beEco{ border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); border-radius:16px; padding:12px; }
        .beEco__row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .beEco__k{ font-weight: 800; }
        .beEco__v{ font-weight: 900; }
        .beEco__hr{ height:1px; background: rgba(15,23,42,.10); margin: 10px 0; }
        .beEco__tier{ padding:10px; border-radius:14px; border:1px solid rgba(15,23,42,.10); background: rgba(255,255,255,.55); margin-top:10px; }
        .beEco__tier.is-off{ opacity:.6; }
        .beEco__sub{ margin-top:6px; font-size:12px; opacity:.8; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .beStampsHdr{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .beStampCard{ border-radius: 16px; border: 1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.62); padding: 12px; }
        .beStampCard__top{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .beStampCard__title{ font-weight: 950; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .beStampCard__right{ display:flex; align-items:center; gap:8px; }
        .beStampCard__meta{ margin-top: 4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        @media (max-width: 900px){
          .beGrid2{ grid-template-columns: 1fr; }
          .beStampCard__top{ align-items:flex-start; flex-direction:column; }
          .beStampCard__right{ width:100%; justify-content:flex-end; }
          .beStampsHdr{ flex-direction:column; align-items:stretch; }
        }
      `}</style>
    </div>
  );
}
