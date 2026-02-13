// sg-cabinet-react/src/constructor/editors/SalesQrEditor.tsx
import React from 'react';
import { Input } from '../../components/ui';

type Props = {
  value: any;
  onChange: (next: any) => void;
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? null));
}
function toStr(v: any) { return String(v ?? ''); }
function toNum(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function ensureDefaults(src: any) {
  const p = { ...(src || {}) };

  // тексты
  if (p.title === undefined) p.title = '';
  if (p.subtitle === undefined) p.subtitle = '';
  if (p.description === undefined) p.description = '';

  // важные (будут синкаться в D1 на save)
  if (p.ttl_sec === undefined) p.ttl_sec = 300;
  if (p.refresh_sec === undefined) p.refresh_sec = 60;
  if (p.cashback_percent === undefined) p.cashback_percent = 10;

  // 5 кассиров (новый формат)
  if (p.cashier1_tg_id === undefined) p.cashier1_tg_id = '';
  if (p.cashier2_tg_id === undefined) p.cashier2_tg_id = '';
  if (p.cashier3_tg_id === undefined) p.cashier3_tg_id = '';
  if (p.cashier4_tg_id === undefined) p.cashier4_tg_id = '';
  if (p.cashier5_tg_id === undefined) p.cashier5_tg_id = '';

  // кнопки/лейблы (только blueprint)
  if (p.show_refresh === undefined) p.show_refresh = true;
  if (p.show_copy === undefined) p.show_copy = true;
  if (p.btn_refresh === undefined) p.btn_refresh = 'Обновить';
  if (p.btn_copy === undefined) p.btn_copy = 'Скопировать';

  // normalize numbers
  p.ttl_sec = clamp(Math.round(toNum(p.ttl_sec, 300)), 60, 600);
  p.refresh_sec = clamp(Math.round(toNum(p.refresh_sec, 60)), 10, 600);
  p.cashback_percent = clamp(Math.round(toNum(p.cashback_percent, 10)), 0, 100);

  // normalize cashier ids as strings
  p.cashier1_tg_id = toStr(p.cashier1_tg_id).trim();
  p.cashier2_tg_id = toStr(p.cashier2_tg_id).trim();
  p.cashier3_tg_id = toStr(p.cashier3_tg_id).trim();
  p.cashier4_tg_id = toStr(p.cashier4_tg_id).trim();
  p.cashier5_tg_id = toStr(p.cashier5_tg_id).trim();

  // normalize booleans
  p.show_refresh = !!p.show_refresh;
  p.show_copy = !!p.show_copy;

  return p;
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

function Textarea({
  value,
  onChange,
  rows = 3,
  placeholder,
}:{
  value: string;
  onChange: (v: string)=>void;
  rows?: number;
  placeholder?: string;
}){
  return (
    <textarea
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e)=>onChange(e.target.value)}
      className="ctorTextarea"
      style={{
        width: '100%',
        resize: 'vertical',
        padding: 10,
        borderRadius: 12,
        border: '1px solid rgba(15,23,42,.12)',
        background: 'rgba(255,255,255,.9)',
        color: 'inherit',
        outline: 'none',
      }}
    />
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}:{
  checked: boolean;
  onChange: (v: boolean)=>void;
  label: React.ReactNode;
}){
  return (
    <label style={{ display:'flex', gap: 10, alignItems:'center', cursor:'pointer' }}>
      <input type="checkbox" checked={!!checked} onChange={(e)=>onChange(!!e.target.checked)} />
      <div className="ctorLabel" style={{ margin: 0 }}>{label}</div>
    </label>
  );
}

