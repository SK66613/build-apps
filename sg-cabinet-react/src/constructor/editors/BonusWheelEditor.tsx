// sg-cabinet-react/src/constructor/editors/BonusWheelEditor.tsx
import React from 'react';
import { Button, Input } from '../../components/ui';

type PrizeKind = 'coins' | 'item';

type Prize = {
  code: string;
  title: string;

  // visual
  img?: string;
  active?: boolean;

  // weight (int, relative; editor shows it as % but stores integer basis points)
  weight: number;

  // kind
  kind: PrizeKind;

  // coins
  coins?: number;

  // economics / inventory (item only)
  cost_cent?: number;
  cost_currency?: string; // 'RUB'|'EUR'|'USD'|...|'OTHER'
  cost_currency_custom?: string;

  track_qty?: boolean;     // reserve stock on issued
  qty_left?: number;       // left
  stop_when_zero?: boolean;// if qty_left<=0 => not participating
};

function num(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// configured percent <-> stored weight (basis points)
function weightToPctConfigured(weight: any) {
  const w = Math.max(0, Math.floor(num(weight, 0)));
  return w / 100; // 0..100 with decimals
}
function pctToWeightConfigured(pct: any) {
  const p = clamp(num(pct, 0), 0, 100);
  return Math.max(0, Math.round(p * 100)); // basis points
}

function calcRealPercentsFromWeights(prizes: Prize[]) {
  const ws = prizes.map((p) => (p.active === false ? 0 : Math.max(0, Math.floor(num(p.weight, 0)))));
  const sum = ws.reduce((a, b) => a + b, 0) || 1;
  return ws.map((w) => (w / sum) * 100);
}

function slugifyCode(name: string) {
  let s = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'e')
    .replace(/й/g, 'i')
    .replace(/[^a-z0-9а-я_-]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!s) s = 'prize';
  return s.slice(0, 32);
}

