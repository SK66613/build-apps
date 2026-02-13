// sg-cabinet-react/src/constructor/editors/BonusWheelEditor.tsx
import React from 'react';
import { Button, Input } from '../../components/ui';

type PrizeType = 'coins' | 'physical';

type Prize = {
  code: string;        // авто от name (slug)
  name: string;
  type?: PrizeType;    // 🆕
  coins: number;       // показываем только если type==='coins'
  weight: number;      // внутренний вес (но UI будет %)
  img?: string;        // dataURL или URL
  img_name?: string;   // 🆕 имя файла для UI
};

function num(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function slugifyCode(name: string) {
  const s = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'e')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return s || 'prize';
}
function toDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onload = () => res(String(rd.result || ''));
    rd.onerror = () => rej(new Error('file read error'));
    rd.readAsDataURL(file);
  });
}

/** percent helpers:
 * weight = 1..N
 * percent shown = weight / sum(weights) * 100
 */
function weightsToPercents(prizes: Prize[]) {
  const ws = prizes.map(p => Math.max(0, num(p.weight, 1)));
  const sum = ws.reduce((a, b) => a + b, 0) || 1;
  return ws.map(w => (w / sum) * 100);
}

/**
 * change desired percent of prize i:
 * keep other weights unchanged, recompute weight_i so that percent matches
 */
function setPercent(prizes: Prize[], i: number, desiredPct: number) {
  const next = prizes.map(p => ({ ...p }));
  const desired = clamp(num(desiredPct, 0), 0, 100);

  const ws = next.map(p => Math.max(0, num(p.weight, 1)));
  const otherSum = ws.reduce((acc, w, idx) => (idx === i ? acc : acc + w), 0);

  // if others are zero -> make a simple scale
  // pct = w_i / (w_i + otherSum)
  // => w_i = pct/(1-pct) * otherSum
  if (desired >= 100) {
    // make it dominant
    next[i].weight = Math.max(1, otherSum * 100 + 1);
    return next;
  }
  if (desired <= 0) {
    next[i].weight = 0;
    return next;
  }

  const pct = desired / 100;
  const w = (pct / (1 - pct)) * otherSum;

  // keep reasonable integer weights
  next[i].weight = Math.max(0, Math.round(w));
  // if rounding killed it, bump to 1
  if (desired > 0 && next[i].weight === 0) next[i].weight = 1;

  return next;
}

function MoveBtns({ onUp, onDown, disabledUp, disabledDown }: any) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button className="beMiniBtn" type="button" disabled={disabledUp} onClick={onUp} title="Вверх">↑</button>
      <button className="beMiniBtn" type="button" disabled={disabledDown} onClick={onDown} title="Вниз">↓</button>
    </div>
  );
}

