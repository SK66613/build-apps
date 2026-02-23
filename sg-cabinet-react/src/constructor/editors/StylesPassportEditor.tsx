// sg-cabinet-react/src/constructor/editors/StylesPassportEditor.tsx
import React from 'react';
import { Input } from '../../components/ui';

type Props = {
  value: any;
  onChange: (next: any) => void;
};

type TierId = 1 | 2 | 3;

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
function toInt(v: any, d: number) {
  const n = Math.round(toNum(v, d));
  return Number.isFinite(n) ? n : d;
}
function toStr(v: any) {
  return String(v ?? '');
}
function safeBool(v: any) {
  return !!(v === true || v === 1 || v === '1' || v === 'true');
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result || ''));
    rd.onerror = () => reject(new Error('file read error'));
    rd.readAsDataURL(file);
  });
}

/**
 * ===== Blueprint schema (новый) =====
 * {
 *   title, subtitle, cover_url,
 *   btn_collect, btn_done,
 *   grid_cols,
 *   require_pin: true,
 *   collect_coins, // cost per stamp in coins (if >0)
 *   passport_deadline_mode: 'none'|'until_date',
 *   passport_deadline_until: 'YYYY-MM-DD',
 *   tiers: [
 *     { id: 1|2|3, enabled, title, subtitle, window_mode:'none'|'days', window_days,
 *       reward_enabled, reward_title, reward_text, reward_kind:'none'|'coins'|'item',
 *       reward_coins, reward_cost_coins, reward_img,
 *       stamps:[{code,name,desc,image}]
 *     }, ...
 *   ]
 * }
 */

function ensureTierDefaults(t: any, id: TierId) {
  const tier = { ...(t || {}) };

  tier.id = id;
  if (tier.enabled === undefined) tier.enabled = true;

  if (tier.title === undefined) tier.title = id === 1 ? 'Круг 1' : id === 2 ? 'Круг 2' : 'Круг 3';
  if (tier.subtitle === undefined)
    tier.subtitle =
      id === 1 ? 'Собери первые штампы' : id === 2 ? 'Уровень повыше' : 'Финальный круг';

  // per-tier window from start
  if (tier.window_mode === undefined) tier.window_mode = 'none'; // none | days
  if (tier.window_days === undefined) tier.window_days = 30;

  // reward
  if (tier.reward_enabled === undefined) tier.reward_enabled = id === 3; // по умолчанию только финал
  if (tier.reward_title === undefined)
    tier.reward_title = id === 3 ? '🎁 Финальный приз' : '🎁 Приз';
  if (tier.reward_text === undefined)
    tier.reward_text = 'Приз будет отправлен вам в бот после завершения круга.';

  if (tier.reward_kind === undefined) tier.reward_kind = tier.reward_enabled ? 'item' : 'none'; // none|coins|item
  if (tier.reward_coins === undefined) tier.reward_coins = 0; // for coins reward
  if (tier.reward_cost_coins === undefined) tier.reward_cost_coins = 0; // for item reward cost in coins
  if (tier.reward_img === undefined) tier.reward_img = '';

  if (!Array.isArray(tier.stamps)) tier.stamps = [];
  tier.stamps = tier.stamps.map((st: any) => ({
    code: toStr(st?.code),
    name: toStr(st?.name),
    desc: toStr(st?.desc),
    image: toStr(st?.image),
  }));

  return tier;
}

