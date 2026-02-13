// sg-cabinet-react/src/constructor/editors/CalendarBookingEditor.tsx
import React from 'react';
import { Button, Input } from '../../components/ui';

type Props = {
  value: any;
  onChange: (next: any) => void;
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? null));
}

function toNum(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function toStr(v: any) {
  return String(v ?? '');
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function ensureDefaults(src: any) {
  const p = { ...(src || {}) };

  // defaults (как в legacy)
  if (p.title === undefined) p.title = 'Записаться на консультацию';

  if (p.allowed_minutes === undefined) p.allowed_minutes = [30, 60, 90];
  if (!Array.isArray(p.allowed_minutes)) p.allowed_minutes = [60];

  if (p.slot_step_min === undefined) p.slot_step_min = 30;
  if (p.radius === undefined) p.radius = 12;

  if (p.dur_title === undefined) p.dur_title = 'Длительность';
  if (p.slots_title === undefined) p.slots_title = 'Свободные слоты';

  if (p.text_ok === undefined) p.text_ok = 'Забронировать';
  if (p.text_hold === undefined) p.text_hold = 'Держать слот';

  if (p.show_book === undefined) p.show_book = true;
  if (p.show_hold === undefined) p.show_hold = true;

  // services section
  if (!Array.isArray(p.services)) p.services = ['', '', '', '', ''];
  if (p.services.length < 5) p.services = [...p.services, ...new Array(5 - p.services.length).fill('')];
  p.services = p.services.slice(0, 5).map((x: any) => toStr(x));

  if (p.srv_title === undefined) p.srv_title = 'Услуги';

  // normalize numbers
  p.slot_step_min = clamp(Math.round(toNum(p.slot_step_min, 30)), 5, 240);
  p.radius = clamp(Math.round(toNum(p.radius, 12)), 0, 32);

  // guard: at least one button
  const sb = !!p.show_book;
  const sh = !!p.show_hold;
  if (!sb && !sh) p.show_hold = true;

  // guard: at least one duration
  const allowed = (Array.isArray(p.allowed_minutes) ? p.allowed_minutes : [])
    .map((x: any) => Math.round(toNum(x, 0)))
    .filter((x: number) => x > 0);
  p.allowed_minutes = allowed.length ? allowed : [60];

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

function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}:{
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean)=>void;
  hint?: React.ReactNode;
}){
  return (
    <label style={{ display:'flex', gap: 10, alignItems:'center', cursor:'pointer' }}>
      <input type="checkbox" checked={!!checked} onChange={(e)=>onChange(!!e.target.checked)} />
      <div style={{ display:'flex', flexDirection:'column', gap: 3 }}>
        <div className="ctorLabel" style={{ margin: 0 }}>{label}</div>
        {hint ? <div className="ctorHelp" style={{ margin: 0 }}>{hint}</div> : null}
      </div>
    </label>
  );
}