export default function SalesQrEditor({ value, onChange }: Props) {
  const v = React.useMemo(() => ensureDefaults(value), [value]);

  const setP = (patch: any) => {
    onChange(ensureDefaults({ ...clone(v), ...(patch || {}) }));
  };

  return (
    <div className="ctorEditor">
      <Field label="Заголовок (если пусто — скрыть)">
        <Input value={toStr(v.title)} onChange={(e)=>setP({ title: e.target.value })} />
      </Field>

      <Field label="Подзаголовок (если пусто — скрыть)">
        <Input value={toStr(v.subtitle)} onChange={(e)=>setP({ subtitle: e.target.value })} />
      </Field>

      <Field
        label="Описание (если пусто — не показываем)"
        hint="Например: Кассир сканирует QR → вводит сумму → начислим кэшбэк."
      >
        <Textarea
          value={toStr(v.description)}
          onChange={(s)=>setP({ description: s })}
          rows={3}
          placeholder="Кассир сканирует QR → вводит сумму → начислим кэшбэк."
        />
      </Field>

      <div className="ctorDivider" />

      <div className="ctorGrid2">
        <Field label="TTL QR-токена (сек)">
          <Input
            type="number"
            min={60}
            max={600}
            step={10}
            value={String(v.ttl_sec)}
            onChange={(e)=>setP({ ttl_sec: clamp(Math.round(toNum(e.target.value, 300)), 60, 600) })}
          />
        </Field>

        <Field label="Авто-обновление (сек)">
          <Input
            type="number"
            min={10}
            max={600}
            step={5}
            value={String(v.refresh_sec)}
            onChange={(e)=>setP({ refresh_sec: clamp(Math.round(toNum(e.target.value, 60)), 10, 600) })}
          />
        </Field>
      </div>

      <Field label="Кэшбек (%)">
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          value={String(v.cashback_percent)}
          onChange={(e)=>setP({ cashback_percent: clamp(Math.round(toNum(e.target.value, 10)), 0, 100) })}
        />
      </Field>

      <div className="ctorDivider" />

      <div className="ctorGrid2">
        <Field label="Кассир #1 TG ID">
          <Input value={toStr(v.cashier1_tg_id)} onChange={(e)=>setP({ cashier1_tg_id: e.target.value })} placeholder="12345678" />
        </Field>
        <Field label="Кассир #2 TG ID">
          <Input value={toStr(v.cashier2_tg_id)} onChange={(e)=>setP({ cashier2_tg_id: e.target.value })} placeholder="12345678" />
        </Field>
        <Field label="Кассир #3 TG ID">
          <Input value={toStr(v.cashier3_tg_id)} onChange={(e)=>setP({ cashier3_tg_id: e.target.value })} placeholder="12345678" />
        </Field>
        <Field label="Кассир #4 TG ID">
          <Input value={toStr(v.cashier4_tg_id)} onChange={(e)=>setP({ cashier4_tg_id: e.target.value })} placeholder="12345678" />
        </Field>
        <Field label="Кассир #5 TG ID">
          <Input value={toStr(v.cashier5_tg_id)} onChange={(e)=>setP({ cashier5_tg_id: e.target.value })} placeholder="12345678" />
        </Field>
      </div>

      <div className="ctorDivider" />

      <Field label="Кнопки">
        <div style={{ display:'grid', gap: 10 }}>
          <Checkbox checked={!!v.show_refresh} onChange={(x)=>setP({ show_refresh: x })} label='Показывать "Обновить"' />
          <Checkbox checked={!!v.show_copy} onChange={(x)=>setP({ show_copy: x })} label='Показывать "Скопировать"' />
        </div>
      </Field>

      <div className="ctorGrid2">
        <Field label='Текст кнопки "Обновить"'>
          <Input value={toStr(v.btn_refresh)} onChange={(e)=>setP({ btn_refresh: e.target.value })} />
        </Field>
        <Field label='Текст кнопки "Скопировать"'>
          <Input value={toStr(v.btn_copy)} onChange={(e)=>setP({ btn_copy: e.target.value })} />
        </Field>
      </div>

      <div className="ctorHelp" style={{ marginTop: 10 }}>
        TTL/refresh/cashback и кассиры должны улетать в D1 при сохранении (через твой sync-on-save).
      </div>
    </div>
  );
}
