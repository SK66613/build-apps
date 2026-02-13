import React from 'react';
import { Input } from '../../components/ui';

type Props = {
  value: any;
  onChange: (next: any) => void;
};

function clampNum(n: number, min?: number, max?: number){
  let v = Number.isFinite(n) ? n : 0;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return v;
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
}:{
  label: string;
  value: number;
  onChange: (v:number)=>void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}){
  return (
    <div className="ctorField">
      <div className="ctorLabel">{label}</div>
      {hint ? <div className="ctorHelp">{hint}</div> : null}
      <input
        className="ctorInput"
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e)=>{
          const raw = (e.target.value ?? '').toString();
          const n = raw === '' ? NaN : Number(raw);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </div>
  );
}

function BoolField({
  label,
  checked,
  onChange,
  hint,
}:{
  label: string;
  checked: boolean;
  onChange: (v:boolean)=>void;
  hint?: string;
}){
  return (
    <div className="ctorField">
      <div className="ctorRow" style={{ gap: 10, alignItems:'center' }}>
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e)=>onChange(!!e.target.checked)}
        />
        <div>
          <div className="ctorLabel" style={{ margin: 0 }}>{label}</div>
          {hint ? <div className="ctorHelp" style={{ marginTop: 2 }}>{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}:{
  label: string;
  value: string;
  onChange: (v:string)=>void;
  placeholder?: string;
  hint?: string;
}){
  return (
    <div className="ctorField">
      <div className="ctorLabel">{label}</div>
      {hint ? <div className="ctorHelp">{hint}</div> : null}
      <Input value={value || ''} placeholder={placeholder} onChange={(e)=>onChange((e as any).target?.value ?? '')} />
    </div>
  );
}

function ModeSelect({
  label,
  value,
  onChange,
}:{
  label: string;
  value: 'default' | 'custom';
  onChange: (v:'default'|'custom')=>void;
}){
  return (
    <div className="ctorField">
      <div className="ctorLabel">{label}</div>
      <select
        className="ctorSelect"
        value={value}
        onChange={(e)=>onChange((e.target.value as any) === 'custom' ? 'custom' : 'default')}
      >
        <option value="default">Стандартное</option>
        <option value="custom">Своя картинка</option>
      </select>
    </div>
  );
}

