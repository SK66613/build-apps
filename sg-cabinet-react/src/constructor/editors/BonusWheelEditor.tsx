// sg-cabinet-react/src/constructor/editors/BonusWheelEditor.tsx
import React from 'react';
import { Button, Input } from '../../components/ui';

type PrizeKind = 'coins' | 'item';

type Prize = {
  code: string;
  title: string;

  // visual
  img?: string;

  // kind
  kind: PrizeKind;

  // coins (if kind='coins')
  coins?: number;
};

function num(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
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

function normalizePrize(p: any): Prize {
  const title = String(p?.title ?? p?.name ?? '');
  const baseKind: PrizeKind =
    p?.kind === 'coins' ? 'coins' :
    p?.kind === 'item' ? 'item' :
    p?.kind === 'physical' ? 'item' :
    (Math.max(0, Math.floor(num(p?.coins, 0))) > 0 ? 'coins' : 'item');

  return {
    code: String(p?.code ?? ''),
    title,
    img: p?.img ? String(p.img) : '',
    kind: baseKind,
    coins: baseKind === 'coins' ? Math.max(1, Math.floor(num(p?.coins, 1))) : 0,
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
      code: '',
      title: 'Приз',
      kind: 'item',
      coins: 0,
      img: '',
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
            Тонкие настройки (вес/себестоимость/остатки/активность) — в аналитике/тюнинге (D1 live).
            Publish их не перетирает (вариант A).
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
          const imgLabel =
            p.img && p.img.startsWith('data:') ? 'Загружено' : p.img ? 'URL' : 'Нет';

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
                    {p.kind === 'coins' ? <span>· {Math.max(1, Math.floor(num(p.coins, 1)))} монет</span> : null}
                    {p.img ? <span>· img: {imgLabel}</span> : null}
                  </div>
                </div>

                <div className="sg-acc__headBtns" onClick={(e) => e.stopPropagation()}>
                  <Button onClick={() => movePrize(i, -1)}>↑</Button>
                  <Button onClick={() => movePrize(i, 1)}>↓</Button>
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
                        onChange={() =>
                          updPrize(i, { kind: 'coins', coins: Math.max(1, Math.floor(num(p.coins, 1))) })
                        }
                      />
                      {' '}Монеты
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={p.kind === 'item'}
                        onChange={() => updPrize(i, { kind: 'item', coins: 0 })}
                      />
                      {' '}Физический
                    </label>
                  </div>

                  {/* coins */}
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
                    <div className="sg-editor__hint">
                      Себестоимость/остатки/активность/вес — настраиваются в аналитике (D1 live).
                    </div>
                  )}

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
