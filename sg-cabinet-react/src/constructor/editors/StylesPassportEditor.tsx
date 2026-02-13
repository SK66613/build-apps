// sg-cabinet-react/src/constructor/editors/StylesPassportEditor.tsx
import React from 'react';
import { Button, Input } from '../../components/ui';

type Props = {
  value: any;
  onChange: (next: any) => void;
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

function ensureDefaults(src: any) {
  const p = { ...(src || {}) };

  // arrays
  if (!Array.isArray(p.styles)) p.styles = [];

  // layout + pin
  if (p.grid_cols === undefined) p.grid_cols = 3;
  if (p.require_pin === undefined) p.require_pin = true;

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
  if (p.reward_text === undefined) p.reward_text = 'Приз будет отправлен вам в бот после завершения паспорта.';
  if (p.reward_code_prefix === undefined) p.reward_code_prefix = 'PASS-'; // legacy
  if (p.reward_prize_code === undefined) p.reward_prize_code = '';

  // normalize stamps
  p.styles = p.styles.map((st: any) => ({
    code: toStr(st?.code),
    name: toStr(st?.name),
    desc: toStr(st?.desc),
    image: toStr(st?.image),
  }));

  return p;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result || ''));
    rd.onerror = () => reject(new Error('file read error'));
    rd.readAsDataURL(file);
  });
}

function Field({
  label,
  hint,
  children,
}:{
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}){
  return (
    <div className="ctorField">
      <div className="ctorLabel">{label}</div>
      <div>{children}</div>
      {hint ? <div className="ctorHelp">{hint}</div> : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}:{
  checked: boolean;
  onChange: (v: boolean)=>void;
  label: React.ReactNode;
  hint?: React.ReactNode;
}){
  return (
    <div className="ctorField">
      <label style={{ display:'flex', alignItems:'center', gap: 10, cursor:'pointer' }}>
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e)=>onChange(!!e.target.checked)}
        />
        <div style={{ display:'flex', flexDirection:'column', gap: 3 }}>
          <div className="ctorLabel" style={{ margin: 0 }}>{label}</div>
          {hint ? <div className="ctorHelp" style={{ margin: 0 }}>{hint}</div> : null}
        </div>
      </label>
    </div>
  );
}