export default function CalendarBookingEditor({ value, onChange }: Props) {
  const v = React.useMemo(() => ensureDefaults(value), [value]);

  const setP = (patch: any) => {
    const next = ensureDefaults({ ...clone(v), ...(patch || {}) });
    onChange(next);
  };

  // services debounced like legacy (чтобы не дергать превью на каждый символ)
  const srvDebRef = React.useRef<any>(null);
  const setServiceAt = (idx: number, val: string) => {
    const next = clone(v);
    next.services = Array.isArray(next.services) ? next.services.slice(0, 5) : ['', '', '', '', ''];
    while (next.services.length < 5) next.services.push('');
    next.services[idx] = val;

    if (srvDebRef.current) clearTimeout(srvDebRef.current);
    srvDebRef.current = setTimeout(() => {
      onChange(ensureDefaults(next));
    }, 60);
  };

  const DURATIONS = [30, 60, 90];

  const toggleDuration = (min: number) => {
    const set = new Set<number>((v.allowed_minutes || []).map((x: any) => Number(x)));
    if (set.has(min)) set.delete(min);
    else set.add(min);

    const vals = Array.from(set).filter((x) => Number.isFinite(x) && x > 0);

    // всегда хотя бы один
    setP({ allowed_minutes: vals.length ? vals : [60] });
  };

  const setShowBook = (flag: boolean) => {
    const next = ensureDefaults({ ...clone(v), show_book: !!flag });
    // не даём выключить обе
    if (!next.show_book && !next.show_hold) next.show_hold = true;
    onChange(next);
  };

  const setShowHold = (flag: boolean) => {
    const next = ensureDefaults({ ...clone(v), show_hold: !!flag });
    if (!next.show_book && !next.show_hold) next.show_book = true;
    onChange(next);
  };

  return (
    <div className="ctorEditor">
      <Field label="Заголовок">
        <Input value={toStr(v.title)} onChange={(e)=>setP({ title: e.target.value })} />
      </Field>

      {/* ===== Services ===== */}
      <Field
        label="Заголовок секции услуг"
        hint="Очистишь — секция скроется."
      >
        <Input value={toStr(v.srv_title)} onChange={(e)=>setP({ srv_title: e.target.value })} />
      </Field>

      <div className="ctorGrid2">
        {new Array(5).fill(0).map((_, i) => (
          <Field key={i} label={`Услуга ${i + 1}`}>
            <Input
              value={toStr(v.services?.[i])}
              onChange={(e)=>setServiceAt(i, e.target.value)}
              placeholder=""
            />
          </Field>
        ))}
      </div>

      {/* ===== Section titles ===== */}
      <div className="ctorDivider" />

      <div className="ctorGrid2">
        <Field label="Заголовок секции длительностей">
          <Input value={toStr(v.dur_title)} onChange={(e)=>setP({ dur_title: e.target.value })} />
        </Field>

        <Field label="Заголовок секции слотов">
          <Input value={toStr(v.slots_title)} onChange={(e)=>setP({ slots_title: e.target.value })} />
        </Field>
      </div>

      {/* ===== Buttons labels ===== */}
      <Field label="Подписи кнопок">
        <div className="ctorGrid2">
          <Field label="Верхняя (text_ok)">
            <Input value={toStr(v.text_ok)} onChange={(e)=>setP({ text_ok: e.target.value })} />
          </Field>
          <Field label="Нижняя (text_hold)">
            <Input value={toStr(v.text_hold)} onChange={(e)=>setP({ text_hold: e.target.value })} />
          </Field>
        </div>
      </Field>

      {/* ===== Durations ===== */}
      <Field label="Длительность слота (разрешённые)">
        <div style={{ display:'flex', gap: 10, flexWrap:'wrap' }}>
          {DURATIONS.map((m) => {
            const on = (v.allowed_minutes || []).map((x:any)=>Number(x)).includes(m);
            return (
              <button
                key={m}
                type="button"
                className={'ctorPillBtn' + (on ? ' is-active' : '')}
                onClick={()=>toggleDuration(m)}
                style={{ paddingInline: 12 }}
              >
                <span style={{ display:'inline-flex', alignItems:'center', gap: 8 }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 4,
                    border: '1px solid rgba(15,23,42,.18)',
                    background: on ? 'rgba(15,23,42,.85)' : 'rgba(255,255,255,.9)'
                  }} />
                  {m} мин
                </span>
              </button>
            );
          })}
        </div>
        <div className="ctorHelp" style={{ marginTop: 8 }}>
          Всегда должна быть выбрана хотя бы одна длительность.
        </div>
      </Field>

      {/* ===== Slot step + radius ===== */}
      <div className="ctorGrid2">
        <Field label="Шаг сетки слотов (мин)">
          <Input
            type="number"
            min={5}
            step={5}
            value={String(v.slot_step_min)}
            onChange={(e)=>setP({ slot_step_min: clamp(Math.round(toNum(e.target.value, 30)), 5, 240) })}
          />
        </Field>

        <Field label="Скругление, px">
          <Input
            type="number"
            min={0}
            max={32}
            step={1}
            value={String(v.radius)}
            onChange={(e)=>setP({ radius: clamp(Math.round(toNum(e.target.value, 12)), 0, 32) })}
          />
        </Field>
      </div>

      {/* ===== Show buttons ===== */}
      <Field label="Показывать кнопки" hint="Не даём выключить обе кнопки сразу.">
        <div style={{ display:'grid', gap: 10 }}>
          <ToggleRow label="Забронировать" checked={!!v.show_book} onChange={setShowBook} />
          <ToggleRow label="Держать слот" checked={!!v.show_hold} onChange={setShowHold} />
        </div>
      </Field>
    </div>
  );
}