function ImgPicker({
  label,
  mode,
  img,
  onMode,
  onImg,
  placeholder,
}:{
  label: string;
  mode: 'default'|'custom';
  img: string;
  onMode: (m:'default'|'custom')=>void;
  onImg: (v:string)=>void;
  placeholder?: string;
}){
  const fileRef = React.useRef<HTMLInputElement|null>(null);

  const loadFile = async (file: File)=>{
    const toDataUrl = (f: File)=> new Promise<string>((res, rej)=>{
      const rd = new FileReader();
      rd.onload = ()=>res(String(rd.result || ''));
      rd.onerror = ()=>rej(new Error('file read error'));
      rd.readAsDataURL(f);
    });
    const url = await toDataUrl(file);
    onImg(url);
    onMode('custom');
  };

  return (
    <div className="ctorField">
      <div className="ctorLabel">{label}</div>

      <div className="ctorRow" style={{ gap: 10, alignItems:'center' }}>
        <select
          className="ctorSelect"
          value={mode}
          onChange={(e)=>onMode((e.target.value as any) === 'custom' ? 'custom' : 'default')}
          style={{ width: 180 }}
        >
          <option value="default">Стандартное</option>
          <option value="custom">Своя картинка</option>
        </select>

        <button
          type="button"
          className="ctorSeg__btn"
          onClick={()=>fileRef.current?.click()}
          disabled={mode !== 'custom' && !(img && img.trim())}
          title="Загрузить картинку"
        >
          Загрузить
        </button>

        <button
          type="button"
          className="ctorSeg__btn"
          onClick={()=>{ onImg(''); onMode('default'); }}
          disabled={!img}
          title="Сбросить"
        >
          Сбросить
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display:'none' }}
          onChange={(e)=>{
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) loadFile(f).catch(()=>{});
          }}
        />
      </div>

      {mode === 'custom' ? (
        <div style={{ marginTop: 8 }}>
          <Input
            value={img || ''}
            placeholder={placeholder || 'URL или data:image'}
            onChange={(e)=>{
              const v = ((e as any).target?.value ?? '').toString();
              onImg(v);
              if (v.trim()) onMode('custom');
            }}
          />
          {img ? (
            <div className="ctorImgPrev" style={{ marginTop: 10 }}>
              {/* preview */}
              <img src={img} alt="" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function EditorGameFlappyOne({ value, onChange }: Props){
  // базовая нормализация
  const v = value || {};
  const next = (patch: any)=>{
    onChange({ ...v, ...patch });
  };

  const i18n = v.i18n || {};
  const setI18n = (patch: any)=>{
    onChange({ ...v, i18n: { ...i18n, ...patch } });
  };

  // режимы + картинки
  const bird_mode   = (v.bird_mode   === 'custom') ? 'custom' : 'default';
  const shield_mode = (v.shield_mode === 'custom') ? 'custom' : 'default';
  const coin_mode   = (v.coin_mode   === 'custom') ? 'custom' : 'default';
  const pipes_mode  = (v.pipes_mode  === 'custom') ? 'custom' : 'default';

  return (
    <div className="ctorEditor">
      <div className="ctorSection">
        <div className="ctorSection__ttl">Тексты (i18n)</div>

        <TextField label='Подпись "счет:"' value={String(i18n.score ?? '')} placeholder="счет:" onChange={(x)=>setI18n({ score: x })} />
        <TextField label='Текст "тапни чтобы начать"' value={String(i18n.tap_to_start ?? '')} placeholder="Тапни чтобы начать" onChange={(x)=>setI18n({ tap_to_start: x })} />
        <TextField label='Лимит попыток (сообщение)' value={String(i18n.limit_attempts ?? '')} placeholder="Достигнут дневной лимит попыток" onChange={(x)=>setI18n({ limit_attempts: x })} />
        <TextField label='Лимит монет (сообщение)' value={String(i18n.limit_coins ?? '')} placeholder="Достигнут дневной лимит монет" onChange={(x)=>setI18n({ limit_coins: x })} />
        <TextField label='Подпись "Лучший"' value={String(i18n.best ?? '')} placeholder="Лучший" onChange={(x)=>setI18n({ best: x })} />
        <TextField label='Подпись "Мир"' value={String(i18n.world ?? '')} placeholder="Мир" onChange={(x)=>setI18n({ world: x })} />
        <TextField label='Кнопка "Ещё раз"' value={String(i18n.play_again ?? '')} placeholder="Ещё раз" onChange={(x)=>setI18n({ play_again: x })} />
      </div>

      <div className="ctorSection">
        <div className="ctorSection__ttl">Геймплей</div>
        <div className="ctorHelp">Физика, спавн, очки, монеты, магнит (магнит работает при щите).</div>

        <NumField
          label="Спавн труб каждые (ms)"
          value={Number(v.spawn_each_ms ?? 1300)}
          min={600}
          step={50}
          onChange={(n)=>next({ spawn_each_ms: clampNum(n, 600) })}
        />

        <NumField
          label="Шанс монеты (0..1)"
          value={Number(v.coin_prob ?? 0.55)}
          min={0}
          max={1}
          step={0.05}
          onChange={(n)=>next({ coin_prob: clampNum(n, 0, 1) })}
        />

        <NumField
          label="Шанс щита (0..1)"
          value={Number(v.shield_prob ?? 0.25)}
          min={0}
          max={1}
          step={0.05}
          onChange={(n)=>next({ shield_prob: clampNum(n, 0, 1) })}
        />

        <NumField
          label="Кулдаун щита (ms)"
          value={Number(v.shield_cooldown_ms ?? 9000)}
          min={0}
          step={500}
          onChange={(n)=>next({ shield_cooldown_ms: clampNum(n, 0) })}
        />

        <NumField
          label="Гравитация"
          value={Number(v.gravity ?? 1800)}
          min={200}
          step={50}
          onChange={(n)=>next({ gravity: clampNum(n, 200) })}
        />

        <NumField
          label="Сила прыжка (отриц.)"
          value={Number(v.flap_velocity ?? -520)}
          max={-50}
          step={10}
          onChange={(n)=>next({ flap_velocity: clampNum(n, undefined, -50) })}
        />

        <NumField
          label="Очков за трубу"
          value={Number(v.score_per_pipe ?? 1)}
          min={0}
          step={1}
          onChange={(n)=>next({ score_per_pipe: clampNum(n, 0) })}
        />

        <NumField
          label="Очков за монету"
          value={Number(v.score_per_coin ?? 1)}
          min={0}
          step={1}
          onChange={(n)=>next({ score_per_coin: clampNum(n, 0) })}
        />

        <NumField
          label="Начислять монет за 1 монету"
          value={Number(v.coin_value ?? 5)}
          min={1}
          step={1}
          onChange={(n)=>next({ coin_value: clampNum(n, 1) })}
        />

        <NumField
          label="Радиус магнита (px)"
          value={Number(v.magnet_radius ?? 120)}
          min={0}
          step={10}
          onChange={(n)=>next({ magnet_radius: clampNum(n, 0) })}
        />

        <NumField
          label="Сила магнита (px/s)"
          value={Number(v.magnet_strength ?? 900)}
          min={0}
          step={50}
          onChange={(n)=>next({ magnet_strength: clampNum(n, 0) })}
        />
      </div>

      <div className="ctorSection">
        <div className="ctorSection__ttl">Скорость и расстояние</div>
        <div className="ctorHelp">Как быстро летят трубы и насколько широкий проём.</div>

        <NumField
          label="Скорость труб (px/сек)"
          value={Number(v.speed_x ?? 220)}
          min={60}
          max={600}
          step={10}
          onChange={(n)=>next({ speed_x: clampNum(n, 60, 600) })}
        />

        <NumField
          label="Минимальный проём (gap_min)"
          value={Number(v.gap_min ?? 140)}
          min={60}
          max={400}
          step={10}
          onChange={(n)=>next({ gap_min: clampNum(n, 60, 400) })}
        />

        <NumField
          label="Максимальный проём (gap_max)"
          value={Number(v.gap_max ?? 220)}
          min={80}
          max={500}
          step={10}
          onChange={(n)=>next({ gap_max: clampNum(n, 80, 500) })}
        />
      </div>

      <div className="ctorSection">
        <div className="ctorSection__ttl">Режимы и спрайты</div>

        <ImgPicker
          label="Спрайт птицы"
          mode={bird_mode}
          img={String(v.bird_img ?? '')}
          onMode={(m)=>next({ bird_mode: m })}
          onImg={(x)=>next({ bird_img: x, bird_mode: x?.trim() ? 'custom' : 'default' })}
          placeholder="URL или data:image"
        />

        <ImgPicker
          label="Спрайт щита"
          mode={shield_mode}
          img={String(v.shield_img ?? '')}
          onMode={(m)=>next({ shield_mode: m })}
          onImg={(x)=>next({ shield_img: x, shield_mode: x?.trim() ? 'custom' : 'default' })}
          placeholder="URL или data:image"
        />

        <ImgPicker
          label="Спрайт монеты"
          mode={coin_mode}
          img={String(v.coin_img ?? '')}
          onMode={(m)=>next({ coin_mode: m })}
          onImg={(x)=>next({ coin_img: x, coin_mode: x?.trim() ? 'custom' : 'default' })}
          placeholder="URL или data:image"
        />

        {/* трубы: две картинки */}
        <div className="ctorField">
          <div className="ctorLabel">Спрайты труб</div>

          <ModeSelect
            label="Режим труб"
            value={pipes_mode}
            onChange={(m)=>{
              next({ pipes_mode: m });
              if (m === 'default') {
                // не обязаны чистить, но обычно приятно
                // next({ pipe_top_img:'', pipe_bottom_img:'' });
              }
            }}
          />

          {pipes_mode === 'custom' ? (
            <div style={{ display:'grid', gap: 10, marginTop: 8 }}>
              <ImgPicker
                label="Труба: верх"
                mode={'custom'}
                img={String(v.pipe_top_img ?? '')}
                onMode={()=>{}}
                onImg={(x)=>next({ pipe_top_img: x, pipes_mode: (x || (v.pipe_bottom_img||'')).trim() ? 'custom' : 'default' })}
              />
              <ImgPicker
                label="Труба: низ"
                mode={'custom'}
                img={String(v.pipe_bottom_img ?? '')}
                onMode={()=>{}}
                onImg={(x)=>next({ pipe_bottom_img: x, pipes_mode: ((v.pipe_top_img||'') || x).trim() ? 'custom' : 'default' })}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="ctorSection">
        <div className="ctorSection__ttl">Лимиты и HUD</div>

        <NumField
          label="Длина раунда (сек)"
          value={Math.max(5, Math.round(Number(v.session_ms ?? 45000) / 1000))}
          min={5}
          step={5}
          onChange={(sec)=>next({ session_ms: Math.max(5, Math.round(sec)) * 1000 })}
        />

        <TextField
          label="Лимит попыток в сутки"
          value={(v.limit_attempts_per_day ?? '') === '' ? '' : String(v.limit_attempts_per_day)}
          placeholder="пусто — без лимита"
          onChange={(x)=>{
            const raw = (x || '').trim();
            if (!raw) next({ limit_attempts_per_day: '' });
            else {
              const n = parseInt(raw, 10);
              next({ limit_attempts_per_day: Number.isFinite(n) && n > 0 ? n : '' });
            }
          }}
        />

        <TextField
          label="Лимит монет в сутки"
          value={(v.limit_coins_per_day ?? '') === '' ? '' : String(v.limit_coins_per_day)}
          placeholder="пусто — без лимита"
          onChange={(x)=>{
            const raw = (x || '').trim();
            if (!raw) next({ limit_coins_per_day: '' });
            else {
              const n = parseInt(raw, 10);
              next({ limit_coins_per_day: Number.isFinite(n) && n > 0 ? n : '' });
            }
          }}
        />

        <BoolField
          label="Показывать монетную плашку"
          checked={v.show_coin_bar ?? true}
          onChange={(b)=>next({ show_coin_bar: !!b })}
        />

        <BoolField
          label="Показывать индикатор щита"
          checked={v.show_shield_bar ?? true}
          onChange={(b)=>next({ show_shield_bar: !!b })}
        />
      </div>
    </div>
  );
}