export function BonusWheelEditor({
  value,
  onChange,
}:{
  value: any;
  onChange: (next:any)=>void;
}) {
  const props = value || {};
  const prizes: Prize[] = Array.isArray(props.prizes) ? props.prizes : [];

  const set = (patch: any) => onChange({ ...props, ...patch });

  // normalize prizes on read
  const normPrizes = React.useMemo(() => {
    return prizes.map((p, idx) => {
      const name = String(p?.name ?? `Приз ${idx + 1}`);
      const code = String(p?.code || '') || slugifyCode(name);
      const type: PrizeType = (p?.type === 'physical') ? 'physical' : 'coins';
      const coins = Math.max(0, Math.floor(num(p?.coins, 0)));
      const weight = Math.max(0, Math.floor(num(p?.weight, 1)));
      const img = p?.img ? String(p.img) : '';
      const img_name = p?.img_name ? String(p.img_name) : '';
      return { ...p, name, code, type, coins, weight, img, img_name } as Prize;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(prizes)]);

  React.useEffect(() => {
    // keep props.prizes normalized (auto-code)
    if (JSON.stringify(normPrizes) !== JSON.stringify(prizes)) {
      set({ prizes: normPrizes });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updPrize = (i: number, patch: Partial<Prize>) => {
    const next = normPrizes.map((p, idx) => (idx === i ? ({ ...p, ...patch }) : p));
    set({ prizes: next });
  };

  const addPrize = () => {
    const name = 'Новый приз';
    const next: Prize = {
      name,
      code: slugifyCode(name),
      type: 'coins',
      coins: 0,
      weight: 1,
      img: '',
      img_name: '',
    };
    set({ prizes: [...normPrizes, next] });
  };

  const delPrize = (i: number) => {
    const next = normPrizes.filter((_, idx) => idx !== i);
    set({ prizes: next });
  };

  const movePrize = (i: number, dir: -1 | 1) => {
    const next = normPrizes.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    const t = next[i];
    next[i] = next[j];
    next[j] = t;
    set({ prizes: next });
  };

  const percents = React.useMemo(() => weightsToPercents(normPrizes), [normPrizes]);

  return (
    <div className="be">
      <div className="beGrid">
        <div className="beField">
          <div className="beLab">Заголовок</div>
          <Input value={props.title ?? 'Колесо бонусов'} onChange={e=>set({ title: e.target.value })} />
        </div>

        <div className="beField">
          <div className="beLab">Стоимость прокрутки (монеты)</div>
          <Input
            type="number"
            min={0}
            step={1}
            value={Math.max(0, Math.floor(num(props.spin_cost, 10)))}
            onChange={e=>set({ spin_cost: Math.max(0, Math.floor(num(e.target.value, 10))) })}
          />
          <div className="beHint">
            Важно: стоимость используется воркером из <b>app_config.wheel.spin_cost</b>.
          </div>
        </div>
      </div>

      <div className="beSep" />

      <div className="beHdrRow">
        <div className="beHdr">Сектора / призы</div>
        <Button onClick={addPrize}>+ Добавить приз</Button>
      </div>

      {/* 🧠 подсказка про проценты */}
      <div className="beHint" style={{ marginTop: 6 }}>
        “Шанс выигрыша (%)” считается автоматически из весов. Меняешь проценты — мы пересчитываем вес.
      </div>

      <div className="beList">
        {normPrizes.map((p, i)=>(
          <details key={i} className="beAcc" open={i === 0}>
            <summary className="beAccSum">
              <div className="beAccLeft">
                <div className="beAccTitle">
                  {p.name || `Приз #${i+1}`}
                </div>
                <div className="beAccSub">
                  код: <b>{p.code}</b> • шанс: <b>{percents[i].toFixed(1)}%</b> • тип: <b>{p.type === 'coins' ? 'монеты' : 'физический'}</b>
                </div>
              </div>

              <div className="beAccRight" onClick={(e)=>e.stopPropagation()}>
                <MoveBtns
                  disabledUp={i===0}
                  disabledDown={i===normPrizes.length-1}
                  onUp={()=>movePrize(i,-1)}
                  onDown={()=>movePrize(i,1)}
                />
                <button className="beDanger" type="button" onClick={()=>delPrize(i)}>Удалить</button>
              </div>
            </summary>

            <div className="beCard">
              <div className="beGrid2">
                <div className="beField">
                  <div className="beLab">Название</div>
                  <Input
                    value={p.name ?? ''}
                    onChange={e=>{
                      const name = e.target.value;
                      // авто-код от названия
                      updPrize(i, { name, code: slugifyCode(name) });
                    }}
                  />
                  <div className="beHint">
                    Код создаётся автоматически из названия.
                  </div>
                </div>

                <div className="beField">
                  <div className="beLab">Тип приза</div>
                  <label className="beChk">
                    <input
                      type="checkbox"
                      checked={p.type === 'coins'}
                      onChange={(e)=>{
                        const isCoins = !!e.target.checked;
                        updPrize(i, {
                          type: isCoins ? 'coins' : 'physical',
                          coins: isCoins ? Math.max(1, p.coins || 0) : 0,
                        });
                      }}
                    />
                    <span>Монеты (иначе — физический)</span>
                  </label>
                  <div className="beHint">
                    Если выключено — считаем приз физическим, поле “Монеты” скрывается.
                  </div>
                </div>

                {/* coins only */}
                {p.type === 'coins' ? (
                  <div className="beField">
                    <div className="beLab">Монеты</div>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={Math.max(1, Math.floor(num(p.coins, 1)))}
                      onChange={e=>updPrize(i,{ coins: Math.max(1, Math.floor(num(e.target.value, 1))) })}
                    />
                  </div>
                ) : (
                  <div className="beField">
                    <div className="beLab">Монеты</div>
                    <div className="beHint">Физический приз — монеты не используются.</div>
                  </div>
                )}

                <div className="beField">
                  <div className="beLab">Шанс выигрыша (%)</div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={Number.isFinite(percents[i]) ? percents[i].toFixed(1) : '0.0'}
                    onChange={e=>{
                      const desired = num(e.target.value, percents[i] || 0);
                      const next = setPercent(normPrizes, i, desired);
                      set({ prizes: next });
                    }}
                  />
                  <div className="beHint">
                    Мы храним вес (weight) внутри, но показываем проценты.
                  </div>
                </div>

                {/* Image upload */}
                <div className="beField beSpan2">
                  <div className="beLab">Картинка</div>

                  <div className="beImgRow">
                    <div className="beFileName">
                      {p.img_name
                        ? p.img_name
                        : (p.img ? 'Загружено' : 'Нет файла')}
                    </div>

                    <label className="beUploadBtn">
                      Загрузить
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display:'none' }}
                        onChange={async (e)=>{
                          const f = e.target.files?.[0];
                          e.currentTarget.value = '';
                          if (!f) return;
                          const dataUrl = await toDataUrl(f);
                          updPrize(i, { img: dataUrl, img_name: f.name });
                        }}
                      />
                    </label>

                    {p.img ? (
                      <button
                        className="beMiniBtn"
                        type="button"
                        onClick={()=>updPrize(i,{ img:'', img_name:'' })}
                      >
                        Удалить
                      </button>
                    ) : null}
                  </div>

                  {p.img ? (
                    <div className="beImgPreview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.img} alt="" />
                    </div>
                  ) : null}

                  <div className="beHint">
                    Ссылку не показываем. Храним как dataURL (как у остальных блоков).
                  </div>
                </div>

                {/* hidden field: code (read-only) */}
                <div className="beField beSpan2">
                  <div className="beLab">Код (авто)</div>
                  <Input value={p.code ?? ''} readOnly />
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>

      {/* styles for editor (scoped) */}
      <style>{`
        .beAcc{
          border:1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.75);
          border-radius: 14px;
          overflow: hidden;
        }
        .beAcc + .beAcc{ margin-top: 10px; }

        .beAccSum{
          list-style:none;
          cursor:pointer;
          user-select:none;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding: 12px 12px;
          background: rgba(255,255,255,.85);
          border-bottom:1px solid rgba(15,23,42,.08);
        }
        .beAccSum::-webkit-details-marker{ display:none; }

        .beAccLeft{ min-width: 0; }
        .beAccTitle{ font-weight: 800; line-height: 1.1; }
        .beAccSub{ margin-top: 4px; font-size: 12px; opacity: .75; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 520px; }

        .beAccRight{ display:flex; align-items:center; gap:10px; }

        .beMiniBtn{
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.9);
          border-radius: 10px;
          padding: 6px 10px;
          cursor:pointer;
        }
        .beMiniBtn:disabled{ opacity:.4; cursor:not-allowed; }

        .beChk{
          display:flex;
          gap:10px;
          align-items:center;
          padding: 10px 12px;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.9);
          border-radius: 12px;
        }

        .beImgRow{
          display:flex;
          gap:10px;
          align-items:center;
          flex-wrap: wrap;
        }
        .beFileName{
          flex: 1;
          min-width: 180px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.9);
          font-size: 13px;
          opacity: .85;
        }
        .beUploadBtn{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.9);
          cursor:pointer;
          font-weight: 700;
        }

        .beImgPreview{
          margin-top: 10px;
          border-radius: 14px;
          overflow:hidden;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.9);
        }
        .beImgPreview img{
          display:block;
          width: 100%;
          max-height: 220px;
          object-fit: cover;
        }
      `}</style>
    </div>
  );
}

export default BonusWheelEditor;
