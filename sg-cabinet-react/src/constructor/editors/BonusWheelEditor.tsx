// sg-cabinet-react/src/constructor/editors/BonusWheelEditor.tsx
import React from 'react';
import { Button, Input } from '../../components/ui';

type Prize = {
  code: string;
  name: string;

  // coins prize
  coins: number;

  // physical prize fields
  cost?: number;                 // себестоимость
  currency?: string;             // 'RUB'|'EUR'|'USD'|...|'OTHER'
  currency_custom?: string;      // если OTHER
  stock_qty?: number;            // количество штук

  // IMPORTANT: stored as weight = percent * 100 (basis points)
  weight: number;

  img?: string;   // dataURL or URL
  active?: boolean;

  // UI + stored for convenience
  kind?: 'coins' | 'physical';
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
  const ws = prizes.map((p) =>
    p.active === false ? 0 : Math.max(0, Math.floor(num(p.weight, 0)))
  );
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
  s = s.slice(0, 32);
  return s;
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
  const c = String(p.currency || 'RUB');
  if (c === 'OTHER') {
    const s = String(p.currency_custom || '').trim();
    return s || '¤';
  }
  return CURRENCIES.find((x) => x.code === c)?.sym || c;
}

export function BonusWheelEditor({
  value,
  onChange,
}: {
  value: any;
  onChange: (next: any) => void;
}) {
  const props = value || {};
  const prizesRaw: Prize[] = Array.isArray(props.prizes) ? props.prizes : [];

  // normalize prizes (safe defaults)
  const prizes: Prize[] = React.useMemo(
    () =>
      prizesRaw.map((p) => {
        const coins = Math.max(0, Math.floor(num((p as any)?.coins, 0)));
        const kind: 'coins' | 'physical' =
          (p as any)?.kind === 'coins'
            ? 'coins'
            : (p as any)?.kind === 'physical'
            ? 'physical'
            : coins > 0
            ? 'coins'
            : 'physical';

        const currency = String((p as any)?.currency || 'RUB');
        const stock_qty = Math.max(0, Math.floor(num((p as any)?.stock_qty, 0)));

        return {
          code: String((p as any)?.code ?? ''),
          name: String((p as any)?.name ?? ''),
          coins,
          cost: Math.max(0, num((p as any)?.cost, 0)),
          currency,
          currency_custom: String((p as any)?.currency_custom ?? ''),
          stock_qty,
          weight: Math.max(0, Math.floor(num((p as any)?.weight, 0))),
          img: (p as any)?.img ? String((p as any)?.img) : '',
          active: (p as any)?.active === undefined ? true : !!(p as any)?.active,
          kind,
        };
      }),
    [prizesRaw]
  );

  const set = (patch: any) => onChange({ ...props, ...patch });

  const updPrize = (i: number, patch: Partial<Prize>) => {
    const next = prizes.map((p, idx) => (idx === i ? ({ ...p, ...patch } as Prize) : p));
    set({ prizes: next });
  };

  const addPrize = () => {
    const next: Prize = {
      code: 'prize',
      name: 'Приз',
      coins: 0,

      cost: 0,
      currency: 'RUB',
      currency_custom: '',
      stock_qty: 1,

      weight: pctToWeightConfigured(10),
      img: '',
      active: true,
      kind: 'physical',
    };
    set({ prizes: [...prizes, next] });
  };

  const delPrize = (i: number) => {
    const next = prizes.filter((_, idx) => idx !== i);
    set({ prizes: next });
  };

  const movePrize = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= prizes.length) return;
    const next = prizes.slice();
    const t = next[i];
    next[i] = next[j];
    next[j] = t;
    set({ prizes: next });
  };

  const toggleActivePrize = (i: number) => {
    const p = prizes[i];
    const nextActive = p.active === false; // if was inactive -> make active
    updPrize(i, { active: nextActive, weight: nextActive ? p.weight : 0 });
  };

  const realPerc = React.useMemo(() => calcRealPercentsFromWeights(prizes), [prizes]);

  // UI: accordion open map
  const [openMap, setOpenMap] = React.useState<Record<number, boolean>>({});
  React.useEffect(() => {
    setOpenMap((m) => {
      if (Object.keys(m).length) return m;
      return prizes.length ? { 0: true } : {};
    });
  }, [prizes.length]);

  const spinCost = Math.max(0, Math.floor(num(props.spin_cost, 10)));

  return (
    <div className="be">
      {/* ===== Header fields ===== */}
      <div className="beGrid">
        <div className="beField">
          <div className="beLab">Заголовок</div>
          <Input
            value={props.title ?? 'Колесо бонусов'}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>

        <div className="beField">
          <div className="beLab">Стоимость прокрутки (монеты)</div>
          <Input
            type="number"
            min={0}
            step={1}
            value={spinCost}
            onChange={(e) =>
              set({ spin_cost: Math.max(0, Math.floor(num(e.target.value, 10))) })
            }
          />
          <div className="beHint">
            Важно: стоимость используется воркером из <b>wheel.spin_cost</b>.
          </div>
        </div>
      </div>

      <div className="beSep" />

      {/* ===== Prizes header ===== */}
      <div className="beHdrRow">
        <div className="beHdr">Сектора / призы</div>
        <Button onClick={addPrize}>+ Добавить приз</Button>
      </div>

      {/* ===== Prizes list (accordion) ===== */}
      <div className="beAccList">
        {prizes.map((p, i) => {
          const isOpen = !!openMap[i];
          const cfgPct = weightToPctConfigured(p.weight);
          const real = realPerc[i] || 0;

          const imgLabel =
            p.img && p.img.startsWith('data:')
              ? 'Загружено'
              : p.img
              ? 'URL'
              : 'Нет';

          const currencySym = getCurrencySym(p);

          return (
            <div key={i} className={'beAcc' + (isOpen ? ' is-open' : '')}>
              <div
                className="beAcc__hdr"
                onClick={() => setOpenMap((m) => ({ ...m, [i]: !m[i] }))}
              >
                <div className="beAcc__left">
                  <div className="beAcc__title">
                    {p.name?.trim() ? p.name : `Приз #${i + 1}`}
                  </div>
                  <div className="beAcc__sub">
                    <span className="beTag">
                      {p.kind === 'coins' ? 'Монеты' : 'Физический'}
                    </span>

                    {p.kind === 'physical' ? (
                      <>
                        <span className="beDot" />
                        <span className="beMut">
                          остаток: <b>{Math.max(0, Math.floor(num(p.stock_qty, 0)))}</b>
                        </span>
                        <span className="beDot" />
                        <span className="beMut">
                          себестоимость: <b>{Math.max(0, Math.floor(num(p.cost, 0)))} {currencySym}</b>
                        </span>
                      </>
                    ) : null}

                    <span className="beDot" />
                    <span className="beMut">
                      Настройка: <b>{cfgPct.toFixed(1)}%</b>
                    </span>
                    <span className="beDot" />
                    <span className="beMut">
                      Реально: <b>{real.toFixed(2)}%</b>
                    </span>
                    {p.active === false ? (
                      <>
                        <span className="beDot" />
                        <span className="beMut" style={{ opacity: 0.9 }}>
                          неактивен
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="beAcc__right" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="beMini"
                    title="Вверх"
                    disabled={i === 0}
                    onClick={() => movePrize(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="beMini"
                    title="Вниз"
                    disabled={i === prizes.length - 1}
                    onClick={() => movePrize(i, 1)}
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    className="beMini"
                    title={p.active === false ? 'Сделать активным' : 'Выключить приз'}
                    onClick={() => toggleActivePrize(i)}
                  >
                    {p.active === false ? '🙈' : '👁'}
                  </button>

                  <button
                    type="button"
                    className="beDanger"
                    onClick={() => {
                      if (confirm('Удалить приз?')) delPrize(i);
                    }}
                  >
                    Удалить
                  </button>

                  <button
                    type="button"
                    className="beChevron"
                    onClick={() => setOpenMap((m) => ({ ...m, [i]: !m[i] }))}
                    title={isOpen ? 'Свернуть' : 'Развернуть'}
                  >
                    {isOpen ? '▴' : '▾'}
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="beAcc__body">
                  <div className="beGrid2">
                    {/* Name */}
                    <div className="beField">
                      <div className="beLab">Название</div>
                      <Input
                        value={p.name ?? ''}
                        onChange={(e) => {
                          const name = e.target.value;
                          const nextCode =
                            !p.code || p.code === slugifyCode(p.name || '')
                              ? slugifyCode(name)
                              : p.code;
                          updPrize(i, { name, code: nextCode });
                        }}
                      />
                      <div className="beHint">Код генерируем автоматически из названия.</div>
                    </div>

                    {/* Type */}
                    <div className="beField">
                      <div className="beLab">Тип приза</div>
                      <div className="beRow">
                        <label className="beChk">
                          <input
                            type="radio"
                            name={`kind_${i}`}
                            checked={p.kind === 'coins'}
                            onChange={() => {
                              const nextCoins = Math.max(1, Math.floor(num(p.coins, 0))) || 1;
                              updPrize(i, { kind: 'coins', coins: nextCoins });
                            }}
                          />
                          <span>Монеты</span>
                        </label>
                        <label className="beChk">
                          <input
                            type="radio"
                            name={`kind_${i}`}
                            checked={p.kind !== 'coins'}
                            onChange={() => updPrize(i, { kind: 'physical', coins: 0 })}
                          />
                          <span>Физический</span>
                        </label>
                      </div>
                    </div>

                    {/* ✅ Coins OR Physical fields */}
                    {p.kind === 'coins' ? (
                      <div className="beField">
                        <div className="beLab">Сколько монет начислять</div>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={Math.max(1, Math.floor(num(p.coins, 1)))}
                          onChange={(e) =>
                            updPrize(i, { coins: Math.max(1, Math.floor(num(e.target.value, 1))) })
                          }
                        />
                      </div>
                    ) : (
                      <>
                        <div className="beField">
                          <div className="beLab">Себестоимость</div>
                          <div className="beRow">
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={Math.max(0, Math.floor(num(p.cost, 0)))}
                              onChange={(e) =>
                                updPrize(i, { cost: Math.max(0, Math.floor(num(e.target.value, 0))) })
                              }
                            />
                            <select
                              className="beSelect"
                              value={String(p.currency || 'RUB')}
                              onChange={(e) => updPrize(i, { currency: e.target.value })}
                            >
                              {CURRENCIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {String(p.currency || 'RUB') === 'OTHER' ? (
                            <div className="beRow" style={{ marginTop: 8 }}>
                              <Input
                                placeholder="например: ₾ или GEL или руб."
                                value={String(p.currency_custom || '')}
                                onChange={(e) => updPrize(i, { currency_custom: e.target.value })}
                              />
                            </div>
                          ) : null}

                          <div className="beHint">
                            Это для аналитики/прибыли. Пользователю не показываем.
                          </div>
                        </div>

                        <div className="beField">
                          <div className="beLab">Количество (штук)</div>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={Math.max(0, Math.floor(num(p.stock_qty, 0)))}
                            onChange={(e) =>
                              updPrize(i, { stock_qty: Math.max(0, Math.floor(num(e.target.value, 0))) })
                            }
                          />
                          <div className="beHint">
                            Если 0 — можно оставить приз активным, но лучше выключить 👁 (или поставить шанс 0%).
                          </div>
                        </div>
                      </>
                    )}

                    {/* Chance (%) */}
                    <div className="beField">
                      <div className="beLab">Шанс выигрыша (настройка, %)</div>

                      <div className="beRow beRow--tight">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={cfgPct.toFixed(1)}
                          onChange={(e) =>
                            updPrize(i, { weight: pctToWeightConfigured(e.target.value) })
                          }
                          disabled={p.active === false}
                        />
                        <div className="beHint" style={{ margin: 0 }}>
                          Реальный среди активных: <b>{real.toFixed(2)}%</b>
                        </div>
                      </div>

                      <input
                        className="beSlider"
                        type="range"
                        min={0}
                        max={100}
                        step={0.1}
                        value={cfgPct}
                        onChange={(e) =>
                          updPrize(i, { weight: pctToWeightConfigured(e.target.value) })
                        }
                        disabled={p.active === false}
                      />

                      <div className="bePctPresets">
                        {[0, 0.5, 1, 2, 5, 10, 25, 50, 75, 100].map((v) => (
                          <button
                            key={String(v)}
                            type="button"
                            className="beMiniBtn"
                            onClick={() => updPrize(i, { weight: pctToWeightConfigured(v) })}
                            disabled={p.active === false}
                            title={v === 0 ? 'Никогда не выпадет (weight=0)' : `Поставить ${v}%`}
                          >
                            {v}%
                          </button>
                        ))}
                      </div>

                      <div className="beHint">
                        0% = <b>weight 0</b> = приз никогда не выпадет. Храним вес как <b>% × 100</b>,
                        чтобы работали маленькие значения (0.5%, 1%…).
                      </div>
                    </div>

                    {/* Image upload */}
                    <div className="beField beSpan2">
                      <div className="beLab">Картинка</div>
                      <div className="beRow">
                        <label className="beUploadBtn">
                          Загрузить
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const f = e.currentTarget.files?.[0];
                              e.currentTarget.value = '';
                              if (!f) return;
                              try {
                                const dataUrl = await fileToDataUrl(f);
                                updPrize(i, { img: dataUrl });
                              } catch (err: any) {
                                alert(
                                  'Не удалось загрузить картинку: ' +
                                    (err?.message || String(err))
                                );
                              }
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          className="beMiniBtn"
                          disabled={!p.img}
                          onClick={() => updPrize(i, { img: '' })}
                        >
                          Убрать
                        </button>

                        <div className="beMut" style={{ flex: 1, textAlign: 'right' }}>
                          {imgLabel}
                        </div>
                      </div>

                      {p.img ? (
                        <div className="beImgRow">
                          <img className="beImg" src={p.img} alt="" />
                        </div>
                      ) : (
                        <div className="beHint">Загрузи картинку — сохраним её как dataURL в blueprint.</div>
                      )}
                    </div>

                    {/* ✅ Code (readOnly) */}
                    <div className="beField beSpan2">
                      <div className="beLab">Код (служебный, readonly)</div>
                      <Input value={p.code ?? ''} readOnly />
                      <div className="beHint">
                        Код нужен серверу как <b>wheel_prizes.code</b>. Мы генерим автоматически из названия.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* styles */}
      <style>{`
        .be{ display:grid; gap:14px; }
        .beGrid{ display:grid; gap:12px; grid-template-columns: 1fr 1fr; }
        .beGrid2{ display:grid; gap:12px; grid-template-columns: 1fr 1fr; }
        .beSpan2{ grid-column: 1 / -1; }
        .beField{ display:grid; gap:6px; }
        .beLab{ font-weight: 700; }
        .beHint{ font-size: 12px; opacity: .75; line-height: 1.35; }
        .beSep{ height:1px; opacity:.12; background: currentColor; }
        .beHdrRow{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .beHdr{ font-weight: 800; font-size: 14px; }
        .beAccList{ display:grid; gap:10px; }
        .beAcc{ border-radius: 16px; border: 1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.6); overflow:hidden; }
        .beAcc__hdr{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; cursor:pointer; }
        .beAcc__left{ min-width:0; }
        .beAcc__title{ font-weight: 800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .beAcc__sub{ display:flex; align-items:center; gap:8px; margin-top:2px; flex-wrap:wrap; }
        .beAcc__right{ display:flex; align-items:center; gap:8px; }
        .beDot{ width:4px; height:4px; border-radius:999px; background: rgba(15,23,42,.35); }
        .beTag{ font-size:12px; padding:2px 8px; border-radius:999px; background: rgba(34,211,238,.14); }
        .beMut{ font-size:12px; opacity:.75; }
        .beAcc__body{ padding:12px; border-top:1px solid rgba(15,23,42,.10); background: rgba(255,255,255,.55); }
        .beMini{ border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); border-radius:10px; padding:6px 10px; cursor:pointer; }
        .beMini:disabled{ opacity:.5; cursor:not-allowed; }
        .beMiniBtn{ border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); border-radius:999px; padding:6px 10px; cursor:pointer; }
        .beMiniBtn:disabled{ opacity:.5; cursor:not-allowed; }
        .beDanger{ border:1px solid rgba(239,68,68,.35); background: rgba(239,68,68,.10); border-radius:10px; padding:6px 10px; cursor:pointer; }
        .beChevron{ border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); border-radius:10px; padding:6px 10px; cursor:pointer; }
        .beRow{ display:flex; align-items:center; gap:10px; }
        .beRow--tight{ gap:8px; }
        .beChk{ display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:12px; border:1px solid rgba(15,23,42,.10); background: rgba(255,255,255,.6); }
        .beSlider{ width:100%; }
        .bePctPresets{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
        .beUploadBtn{ display:inline-flex; align-items:center; justify-content:center; gap:8px;
          border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65);
          border-radius:999px; padding:6px 12px; cursor:pointer; }
        .beImgRow{ margin-top:10px; display:flex; justify-content:flex-start; }
        .beImg{ width:120px; height:120px; object-fit:cover; border-radius:14px; border:1px solid rgba(15,23,42,.10); }
        .beSelect{ height: 40px; border-radius: 12px; padding: 0 10px; border: 1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); }
        @media (max-width: 900px){
          .beGrid{ grid-template-columns: 1fr; }
          .beGrid2{ grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

export default BonusWheelEditor;
