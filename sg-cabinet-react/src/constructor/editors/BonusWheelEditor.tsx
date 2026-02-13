// sg-cabinet-react/src/constructor/editors/BonusWheelEditor.tsx
import React from 'react';
import { Button, Input } from '../../components/ui';

type Prize = {
  code: string;
  name: string;
  coins: number;
  weight: number; // IMPORTANT: we store "configured chance" as weight = percent * 100 (basis points)
  img?: string;   // dataURL or URL
  active?: boolean;
  kind?: 'coins' | 'physical'; // UI-only (still stored in props for convenience)
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
  // простая генерация code из названия
  let s = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'e')
    .replace(/й/g, 'i')
    .replace(/[^a-z0-9а-я_-]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!s) s = 'prize';
  // русские буквы тоже ок, но лучше латиница: подрежем до разумного
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
      prizesRaw.map((p) => ({
        code: String(p?.code ?? ''),
        name: String(p?.name ?? ''),
        coins: Math.max(0, Math.floor(num((p as any)?.coins, 0))),
        weight: Math.max(0, Math.floor(num((p as any)?.weight, 0))),
        img: (p as any)?.img ? String((p as any)?.img) : '',
        active: (p as any)?.active === undefined ? true : !!(p as any)?.active,
        kind:
          (p as any)?.kind === 'physical'
            ? 'physical'
            : (p as any)?.kind === 'coins'
            ? 'coins'
            : // auto: if coins > 0 => coins prize, else physical by default
              (Math.max(0, Math.floor(num((p as any)?.coins, 0))) > 0 ? 'coins' : 'physical'),
      })),
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
      // default configured chance = 10%
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

  const realPerc = React.useMemo(() => calcRealPercentsFromWeights(prizes), [prizes]);

  // UI: accordion open map
  const [openMap, setOpenMap] = React.useState<Record<number, boolean>>({});
  React.useEffect(() => {
    // if nothing opened, open first
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
            Важно: стоимость используется воркером из <b>wheel.spin_cost</b> (KV/D1 sync).
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

          // show file name if dataURL (we can’t know original file name after convert)
          const imgLabel =
            p.img && p.img.startsWith('data:')
              ? 'Загружено (dataURL)'
              : p.img
              ? 'URL'
              : 'Нет';

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
                    title={p.active === false ? 'Сделать активным' : 'Выключить'}
                    onClick={() => updPrize(i, { active: !(p.active === false) })}
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
                          // автокод: если code пустой или был автосгенерён из старого имени — перегенерим
                          const nextCode =
                            !p.code || p.code === slugifyCode(p.name || '')
                              ? slugifyCode(name)
                              : p.code;
                          updPrize(i, { name, code: nextCode });
                        }}
                      />
                      <div className="beHint">
                        Код генерируем автоматически из названия (можно оставить как есть).
                      </div>
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
                              // если переключили на coins — пусть coins не будет 0
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
                      <div className="beHint">
                        Если <b>Физический</b> — поле “монеты” скрываем. Если <b>Монеты</b> — показываем.
                      </div>
                    </div>

                    {/* Coins (only for coins kind) */}
                    {p.kind === 'coins' ? (
                      <div className="beField">
                        <div className="beLab">Сколько монет начислять</div>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={Math.max(1, Math.floor(num(p.coins, 1)))}
                          onChange={(e) =>
                            updPrize(i, {
                              coins: Math.max(1, Math.floor(num(e.target.value, 1))),
                            })
                          }
                        />
                      </div>
                    ) : (
                      <div className="beField">
                        <div className="beLab">Монеты</div>
                        <div className="beHint">Физический приз — монеты не применяются.</div>
                      </div>
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
                          onChange={(e) => updPrize(i, { weight: pctToWeightConfigured(e.target.value) })}
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
                      />

                      <div className="bePctPresets">
                        {[0, 1, 5, 10, 25, 50, 75, 100].map((v) => (
                          <button
                            key={v}
                            type="button"
                            className="beMiniBtn"
                            onClick={() => updPrize(i, { weight: pctToWeightConfigured(v) })}
                            title={v === 0 ? 'Никогда не выпадет (weight=0)' : `Поставить ${v}%`}
                          >
                            {v}%
                          </button>
                        ))}
                      </div>

                      <div className="beHint">
                        0% = <b>weight 0</b> = приз никогда не выпадет. Мы храним вес как <b>% × 100</b>,
                        чтобы работали маленькие значения (0.1%, 0.5% и т.д.).
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
                                alert('Не удалось загрузить картинку: ' + (err?.message || String(err)));
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
                        <div className="beHint">Загрузи картинку — мы сохраним её как dataURL в blueprint.</div>
                      )}
                    </div>

                    {/* Code (hidden-ish, but editable if needed) */}
                    <div className="beField beSpan2">
                      <div className="beLab">Код (служебный)</div>
                      <Input
                        value={p.code ?? ''}
                        onChange={(e) => updPrize(i, { code: e.target.value })}
                        placeholder="auto"
                      />
                      <div className="beHint">
                        Обычно трогать не нужно: код будет совпадать с <b>wheel_prizes.code</b> на сервере.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