function StampCard({
  idx,
  st,
  onPatch,
  onDelete,
  onMove,
  onUpload,
  canUp,
  canDown,
}:{
  idx: number;
  st: any;
  onPatch: (patch: any)=>void;
  onDelete: ()=>void;
  onMove: (dir: -1|1)=>void;
  onUpload: (file: File)=>void;
  canUp: boolean;
  canDown: boolean;
}){
  return (
    <div className="ctorCardMini" style={{ padding: 12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Карточка #{idx + 1}</div>
        <div style={{ display:'flex', gap: 8 }}>
          <button className="ctorIconBtn" type="button" title="Вверх" disabled={!canUp} onClick={()=>onMove(-1)}>↑</button>
          <button className="ctorIconBtn" type="button" title="Вниз" disabled={!canDown} onClick={()=>onMove(1)}>↓</button>
          <button className="ctorIconBtn" type="button" title="Удалить" onClick={onDelete}>🗑</button>
        </div>
      </div>

      <div className="ctorGrid2" style={{ marginTop: 10 }}>
        <Field label="code">
          <Input value={toStr(st?.code)} onChange={(e)=>onPatch({ code: e.target.value })} placeholder="day1" />
        </Field>
        <Field label="name">
          <Input value={toStr(st?.name)} onChange={(e)=>onPatch({ name: e.target.value })} placeholder="День 1" />
        </Field>
      </div>

      <Field label="desc">
        <Input value={toStr(st?.desc)} onChange={(e)=>onPatch({ desc: e.target.value })} placeholder="Сделайте покупку" />
      </Field>

      <Field
        label="image"
        hint="Можно вставить ссылку или загрузить файлом (конвертируется в dataURL)."
      >
        <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
          <Input
            value={toStr(st?.image)}
            onChange={(e)=>onPatch({ image: e.target.value })}
            placeholder="https://..."
            style={{ flex: 1 }}
          />
          <label className="ctorPillBtn" style={{ cursor:'pointer' }}>
            Upload
            <input
              type="file"
              accept="image/*"
              style={{ display:'none' }}
              onChange={(e)=>{
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </Field>

      {st?.image ? (
        <div style={{ marginTop: 8 }}>
          <img
            src={String(st.image)}
            alt=""
            style={{
              width: '100%',
              maxHeight: 140,
              objectFit: 'cover',
              borderRadius: 12,
              border: '1px solid rgba(15,23,42,.10)',
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function StylesPassportEditor({ value, onChange }: Props) {
  const v = React.useMemo(() => ensureDefaults(value), [value]);

  const setP = (patch: any) => {
    const next = ensureDefaults({ ...clone(v), ...(patch || {}) });
    onChange(next);
  };

  const setStamp = (idx: number, patch: any) => {
    const next = clone(v);
    next.styles[idx] = { ...(next.styles[idx] || {}), ...(patch || {}) };
    onChange(ensureDefaults(next));
  };

  const addStamp = () => {
    const next = clone(v);
    next.styles.push({ code:'', name:'', desc:'', image:'' });
    onChange(ensureDefaults(next));
  };

  const deleteStamp = (idx: number) => {
    const next = clone(v);
    next.styles.splice(idx, 1);
    onChange(ensureDefaults(next));
  };

  const moveStamp = (idx: number, dir: -1|1) => {
    const next = clone(v);
    const j = idx + dir;
    if (j < 0 || j >= next.styles.length) return;
    const tmp = next.styles[idx];
    next.styles[idx] = next.styles[j];
    next.styles[j] = tmp;
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

  const rewardWarn = !!v.reward_enabled && !String(v.reward_prize_code || '').trim();

  return (
    <div className="ctorEditor">
      {/* ===== Header texts ===== */}
      <Field label="Заголовок">
        <Input value={toStr(v.title)} onChange={(e)=>setP({ title: e.target.value })} />
      </Field>

      <Field label="Подзаголовок">
        <Input value={toStr(v.subtitle)} onChange={(e)=>setP({ subtitle: e.target.value })} />
      </Field>

      {/* ===== Cover ===== */}
      <Field
        label="Картинка (обложка)"
        hint="Можно вставить ссылку или загрузить файлом (конвертируется в dataURL)."
      >
        <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
          <Input
            value={toStr(v.cover_url)}
            onChange={(e)=>setP({ cover_url: e.target.value })}
            placeholder="https://..."
            style={{ flex: 1 }}
          />
          <label className="ctorPillBtn" style={{ cursor:'pointer' }}>
            Загрузить
            <input
              type="file"
              accept="image/*"
              style={{ display:'none' }}
              onChange={(e)=>{
                const f = e.target.files?.[0];
                if (f) uploadCover(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        {v.cover_url ? (
          <div style={{ marginTop: 8 }}>
            <img
              src={String(v.cover_url)}
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

      {/* ===== Layout + PIN ===== */}
      <div className="ctorGrid2">
        <Field label="Колонки сетки">
          <Input
            type="number"
            value={String(v.grid_cols)}
            onChange={(e)=>setP({ grid_cols: clamp(toNum(e.target.value, 3), 1, 6) })}
          />
        </Field>

        <Field label="Монеты за штамп" hint="Сколько монет начислять за каждый отмеченный штамп (server-side).">
          <Input
            type="number"
            value={String(v.collect_coins)}
            onChange={(e)=>setP({ collect_coins: Math.max(0, Math.round(toNum(e.target.value, 0))) })}
            min={0}
            step={1}
          />
        </Field>
      </div>

      <Toggle
        checked={!!v.require_pin}
        onChange={(x)=>setP({ require_pin: !!x })}
        label="PIN подтверждение"
        hint="Подтверждать получение штампа PIN-кодом (ввод в модалке в мини-аппе)."
      />

      {/* ===== Buttons text ===== */}
      <div className="ctorGrid2">
        <Field label='Кнопка “Отметить”'>
          <Input value={toStr(v.btn_collect)} onChange={(e)=>setP({ btn_collect: e.target.value })} />
        </Field>

        <Field label='Кнопка “Получено”'>
          <Input value={toStr(v.btn_done)} onChange={(e)=>setP({ btn_done: e.target.value })} />
        </Field>
      </div>

      {/* ===== Reward ===== */}
      <div className="ctorDivider" />

      <Toggle
        checked={!!v.reward_enabled}
        onChange={(x)=>setP({ reward_enabled: !!x })}
        label="Приз за завершение"
        hint="Выдавать приз, когда все штампы собраны (по коду приза из колеса)."
      />

      <div className="ctorGrid2">
        <Field label="Заголовок приза">
          <Input value={toStr(v.reward_title)} onChange={(e)=>setP({ reward_title: e.target.value })} />
        </Field>
        <Field label="Текст">
          <Input value={toStr(v.reward_text)} onChange={(e)=>setP({ reward_text: e.target.value })} />
        </Field>
      </div>

      <Field
        label="Код приза (из колеса)"
        hint={
          <>
            Берётся из таблицы призов колеса (wheel_prizes.code). Если у приза coins &gt; 0 — начислим монеты,
            иначе выдадим redeem-код и отправим в бот.
          </>
        }
      >
        <Input
          value={toStr(v.reward_prize_code)}
          onChange={(e)=>setP({ reward_prize_code: e.target.value })}
          placeholder="например: free_coffee_6"
        />
        {rewardWarn ? (
          <div className="ctorHelp" style={{ marginTop: 8, color: '#ffcc66' }}>
            Включена выдача приза, но не указан reward_prize_code — приз не будет выдан.
          </div>
        ) : null}
      </Field>

      {/* ===== Stamps list ===== */}
      <div className="ctorDivider" />

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Карточки / штампы</div>
        <button className="ctorPillBtn" type="button" onClick={addStamp}>
          + Добавить карточку
        </button>
      </div>
      <div className="ctorHelp" style={{ marginTop: 6 }}>
        code — ID для D1/API. name — заголовок. desc — описание. image — URL или upload.
      </div>

      <div style={{ display:'grid', gap: 10, marginTop: 10 }}>
        {v.styles.map((st: any, idx: number) => (
          <StampCard
            key={idx}
            idx={idx}
            st={st}
            onPatch={(patch)=>setStamp(idx, patch)}
            onDelete={()=>{
              if (confirm('Удалить эту карточку?')) deleteStamp(idx);
            }}
            onMove={(dir)=>moveStamp(idx, dir)}
            onUpload={(file)=>uploadStampImg(idx, file)}
            canUp={idx > 0}
            canDown={idx < v.styles.length - 1}
          />
        ))}

        {!v.styles.length ? (
          <div className="ctorEmpty" style={{ marginTop: 8 }}>
            Карточек пока нет. Нажми <b>+ Добавить карточку</b>.
          </div>
        ) : null}
      </div>
    </div>
  );
}