function ensureDefaults(src: any) {
  const p = { ...(src || {}) };

  // base
  if (p.grid_cols === undefined) p.grid_cols = 3;

  p.require_pin = true; // always on
  if (p.collect_coins === undefined) p.collect_coins = 0;

  if (p.title === undefined) p.title = 'Паспорт';
  if (p.subtitle === undefined) p.subtitle = '';
  if (p.cover_url === undefined) p.cover_url = '';

  if (p.btn_collect === undefined) p.btn_collect = 'Отметить';
  if (p.btn_done === undefined) p.btn_done = 'Получено';

  // passport deadline (global)
  if (p.passport_deadline_mode === undefined) p.passport_deadline_mode = 'none'; // none | until_date
  if (p.passport_deadline_until === undefined) p.passport_deadline_until = ''; // YYYY-MM-DD
  if (p.passport_deadline_title === undefined) p.passport_deadline_title = '⏳ До конца акции';
  if (p.passport_deadline_text === undefined) p.passport_deadline_text = 'Успейте завершить паспорт до окончания периода.';

  // tiers fixed 3
  const t = Array.isArray(p.tiers) ? p.tiers : [];
  const t1 = ensureTierDefaults(t.find((x: any) => Number(x?.id) === 1), 1);
  const t2 = ensureTierDefaults(t.find((x: any) => Number(x?.id) === 2), 2);
  const t3 = ensureTierDefaults(t.find((x: any) => Number(x?.id) === 3), 3);
  p.tiers = [t1, t2, t3];

  // legacy migration support:
  // if old "styles" exists and all tiers empty → put styles into tier1
  if (Array.isArray(p.styles) && p.styles.length && p.tiers.every((x: any) => !(x?.stamps?.length))) {
    p.tiers[0].stamps = p.styles.map((st: any) => ({
      code: toStr(st?.code),
      name: toStr(st?.name),
      desc: toStr(st?.desc),
      image: toStr(st?.image),
    }));
  }

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
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(!!e.target.checked)} />
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

function CoinsBadge({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.round(value || 0));
  return (
    <div className="beBadge">
      <div className="beBadge__k">{label}</div>
      <div className="beBadge__v">{v} мон.</div>
    </div>
  );
}

function calcMaxCosts(p: any) {
  const v = ensureDefaults(p);
  const collect = Math.max(0, Math.round(Number(v.collect_coins || 0)));

  const tiers = (v.tiers || []).map((t: any) => ensureTierDefaults(t, (t?.id || 1) as TierId));
  const stampsTotal = tiers.reduce((s: number, t: any) => s + (t?.stamps?.length || 0), 0);
  const stampsCost = stampsTotal * collect;

  let rewardsCost = 0;
  for (const t of tiers) {
    if (!safeBool(t.reward_enabled)) continue;
    const kind = String(t.reward_kind || 'none');
    if (kind === 'coins') rewardsCost += Math.max(0, Math.round(Number(t.reward_coins || 0)));
    else if (kind === 'item') rewardsCost += Math.max(0, Math.round(Number(t.reward_cost_coins || 0)));
  }

  return {
    stampsTotal,
    stampsCost,
    rewardsCost,
    maxTotalCost: stampsCost + rewardsCost,
  };
}