function ensureUniqueCode(base: string, used: Set<string>) {
  let c = base || 'prize';
  if (!used.has(c)) return c;

  // prize, prize_2, prize_3 ...
  let k = 2;
  while (used.has(`${c}_${k}`)) k++;
  return `${c}_${k}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onload = () => res(String(rd.result || ''));
    rd.onerror = () => rej(new Error('file_read_error'));
    rd.readAsDataURL(file);
  });
}

const CURRENCIES: Array<{ code: string; label: string; sym: string }> = [
  { code: 'RUB', label: '₽ RUB', sym: '₽' },
  { code: 'EUR', label: '€ EUR', sym: '€' },
  { code: 'USD', label: '$ USD', sym: '$' },
  { code: 'GBP', label: '£ GBP', sym: '£' },
  { code: 'TRY', label: '₺ TRY', sym: '₺' },
  { code: 'UAH', label: '₴ UAH', sym: '₴' },
  { code: 'KZT', label: '₸ KZT', sym: '₸' },
  { code: 'GEL', label: '₾ GEL', sym: '₾' },
  { code: 'AED', label: 'AED', sym: 'AED' },
  { code: 'OTHER', label: 'Другая…', sym: '' },
];

function getCurrencySym(p: Prize) {
  const c = String(p.cost_currency || 'RUB');
  if (c === 'OTHER') {
    const s = String(p.cost_currency_custom || '').trim();
    return s || '¤';
  }
  return CURRENCIES.find((x) => x.code === c)?.sym || c;
}

function normalizePrize(p: any): Prize {
  // Back-compat:
  // - old editor used {name, cost, currency, currency_custom, stock_qty, kind:'physical'}
  // - block uses {name}
  const title = String(p?.title ?? p?.name ?? '');
  const baseKind: PrizeKind =
    p?.kind === 'coins' ? 'coins' :
    p?.kind === 'item' ? 'item' :
    p?.kind === 'physical' ? 'item' :
    (Math.max(0, Math.floor(num(p?.coins, 0))) > 0 ? 'coins' : 'item');

  const active = p?.active === undefined ? true : !!p.active;

  const track_qty =
    (p?.track_qty === true) ||
    (Number(p?.track_qty || 0) === 1) ||
    (p?.stock_qty !== undefined) || // old field implies tracking
    false;

  const qty_left =
    p?.qty_left !== undefined ? Math.max(0, Math.floor(num(p.qty_left, 0))) :
    p?.stock_qty !== undefined ? Math.max(0, Math.floor(num(p.stock_qty, 0))) :
    0;

  const stop_when_zero =
    p?.stop_when_zero === undefined ? true : !!p.stop_when_zero;

  return {
    code: String(p?.code ?? ''),
    title,

    img: p?.img ? String(p.img) : '',
    weight: Math.max(0, Math.floor(num(p?.weight, pctToWeightConfigured(10)))),

    active,

    kind: baseKind,

    coins: baseKind === 'coins' ? Math.max(1, Math.floor(num(p?.coins, 1))) : 0,

    cost_cent:
      baseKind === 'item'
        ? Math.max(0, Math.floor(num(p?.cost_cent ?? p?.cost ?? 0, 0)))
        : 0,

    cost_currency: String(p?.cost_currency ?? p?.currency ?? 'RUB'),
    cost_currency_custom: String(p?.cost_currency_custom ?? p?.currency_custom ?? ''),

    track_qty: baseKind === 'item' ? !!track_qty : false,
    qty_left: baseKind === 'item' ? qty_left : 0,
    stop_when_zero: baseKind === 'item' ? !!stop_when_zero : true,
  };
}

export function BonusWheelEditor({
  value,
  onChange,
}: {
  value: any;
  onChange: (next: any) => void;
}) {
  const props = value || {};
  const prizesRaw = Array.isArray(props.prizes) ? props.prizes : [];

  const prizes: Prize[] = React.useMemo(() => prizesRaw.map(normalizePrize), [prizesRaw]);

  const set = (patch: any) => onChange({ ...props, ...patch });

  const setPrizes = (next: Prize[]) => {
    // guarantee unique codes inside the list (important for D1 uniqueness later)
    const used = new Set<string>();
    const fixed = next.map((p) => {
      const base = p.code ? String(p.code) : slugifyCode(p.title || '');
      const code = ensureUniqueCode(base, used);
      used.add(code);
      return { ...p, code };
    });
    set({ prizes: fixed });
  };

  const updPrize = (i: number, patch: Partial<Prize>) => {
    const next = prizes.map((p, idx) => (idx === i ? ({ ...p, ...patch } as Prize) : p));
    setPrizes(next);
  };

  const addPrize = () => {
    const next: Prize = {
      code: '', // will be auto-filled uniquely
      title: 'Приз',
      kind: 'item',
      coins: 0,
      cost_cent: 0,
      cost_currency: 'RUB',
      cost_currency_custom: '',
      track_qty: true,
      qty_left: 1,
      stop_when_zero: true,
      weight: pctToWeightConfigured(10),
      img: '',
      active: true,
    };
    setPrizes([...prizes, next]);
  };

  const delPrize = (i: number) => setPrizes(prizes.filter((_, idx) => idx !== i));

  const movePrize = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= prizes.length) return;
    const next = prizes.slice();
    const t = next[i];
    next[i] = next[j];
    next[j] = t;
    setPrizes(next);
  };

  const toggleActivePrize = (i: number) => {
    const p = prizes[i];
    const nextActive = p.active === false;
    // keep weight, but allow "0 weight" as separate control
    updPrize(i, { active: nextActive });
  };

  const realPerc = React.useMemo(() => calcRealPercentsFromWeights(prizes), [prizes]);

  // accordion open map
  const [openMap, setOpenMap] = React.useState<Record<number, boolean>>({});
  React.useEffect(() => {
    setOpenMap((m) => {
      if (Object.keys(m).length) return m;
      return prizes.length ? { 0: true } : {};
    });
  }, [prizes.length]);

  const spinCost = Math.max(0, Math.floor(num(props.spin_cost, 10)));

  return (
    <div className="sg-editor">
      {/* ===== Header fields ===== */}
      <div className="sg-editor__section">
        <div className="sg-editor__row">
          <div className="sg-editor__label">Заголовок</div>
          <Input
            value={String(props.title ?? '')}
            onChange={(e: any) => set({ title: e.target.value })}
          />
        </div>

        <div className="sg-editor__row">
          <div className="sg-editor__label">Стоимость прокрутки (монеты)</div>
          <Input
            type="number"
            value={spinCost}
            onChange={(e: any) =>
              set({ spin_cost: Math.max(0, Math.floor(num(e.target.value, 10))) })
            }
          />
          <div className="sg-editor__hint">
            Важно: в рантайме стоимость может читаться из <code>MiniState.config.wheel.spin_cost</code>, а воркер — из конфигурации приложения.
          </div>
        </div>
      </div>

      {/* ===== Prizes header ===== */}
      <div className="sg-editor__section">
        <div className="sg-editor__head">
          <div className="sg-editor__title">Сектора / призы</div>
          <Button onClick={addPrize}>+ Добавить приз</Button>
        </div>

        {/* ===== Prizes list ===== */}
        {prizes.map((p, i) => {
          const isOpen = !!openMap[i];
          const cfgPct = weightToPctConfigured(p.weight);
          const real = realPerc[i] || 0;
          const imgLabel =
            p.img && p.img.startsWith('data:') ? 'Загружено' : p.img ? 'URL' : 'Нет';
          const currencySym = getCurrencySym(p);

          return (
            <div key={p.code || i} className="sg-acc">
              <div
                className="sg-acc__head"
                onClick={() => setOpenMap((m) => ({ ...m, [i]: !m[i] }))}
              >
                <div className="sg-acc__headMain">
                  <div className="sg-acc__headTitle">
                    {p.title?.trim() ? p.title : `Приз #${i + 1}`}
                  </div>
                  <div className="sg-acc__headMeta">
                    <span>{p.kind === 'coins' ? 'Монеты' : 'Физический'}</span>
                    <span>· Настройка: {cfgPct.toFixed(1)}%</span>
                    <span>· Реально: {real.toFixed(2)}%</span>
                    {p.kind === 'item' ? (
                      <>
                        <span>· остаток: {Math.max(0, Math.floor(num(p.qty_left, 0)))}</span>
                        <span>
                          · себестоимость: {Math.max(0, Math.floor(num(p.cost_cent, 0)))} {currencySym}
                        </span>
                      </>
                    ) : null}
                    {p.active === false ? <span>· неактивен</span> : null}
                  </div>
                </div>

                <div className="sg-acc__headBtns" onClick={(e) => e.stopPropagation()}>
                  <Button onClick={() => movePrize(i, -1)}>↑</Button>
                  <Button onClick={() => movePrize(i, 1)}>↓</Button>
                  <Button onClick={() => toggleActivePrize(i)}>
                    {p.active === false ? 'Вкл' : 'Выкл'}
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirm('Удалить приз?')) delPrize(i);
                    }}
                  >
                    Удалить
                  </Button>
                  <Button
                    onClick={() => setOpenMap((m) => ({ ...m, [i]: !m[i] }))}
                    title={isOpen ? 'Свернуть' : 'Развернуть'}
                  >
                    {isOpen ? '▴' : '▾'}
                  </Button>
                </div>
              </div>

              {isOpen ? (
                <div className="sg-acc__body">
                  {/* Title */}
                  <div className="sg-editor__row">
                    <div className="sg-editor__label">Название</div>
                    <Input
                      value={p.title}
                      onChange={(e: any) => {
                        const title = e.target.value;
                        // auto-update code ONLY if it was empty or matched previous auto-slug
                        const prevAuto = slugifyCode(p.title || '');
                        const isAuto = !p.code || p.code === prevAuto || p.code.startsWith(prevAuto + '_');
                        updPrize(i, { title, code: isAuto ? '' : p.code });
                      }}
                    />
                    <div className="sg-editor__hint">
                      Код генерим автоматически и <b>уникализируем</b> внутри списка (prize, prize_2…).
                    </div>
                  </div>

                  {/* Type */}
                  <div className="sg-editor__row">
                    <div className="sg-editor__label">Тип приза</div>
                    <label style={{ marginRight: 12 }}>
                      <input
                        type="radio"
                        checked={p.kind === 'coins'}
                        onChange={() => updPrize(i, { kind: 'coins', coins: Math.max(1, Math.floor(num(p.coins, 1))) })}
                      />
                      {' '}Монеты
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={p.kind === 'item'}
                        onChange={() => updPrize(i, { kind: 'item', coins: 0, track_qty: true, stop_when_zero: true })}
                      />
                      {' '}Физический
                    </label>
                  </div>

                  {/* Kind-specific */}
                  {p.kind === 'coins' ? (
                    <div className="sg-editor__row">
                      <div className="sg-editor__label">Сколько монет начислять</div>
                      <Input
                        type="number"
                        value={Math.max(1, Math.floor(num(p.coins, 1)))}
                        onChange={(e: any) =>
                          updPrize(i, { coins: Math.max(1, Math.floor(num(e.target.value, 1))) })
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <div className="sg-editor__row">
                        <div className="sg-editor__label">Себестоимость (cent)</div>
                        <Input
                          type="number"
                          value={Math.max(0, Math.floor(num(p.cost_cent, 0)))}
                          onChange={(e: any) =>
                            updPrize(i, { cost_cent: Math.max(0, Math.floor(num(e.target.value, 0))) })
                          }
                        />
                        <select
                          value={String(p.cost_currency || 'RUB')}
                          onChange={(e) => updPrize(i, { cost_currency: e.target.value })}
                          style={{ marginLeft: 8 }}
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {String(p.cost_currency || 'RUB') === 'OTHER' ? (
                        <div className="sg-editor__row">
                          <div className="sg-editor__label">Символ/код валюты</div>
                          <Input
                            value={String(p.cost_currency_custom || '')}
                            onChange={(e: any) => updPrize(i, { cost_currency_custom: e.target.value })}
                          />
                        </div>
                      ) : null}

                      <div className="sg-editor__hint">
                        Это для аналитики/прибыли. Пользователю не показываем.
                      </div>

                      <div className="sg-editor__row">
                        <div className="sg-editor__label">Учитывать остатки (резерв на issued)</div>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!p.track_qty}
                            onChange={(e) => updPrize(i, { track_qty: e.target.checked })}
                          />
                          {' '}Да
                        </label>
                      </div>

                      {p.track_qty ? (
                        <>
                          <div className="sg-editor__row">
                            <div className="sg-editor__label">Остаток (qty_left)</div>
                            <Input
                              type="number"
                              value={Math.max(0, Math.floor(num(p.qty_left, 0)))}
                              onChange={(e: any) =>
                                updPrize(i, { qty_left: Math.max(0, Math.floor(num(e.target.value, 0))) })
                              }
                            />
                          </div>

                          <div className="sg-editor__row">
                            <div className="sg-editor__label">Не участвует при 0</div>
                            <label>
                              <input
                                type="checkbox"
                                checked={p.stop_when_zero !== false}
                                onChange={(e) => updPrize(i, { stop_when_zero: e.target.checked })}
                              />
                              {' '}Да
                            </label>
                          </div>
                        </>
                      ) : (
                        <div className="sg-editor__hint">
                          Если остатки не учитываем — приз участвует только по весу.
                        </div>
                      )}
                    </>
                  )}

                  {/* Chance */}
                  <div className="sg-editor__row">
                    <div className="sg-editor__label">Шанс выигрыша (настройка, %)</div>
                    <Input
                      type="number"
                      value={cfgPct}
                      onChange={(e: any) => updPrize(i, { weight: pctToWeightConfigured(e.target.value) })}
                      disabled={p.active === false}
                    />
                    <div className="sg-editor__hint">
                      Реальный среди активных: <b>{real.toFixed(2)}%</b>
                      <br />
                      0% = weight 0 = никогда не выпадет. Храним как %×100 (basis points), чтобы работали 0.5%, 1%…
                    </div>
                  </div>

                  <div className="sg-editor__row">
                    {[0, 0.5, 1, 2, 5, 10, 25, 50, 75, 100].map((v) => (
                      <Button
                        key={v}
                        onClick={() => updPrize(i, { weight: pctToWeightConfigured(v) })}
                        disabled={p.active === false}
                        title={v === 0 ? 'Никогда не выпадет (weight=0)' : `Поставить ${v}%`}
                      >
                        {v}%
                      </Button>
                    ))}
                  </div>

                  {/* Image upload */}
                  <div className="sg-editor__row">
                    <div className="sg-editor__label">Картинка</div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e: any) => {
                        const f = e.currentTarget.files?.[0];
                        e.currentTarget.value = '';
                        if (!f) return;
                        try {
                          const dataUrl = await fileToDataUrl(f);
                          updPrize(i, { img: dataUrl });
                        } catch (err: any) {
                          alert('Не удалось загрузить картинку: ' + (err?.message || String(err)));
                        }
                      }}
                    />
                    <Button onClick={() => updPrize(i, { img: '' })} style={{ marginLeft: 8 }}>
                      Убрать
                    </Button>
                    <div className="sg-editor__hint">{imgLabel}</div>
                  </div>

                  {p.img ? (
                    <div className="sg-editor__row">
                      <img
                        src={p.img}
                        style={{ maxWidth: 220, borderRadius: 12, border: '1px solid rgba(15,23,42,.12)' }}
                      />
                    </div>
                  ) : (
                    <div className="sg-editor__hint">
                      Загрузи картинку — сохраним как dataURL в blueprint.
                    </div>
                  )}

                  {/* Code */}
                  <div className="sg-editor__row">
                    <div className="sg-editor__label">Код (служебный, readonly)</div>
                    <Input value={p.code} readOnly />
                    <div className="sg-editor__hint">
                      Код нужен серверу как <code>wheel_prizes.code</code>. Мы генерим автоматически и следим за уникальностью.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BonusWheelEditor;