export default function StylesPassportEditor({ value, onChange }: Props) {
  const v = React.useMemo(() => ensureDefaults(value), [value]);

  const setP = (patch: any) => {
    const next = ensureDefaults({ ...clone(v), ...(patch || {}) });
    next.require_pin = true;
    onChange(next);
  };

  const setTier = (tierId: TierId, patch: any) => {
    const next = clone(v);
    const i = (next.tiers || []).findIndex((x: any) => Number(x?.id) === tierId);
    if (i < 0) return;
    next.tiers[i] = ensureTierDefaults({ ...(next.tiers[i] || {}), ...(patch || {}) }, tierId);
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const setStamp = (tierId: TierId, idx: number, patch: any) => {
    const next = clone(v);
    const i = (next.tiers || []).findIndex((x: any) => Number(x?.id) === tierId);
    if (i < 0) return;
    const t = ensureTierDefaults(next.tiers[i], tierId);
    t.stamps[idx] = { ...(t.stamps[idx] || {}), ...(patch || {}) };
    next.tiers[i] = ensureTierDefaults(t, tierId);
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const addStamp = (tierId: TierId) => {
    const next = clone(v);
    const i = (next.tiers || []).findIndex((x: any) => Number(x?.id) === tierId);
    if (i < 0) return;
    const t = ensureTierDefaults(next.tiers[i], tierId);
    t.stamps.push({ code: '', name: '', desc: '', image: '' });
    next.tiers[i] = ensureTierDefaults(t, tierId);
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const deleteStamp = (tierId: TierId, idx: number) => {
    const next = clone(v);
    const i = (next.tiers || []).findIndex((x: any) => Number(x?.id) === tierId);
    if (i < 0) return;
    const t = ensureTierDefaults(next.tiers[i], tierId);
    t.stamps.splice(idx, 1);
    next.tiers[i] = ensureTierDefaults(t, tierId);
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const moveStamp = (tierId: TierId, idx: number, dir: -1 | 1) => {
    const next = clone(v);
    const i = (next.tiers || []).findIndex((x: any) => Number(x?.id) === tierId);
    if (i < 0) return;
    const t = ensureTierDefaults(next.tiers[i], tierId);
    const j = idx + dir;
    if (j < 0 || j >= t.stamps.length) return;
    const tmp = t.stamps[idx];
    t.stamps[idx] = t.stamps[j];
    t.stamps[j] = tmp;
    next.tiers[i] = ensureTierDefaults(t, tierId);
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const uploadCover = async (file: File) => {
    const url = await fileToDataUrl(file);
    setP({ cover_url: url });
  };

  const uploadTierRewardImg = async (tierId: TierId, file: File) => {
    const url = await fileToDataUrl(file);
    setTier(tierId, { reward_img: url });
  };

  const uploadStampImg = async (tierId: TierId, idx: number, file: File) => {
    const url = await fileToDataUrl(file);
    setStamp(tierId, idx, { image: url });
  };

  const econ = React.useMemo(() => calcMaxCosts(v), [v]);

  // ===== accordions
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    texts: true,
    cover: true,
    layout: true,
    deadline: false,
    tier1: true,
    tier2: false,
    tier3: false,
  });

  // stamps open maps per tier
  const [stampOpen, setStampOpen] = React.useState<Record<string, boolean>>({});
  const keySO = (tierId: TierId, idx: number) => `${tierId}:${idx}`;

  React.useEffect(() => {
    // if empty map — open first stamp of tier1 if exists
    if (Object.keys(stampOpen).length) return;
    const t1len = v?.tiers?.[0]?.stamps?.length || 0;
    if (t1len) setStampOpen({ [keySO(1, 0)]: true });
  }, [v?.tiers?.[0]?.stamps?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const TierBlock = ({ tierId }: { tierId: TierId }) => {
    const t = ensureTierDefaults(v.tiers.find((x: any) => Number(x?.id) === tierId), tierId);
    const stamps = t.stamps || [];
    const tierLabel = tierId === 1 ? 'Tier 1' : tierId === 2 ? 'Tier 2' : 'Tier 3';

    const tierStampsCost = Math.max(0, Math.round(Number(v.collect_coins || 0))) * stamps.length;
    const tierRewardCost =
      safeBool(t.reward_enabled) && String(t.reward_kind) === 'coins'
        ? Math.max(0, Math.round(Number(t.reward_coins || 0)))
        : safeBool(t.reward_enabled) && String(t.reward_kind) === 'item'
        ? Math.max(0, Math.round(Number(t.reward_cost_coins || 0)))
        : 0;

    return (
      <Acc
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 950 }}>{tierLabel}</span>
            {!safeBool(t.enabled) ? <span className="bePill bePillOff">OFF</span> : null}
          </div>
        }
        sub={
          <span className="beMut">
            {stamps.length} карточек · макс. расход {tierStampsCost + tierRewardCost} мон.
          </span>
        }
        open={!!open[`tier${tierId}`]}
        onToggle={() => setOpen((m) => ({ ...m, [`tier${tierId}`]: !m[`tier${tierId}`] }))}
        right={
          <Toggle
            checked={!!t.enabled}
            onChange={(x) => setTier(tierId, { enabled: !!x })}
            label="Включён"
          />
        }
      >
        <div className="beGrid2">
          <Field label="Название tier">
            <Input value={toStr(t.title)} onChange={(e) => setTier(tierId, { title: e.target.value })} />
          </Field>
          <Field label="Подзаголовок tier">
            <Input
              value={toStr(t.subtitle)}
              onChange={(e) => setTier(tierId, { subtitle: e.target.value })}
            />
          </Field>
        </div>

        <Acc
          title="Окно по времени (со старта tier)"
          sub={<span className="beMut">например “закрыть за 30 дней”</span>}
          open={!!open[`tier${tierId}_window`]}
          onToggle={() => setOpen((m) => ({ ...m, [`tier${tierId}_window`]: !m[`tier${tierId}_window`] }))}
        >
          <div className="beGrid2">
            <Field label="Режим" hint="Если days — считаем со дня первого штампа этого tier (нужно дописать в runtime/worker).">
              <select
                className="beSelect"
                value={toStr(t.window_mode)}
                onChange={(e) => setTier(tierId, { window_mode: e.target.value })}
              >
                <option value="none">Без окна</option>
                <option value="days">Закрыть за N дней</option>
              </select>
            </Field>

            <Field label="N дней" hint="Только если выбран режим “Закрыть за N дней”.">
              <Input
                type="number"
                min={1}
                step={1}
                value={String(toInt(t.window_days, 30))}
                disabled={toStr(t.window_mode) !== 'days'}
                onChange={(e) => setTier(tierId, { window_days: clamp(toInt(e.target.value, 30), 1, 365) })}
              />
            </Field>
          </div>

          <div className="beHint">
            Это пока <b>конфиг</b>. В мини-апп/воркере нужно: хранить старт tier и проверять окно при collect/open.
          </div>
        </Acc>

        <Acc
          title="Награда за tier"
          sub={<span className="beMut">самостоятельная структура (не из колеса)</span>}
          open={!!open[`tier${tierId}_reward`]}
          onToggle={() => setOpen((m) => ({ ...m, [`tier${tierId}_reward`]: !m[`tier${tierId}_reward`] }))}
          right={
            <Toggle
              checked={!!t.reward_enabled}
              onChange={(x) => setTier(tierId, { reward_enabled: !!x, reward_kind: x ? (t.reward_kind || 'item') : 'none' })}
              label="Награда"
            />
          }
        >
          <div className="beGrid2">
            <Field label="Заголовок">
              <Input
                value={toStr(t.reward_title)}
                onChange={(e) => setTier(tierId, { reward_title: e.target.value })}
                disabled={!safeBool(t.reward_enabled)}
              />
            </Field>
            <Field label="Текст">
              <Input
                value={toStr(t.reward_text)}
                onChange={(e) => setTier(tierId, { reward_text: e.target.value })}
                disabled={!safeBool(t.reward_enabled)}
              />
            </Field>
          </div>

          <div className="beGrid2">
            <Field label="Тип награды" hint="coins = начислить монеты, item = выдать приз (QR/redeem) + указать себестоимость в монетах.">
              <select
                className="beSelect"
                value={toStr(t.reward_kind)}
                onChange={(e) => setTier(tierId, { reward_kind: e.target.value })}
                disabled={!safeBool(t.reward_enabled)}
              >
                <option value="none">Нет</option>
                <option value="coins">Монеты</option>
                <option value="item">Товар/услуга</option>
              </select>
            </Field>

            {String(t.reward_kind) === 'coins' ? (
              <Field label="Сколько монет начислить" hint="Это же себестоимость tier-награды (в монетах).">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={String(toInt(t.reward_coins, 0))}
                  onChange={(e) => setTier(tierId, { reward_coins: Math.max(0, toInt(e.target.value, 0)) })}
                  disabled={!safeBool(t.reward_enabled)}
                />
              </Field>
            ) : (
              <Field label="Себестоимость награды (в монетах)" hint="Сколько это стоит владельцу. Нужна для экономики/аналитики.">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={String(toInt(t.reward_cost_coins, 0))}
                  onChange={(e) => setTier(tierId, { reward_cost_coins: Math.max(0, toInt(e.target.value, 0)) })}
                  disabled={!safeBool(t.reward_enabled)}
                />
              </Field>
            )}
          </div>

          <Field
            label="Картинка награды"
            hint="Можно URL или загрузить (dataURL). В мини-аппе покажем в карточке награды."
          >
            <div className="beRow">
              <Input
                value={toStr(t.reward_img)}
                onChange={(e) => setTier(tierId, { reward_img: e.target.value })}
                placeholder="https://..."
                style={{ flex: 1 }}
                disabled={!safeBool(t.reward_enabled)}
              />
              <label className="beUploadBtn" style={{ cursor: 'pointer' }}>
                Загрузить
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={!safeBool(t.reward_enabled)}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadTierRewardImg(tierId, f);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                className="beMiniBtn"
                disabled={!safeBool(t.reward_enabled) || !t.reward_img}
                onClick={() => setTier(tierId, { reward_img: '' })}
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

            <div className="beHint" style={{ marginTop: 8 }}>
              Макс. расход tier-награды: <b>{tierRewardCost} мон.</b>
            </div>
          </Field>
        </Acc>

        <Acc
          title="Карточки / штампы (внутри tier)"
          sub={<span className="beMut">{stamps.length} шт · расход на штампы {tierStampsCost} мон.</span>}
          open={!!open[`tier${tierId}_stamps`]}
          onToggle={() => setOpen((m) => ({ ...m, [`tier${tierId}_stamps`]: !m[`tier${tierId}_stamps`] }))}
          right={
            <button className="beMiniBtn" type="button" onClick={() => addStamp(tierId)}>
              + Добавить
            </button>
          }
        >
          {stamps.length ? (
            <div className="beAccList" style={{ marginTop: 4 }}>
              {stamps.map((st: any, idx: number) => {
                const isOpen = !!stampOpen[keySO(tierId, idx)];
                const imgLabel = st?.image
                  ? String(st.image).startsWith('data:')
                    ? 'Загружено'
                    : 'URL'
                  : 'Нет';

                return (
                  <div key={`${tierId}-${idx}`} className={'beAcc beAcc--inner' + (isOpen ? ' is-open' : '')}>
                    <div
                      className="beAcc__hdr"
                      onClick={() =>
                        setStampOpen((m) => ({ ...m, [keySO(tierId, idx)]: !m[keySO(tierId, idx)] }))
                      }
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
                        <IconBtn title="Вверх" disabled={idx === 0} onClick={() => moveStamp(tierId, idx, -1)}>
                          ↑
                        </IconBtn>
                        <IconBtn
                          title="Вниз"
                          disabled={idx === stamps.length - 1}
                          onClick={() => moveStamp(tierId, idx, 1)}
                        >
                          ↓
                        </IconBtn>
                        <button
                          type="button"
                          className="beDanger"
                          onClick={() => {
                            if (confirm('Удалить эту карточку?')) deleteStamp(tierId, idx);
                          }}
                        >
                          Удалить
                        </button>
                        <button
                          type="button"
                          className="beChevron"
                          onClick={() =>
                            setStampOpen((m) => ({ ...m, [keySO(tierId, idx)]: !m[keySO(tierId, idx)] }))
                          }
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
                              onChange={(e) => setStamp(tierId, idx, { code: e.target.value })}
                              placeholder="visit1"
                            />
                          </Field>

                          <Field label="name">
                            <Input
                              value={toStr(st?.name)}
                              onChange={(e) => setStamp(tierId, idx, { name: e.target.value })}
                              placeholder="Посещение 1"
                            />
                          </Field>
                        </div>

                        <Field label="desc">
                          <Input
                            value={toStr(st?.desc)}
                            onChange={(e) => setStamp(tierId, idx, { desc: e.target.value })}
                            placeholder="Сделайте покупку"
                          />
                        </Field>

                        <Field label="image" hint="Можно URL или загрузить (dataURL).">
                          <div className="beRow">
                            <Input
                              value={toStr(st?.image)}
                              onChange={(e) => setStamp(tierId, idx, { image: e.target.value })}
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
                                  if (f) uploadStampImg(tierId, idx, f);
                                  e.currentTarget.value = '';
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              className="beMiniBtn"
                              disabled={!st?.image}
                              onClick={() => setStamp(tierId, idx, { image: '' })}
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
            <div className="beHint">Карточек в этом tier пока нет — нажми “+ Добавить”.</div>
          )}
        </Acc>
      </Acc>
    );
  };

  return (
    <div className="be">
      <Acc
        title="Сводка экономики"
        sub={<span className="beMut">минимальная экономика из blueprint (в монетах)</span>}
        open={!!open.econ}
        onToggle={() => setOpen((m) => ({ ...m, econ: !m.econ }))}
      >
        <div className="beEconGrid">
          <CoinsBadge label="Всего карточек" value={econ.stampsTotal} />
          <CoinsBadge label="Расход на штампы" value={econ.stampsCost} />
          <CoinsBadge label="Расход на награды" value={econ.rewardsCost} />
          <CoinsBadge label="Макс. расход на 1 юзера" value={econ.maxTotalCost} />
        </div>
        <div className="beHint" style={{ marginTop: 8 }}>
          Себестоимость штампа = <b>монеты за штамп</b>. Себестоимость наград задаётся в каждом tier (монеты или cost_coins).
          Конвертацию в ₽/$/€ сделаем в кабинете через “стоимость монеты” в настройках проекта.
        </div>
      </Acc>

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
        <Field label="Картинка (обложка)" hint="Можно URL или загрузить файлом (dataURL).">
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
        sub={<span className="beMut">колонки + себестоимость штампа (монеты)</span>}
        open={!!open.layout}
        onToggle={() => setOpen((m) => ({ ...m, layout: !m.layout }))}
      >
        <div className="beGrid2">
          <Field label="Колонки сетки" hint="1..6">
            <Input
              type="number"
              value={String(toInt(v.grid_cols, 3))}
              onChange={(e) => setP({ grid_cols: clamp(toInt(e.target.value, 3), 1, 6) })}
              min={1}
              max={6}
              step={1}
            />
          </Field>

          <Field label="Монеты за штамп" hint="Это себестоимость штампа (в монетах). Начисляем при подтверждённом штампе.">
            <Input
              type="number"
              value={String(Math.max(0, toInt(v.collect_coins, 0)))}
              onChange={(e) => setP({ collect_coins: Math.max(0, toInt(e.target.value, 0)) })}
              min={0}
              step={1}
            />
          </Field>
        </div>
      </Acc>

      <Acc
        title="Дедлайн паспорта (общий)"
        sub={<span className="beMut">остановить акцию по дате</span>}
        open={!!open.deadline}
        onToggle={() => setOpen((m) => ({ ...m, deadline: !m.deadline }))}
      >
        <div className="beGrid2">
          <Field label="Режим">
            <select
              className="beSelect"
              value={toStr(v.passport_deadline_mode)}
              onChange={(e) => setP({ passport_deadline_mode: e.target.value })}
            >
              <option value="none">Без дедлайна</option>
              <option value="until_date">До даты (YYYY-MM-DD)</option>
            </select>
          </Field>

          <Field label="Дата окончания" hint="Только если выбран режим “До даты”.">
            <Input
              value={toStr(v.passport_deadline_until)}
              onChange={(e) => setP({ passport_deadline_until: e.target.value })}
              placeholder="2026-12-31"
              disabled={toStr(v.passport_deadline_mode) !== 'until_date'}
            />
          </Field>
        </div>

        <div className="beGrid2">
          <Field label="Заголовок">
            <Input
              value={toStr(v.passport_deadline_title)}
              onChange={(e) => setP({ passport_deadline_title: e.target.value })}
            />
          </Field>
          <Field label="Текст">
            <Input value={toStr(v.passport_deadline_text)} onChange={(e) => setP({ passport_deadline_text: e.target.value })} />
          </Field>
        </div>

        <div className="beHint">
          Это тоже пока <b>конфиг</b>: в runtime/worker при open/collect надо проверять дату и “закрывать” паспорт.
        </div>
      </Acc>

      <TierBlock tierId={1} />
      <TierBlock tierId={2} />
      <TierBlock tierId={3} />

      <style>{`
        .be{ display:grid; gap:12px; }

        .beGrid2{ display:grid; gap:12px; grid-template-columns: 1fr 1fr; }
        .beField{ display:grid; gap:6px; }
        .beLab{ font-weight: 900; }
        .beHint{ font-size: 12px; opacity: .78; line-height: 1.35; }
        .beAccList{ display:grid; gap:10px; }

        .beAcc{
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.62);
          overflow:hidden;
          box-shadow: 0 6px 20px rgba(15,23,42,.06);
        }
        .beAcc--inner{
          background: rgba(255,255,255,.55);
          box-shadow: none;
        }

        .beAcc__hdr{
          display:flex; align-items:center; justify-content:space-between;
          gap:12px; padding:10px 12px; cursor:pointer;
        }
        .beAcc__left{ min-width:0; }
        .beAcc__title{ font-weight: 950; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .beAcc__sub{ display:flex; align-items:center; gap:8px; margin-top:2px; flex-wrap:wrap; }
        .beAcc__right{ display:flex; align-items:center; gap:8px; }
        .beDot{ width:4px; height:4px; border-radius:999px; background: rgba(15,23,42,.35); }
        .beMut{ font-size:12px; opacity:.75; }

        .beAcc__body{
          padding:12px;
          border-top:1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.58);
        }

        .beMini{
          border:1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.70);
          border-radius:10px;
          padding:6px 10px;
          cursor:pointer;
        }
        .beMini:disabled{ opacity:.5; cursor:not-allowed; }

        .beMiniBtn{
          border:1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.70);
          border-radius:999px;
          padding:6px 10px;
          cursor:pointer;
        }
        .beMiniBtn:disabled{ opacity:.5; cursor:not-allowed; }

        .beDanger{
          border:1px solid rgba(239,68,68,.35);
          background: rgba(239,68,68,.10);
          border-radius:10px;
          padding:6px 10px;
          cursor:pointer;
        }

        .beChevron{
          border:1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.70);
          border-radius:10px;
          padding:6px 10px;
          cursor:pointer;
        }

        .beRow{ display:flex; align-items:center; gap:10px; }

        .beChk{
          display:flex; align-items:center; gap:10px;
          padding:10px 12px;
          border-radius:12px;
          border:1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.70);
        }

        .beUploadBtn{
          display:inline-flex; align-items:center; justify-content:center;
          border:1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.70);
          border-radius:999px;
          padding:6px 12px;
          cursor:pointer;
        }

        .beSelect{
          height: 40px;
          border-radius: 12px;
          padding: 0 10px;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.70);
          width:100%;
        }

        .bePill{
          font-size: 11px;
          font-weight: 900;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(15,23,42,.04);
        }
        .bePillOff{
          border-color: rgba(239,68,68,.30);
          background: rgba(239,68,68,.10);
        }

        .beEconGrid{
          display:grid;
          gap:10px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .beBadge{
          border:1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.65);
          border-radius: 14px;
          padding: 10px 12px;
          display:grid;
          gap:4px;
        }
        .beBadge__k{
          font-size: 12px;
          opacity: .75;
          font-weight: 800;
        }
        .beBadge__v{
          font-size: 16px;
          font-weight: 950;
        }

        @media (max-width: 900px){
          .beGrid2{ grid-template-columns: 1fr; }
          .beEconGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  );
}
