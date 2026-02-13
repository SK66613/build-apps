// sg-cabinet-react/src/constructor/editors/StylesPassportEditor.tsx
import React from 'react';
import { Button, Input } from '../../components/ui';
import { useConstructorStore } from '../state/constructorStore';
import { apiFetch } from '../../lib/api';

type Props = {
  value: any;
  onChange: (next: any) => void;
};

type WheelPrize = {
  code: string;
  title?: string;
  coins?: number;
  active?: number | boolean;
  img?: string;
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

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result || ''));
    rd.onerror = () => reject(new Error('file read error'));
    rd.readAsDataURL(file);
  });
}

function ensureDefaults(src: any) {
  const p = { ...(src || {}) };

  if (!Array.isArray(p.styles)) p.styles = [];

  // layout
  if (p.grid_cols === undefined) p.grid_cols = 3;

  // ✅ PIN всегда включен (UI убрали)
  p.require_pin = true;

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
  if (p.reward_text === undefined)
    p.reward_text = 'Приз будет отправлен вам в бот после завершения паспорта.';
  if (p.reward_prize_code === undefined) p.reward_prize_code = '';

  // ===== PRO: period/deadline/reset (UI + config only) =====
  // modes: none | days | weekly | monthly
  if (p.deadline_mode === undefined) p.deadline_mode = 'none';
  if (p.deadline_days === undefined) p.deadline_days = 30; // only for 'days'
  if (p.deadline_title === undefined) p.deadline_title = '⏳ До конца акции';
  if (p.deadline_text === undefined) p.deadline_text = 'Соберите все штампы до конца периода.';

  // reset: none | on_deadline | daily
  if (p.reset_mode === undefined) p.reset_mode = 'none';
  if (p.reset_text === undefined) p.reset_text = 'Период завершён — прогресс сброшен.';

  // normalize stamps
  p.styles = p.styles.map((st: any) => ({
    code: toStr(st?.code),
    name: toStr(st?.name),
    desc: toStr(st?.desc),
    image: toStr(st?.image),
  }));

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
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(!!e.target.checked)}
        />
        <span style={{ fontWeight: 800 }}>{label}</span>
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

export default function StylesPassportEditor({ value, onChange }: Props) {
  const appId = useConstructorStore((s) => s.appId);

  const v = React.useMemo(() => ensureDefaults(value), [value]);

  const setP = (patch: any) => {
    const next = ensureDefaults({ ...clone(v), ...(patch || {}) });

    // ✅ всегда
    next.require_pin = true;

    onChange(next);
  };

  const setStamp = (idx: number, patch: any) => {
    const next = clone(v);
    next.styles[idx] = { ...(next.styles[idx] || {}), ...(patch || {}) };
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const addStamp = () => {
    const next = clone(v);
    next.styles.push({ code: '', name: '', desc: '', image: '' });
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const deleteStamp = (idx: number) => {
    const next = clone(v);
    next.styles.splice(idx, 1);
    next.require_pin = true;
    onChange(ensureDefaults(next));
  };

  const moveStamp = (idx: number, dir: -1 | 1) => {
    const next = clone(v);
    const j = idx + dir;
    if (j < 0 || j >= next.styles.length) return;
    const tmp = next.styles[idx];
    next.styles[idx] = next.styles[j];
    next.styles[j] = tmp;
    next.require_pin = true;
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

  // ===== wheel prizes dropdown =====
  const [wheelPrizes, setWheelPrizes] = React.useState<WheelPrize[]>([]);
  const [wheelErr, setWheelErr] = React.useState<string>('');

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setWheelErr('');
      if (!appId) return;

      try {
        // ⬇️ если у тебя другой endpoint — поменяй ТУТ
        const res = await apiFetch<any>(`/api/app/${encodeURIComponent(appId)}/wheel/prizes`, {
          method: 'GET',
        });

        const list: WheelPrize[] = Array.isArray(res?.prizes)
          ? res.prizes
          : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.results)
          ? res.results
          : [];

        const normalized = (list || [])
          .map((x: any) => ({
            code: String(x.code || ''),
            title: String(x.title || x.name || x.code || ''),
            coins: Number(x.coins || 0),
            active: x.active,
            img: x.img ? String(x.img) : '',
          }))
          .filter((x) => x.code);

        if (alive) setWheelPrizes(normalized);
      } catch (e: any) {
        if (alive) setWheelErr(e?.message || String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [appId]);

  const rewardWarn = !!v.reward_enabled && !String(v.reward_prize_code || '').trim();

  // ===== section accordions =====
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    texts: true,
    cover: true,
    layout: true,
    reward: true,
    period: false,
    stamps: true,
  });

  // ===== stamps accordion open map =====
  const [stampOpen, setStampOpen] = React.useState<Record<number, boolean>>({});
  React.useEffect(() => {
    setStampOpen((m) => {
      if (Object.keys(m).length) return m;
      return v.styles?.length ? { 0: true } : {};
    });
  }, [v.styles?.length]);

  return (
    <div className="be">
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
            <Input
              value={toStr(v.btn_collect)}
              onChange={(e) => setP({ btn_collect: e.target.value })}
            />
          </Field>

          <Field label='Кнопка “Получено”'>
            <Input value={toStr(v.btn_done)} onChange={(e) => setP({ btn_done: e.target.value })} />
          </Field>
        </div>

        <div className="beHint">
          PIN в паспорте <b>всегда включён</b> (мы убрали переключатель, чтобы не ломать логику кассира).
        </div>
      </Acc>

      <Acc
        title="Обложка"
        sub={<span className="beMut">картинка + превью</span>}
        open={!!open.cover}
        onToggle={() => setOpen((m) => ({ ...m, cover: !m.cover }))}
      >
        <Field
          label="Картинка (обложка)"
          hint="Можно вставить ссылку или загрузить файлом (сохраним как dataURL)."
        >
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
            <button
              type="button"
              className="beMiniBtn"
              disabled={!v.cover_url}
              onClick={() => setP({ cover_url: '' })}
            >
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
        sub={<span className="beMut">колонки + монеты за штамп</span>}
        open={!!open.layout}
        onToggle={() => setOpen((m) => ({ ...m, layout: !m.layout }))}
      >
        <div className="beGrid2">
          <Field label="Колонки сетки" hint="1..6">
            <Input
              type="number"
              value={String(v.grid_cols)}
              onChange={(e) => setP({ grid_cols: clamp(toNum(e.target.value, 3), 1, 6) })}
              min={1}
              max={6}
              step={1}
            />
          </Field>

          <Field
            label="Монеты за штамп"
            hint="server-side: начислять при каждом подтверждённом штампе"
          >
            <Input
              type="number"
              value={String(v.collect_coins)}
              onChange={(e) => setP({ collect_coins: Math.max(0, Math.round(toNum(e.target.value, 0))) })}
              min={0}
              step={1}
            />
          </Field>
        </div>
      </Acc>

      <Acc
        title="Приз за завершение"
        sub={
          <span className="beMut">
            выбор приза по <b>wheel_prizes.code</b>
          </span>
        }
        open={!!open.reward}
        onToggle={() => setOpen((m) => ({ ...m, reward: !m.reward }))}
        right={
          <Toggle
            checked={!!v.reward_enabled}
            onChange={(x) => setP({ reward_enabled: !!x })}
            label="Включено"
            hint={null}
          />
        }
      >
        <div className="beGrid2">
          <Field label="Заголовок приза">
            <Input value={toStr(v.reward_title)} onChange={(e) => setP({ reward_title: e.target.value })} />
          </Field>

          <Field label="Текст">
            <Input value={toStr(v.reward_text)} onChange={(e) => setP({ reward_text: e.target.value })} />
          </Field>
        </div>

        <Field
          label="Приз из колеса"
          hint={
            <>
              Мы подтягиваем список призов колеса и сохраняем <b>reward_prize_code</b>.
              Если у выбранного приза <b>coins &gt; 0</b> — начислим монеты, иначе выдадим redeem-код и отправим в бот.
            </>
          }
        >
          <div className="beRow">
            <select
              className="beSelect"
              value={toStr(v.reward_prize_code)}
              onChange={(e) => setP({ reward_prize_code: e.target.value })}
              style={{ flex: 1 }}
              disabled={!v.reward_enabled}
            >
              <option value="">— выбрать приз —</option>
              {wheelPrizes
                .filter((p) => p.code)
                .map((p) => {
                  const coins = Math.max(0, Math.floor(Number(p.coins || 0)));
                  const active = p.active === undefined ? true : !!Number(p.active);
                  const label = `${p.title || p.code} — (${p.code})${coins > 0 ? ` · ${coins} мон.` : ''}${!active ? ' · OFF' : ''}`;
                  return (
                    <option key={p.code} value={p.code}>
                      {label}
                    </option>
                  );
                })}
            </select>

            <button
              type="button"
              className="beMiniBtn"
              onClick={() => setP({ reward_prize_code: '' })}
              disabled={!v.reward_enabled || !v.reward_prize_code}
            >
              Очистить
            </button>
          </div>

          {wheelErr ? (
            <div className="beHint" style={{ marginTop: 8, opacity: 0.9 }}>
              Не удалось загрузить призы колеса: <b>{wheelErr}</b> (проверь endpoint).
            </div>
          ) : null}

          {rewardWarn ? (
            <div className="beHint" style={{ marginTop: 8, color: '#ffcc66', opacity: 1 }}>
              Включена выдача приза, но не выбран приз из колеса — приз не будет выдан.
            </div>
          ) : null}
        </Field>

        {/* fallback manual input (на всякий) */}
        <Field label="(Ручной ввод) reward_prize_code" hint="Если не хочешь зависеть от списка — можно вписать вручную.">
          <Input
            value={toStr(v.reward_prize_code)}
            onChange={(e) => setP({ reward_prize_code: e.target.value })}
            placeholder="free_coffee_6"
            disabled={!v.reward_enabled}
          />
        </Field>
      </Acc>

      <Acc
        title="Период, дедлайн, сброс"
        sub={<span className="beMut">прокачка (нужна поддержка в runtime/worker)</span>}
        open={!!open.period}
        onToggle={() => setOpen((m) => ({ ...m, period: !m.period }))}
      >
        <div className="beGrid2">
          <Field label="Дедлайн режим" hint="Пока это только конфиг. Если скажешь — допишу поддержку в мини-апп.">
            <select
              className="beSelect"
              value={toStr(v.deadline_mode)}
              onChange={(e) => setP({ deadline_mode: e.target.value })}
            >
              <option value="none">Нет дедлайна</option>
              <option value="days">Срок в днях (с первого штампа)</option>
              <option value="weekly">Каждую неделю</option>
              <option value="monthly">Каждый месяц</option>
            </select>
          </Field>

          <Field label="Срок (дней)" hint="Используется только если выбран режим “Срок в днях”.">
            <Input
              type="number"
              min={1}
              step={1}
              value={String(toNum(v.deadline_days, 30))}
              onChange={(e) => setP({ deadline_days: clamp(toNum(e.target.value, 30), 1, 365) })}
              disabled={toStr(v.deadline_mode) !== 'days'}
            />
          </Field>
        </div>

        <div className="beGrid2">
          <Field label="Заголовок дедлайна">
            <Input value={toStr(v.deadline_title)} onChange={(e) => setP({ deadline_title: e.target.value })} />
          </Field>
          <Field label="Текст дедлайна">
            <Input value={toStr(v.deadline_text)} onChange={(e) => setP({ deadline_text: e.target.value })} />
          </Field>
        </div>

        <div className="beGrid2">
          <Field label="Сброс прогресса" hint="Как вести себя, когда дедлайн истёк.">
            <select
              className="beSelect"
              value={toStr(v.reset_mode)}
              onChange={(e) => setP({ reset_mode: e.target.value })}
            >
              <option value="none">Не сбрасывать</option>
              <option value="on_deadline">Сбросить при окончании периода</option>
              <option value="daily">Сброс каждый день</option>
            </select>
          </Field>

          <Field label="Текст при сбросе">
            <Input value={toStr(v.reset_text)} onChange={(e) => setP({ reset_text: e.target.value })} />
          </Field>
        </div>

        <div className="beHint">
          Если хочешь “собрать за период иначе сброс” — это оно. Нужно только: (1) хранить старт периода у юзера,
          (2) при open/collect проверять дедлайн и чистить stamps в D1.
        </div>
      </Acc>

      <Acc
        title="Карточки / штампы"
        sub={<span className="beMut">{v.styles.length} шт.</span>}
        open={!!open.stamps}
        onToggle={() => setOpen((m) => ({ ...m, stamps: !m.stamps }))}
        right={
          <button className="beMiniBtn" type="button" onClick={addStamp}>
            + Добавить
          </button>
        }
      >
        {v.styles.length ? (
          <div className="beAccList" style={{ marginTop: 4 }}>
            {v.styles.map((st: any, idx: number) => {
              const isOpen = !!stampOpen[idx];
              const imgLabel = st?.image ? (String(st.image).startsWith('data:') ? 'Загружено' : 'URL') : 'Нет';

              return (
                <div key={idx} className={'beAcc' + (isOpen ? ' is-open' : '')}>
                  <div
                    className="beAcc__hdr"
                    onClick={() => setStampOpen((m) => ({ ...m, [idx]: !m[idx] }))}
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
                        <span className="beMut">картинка: <b>{imgLabel}</b></span>
                      </div>
                    </div>

                    <div className="beAcc__right" onClick={(e) => e.stopPropagation()}>
                      <IconBtn title="Вверх" disabled={idx === 0} onClick={() => moveStamp(idx, -1)}>
                        ↑
                      </IconBtn>
                      <IconBtn
                        title="Вниз"
                        disabled={idx === v.styles.length - 1}
                        onClick={() => moveStamp(idx, 1)}
                      >
                        ↓
                      </IconBtn>
                      <button
                        type="button"
                        className="beDanger"
                        onClick={() => {
                          if (confirm('Удалить эту карточку?')) deleteStamp(idx);
                        }}
                      >
                        Удалить
                      </button>
                      <button
                        type="button"
                        className="beChevron"
                        onClick={() => setStampOpen((m) => ({ ...m, [idx]: !m[idx] }))}
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
                            onChange={(e) => setStamp(idx, { code: e.target.value })}
                            placeholder="day1"
                          />
                        </Field>

                        <Field label="name">
                          <Input
                            value={toStr(st?.name)}
                            onChange={(e) => setStamp(idx, { name: e.target.value })}
                            placeholder="День 1"
                          />
                        </Field>
                      </div>

                      <Field label="desc">
                        <Input
                          value={toStr(st?.desc)}
                          onChange={(e) => setStamp(idx, { desc: e.target.value })}
                          placeholder="Сделайте покупку"
                        />
                      </Field>

                      <Field
                        label="image"
                        hint="Можно вставить ссылку или загрузить файлом (dataURL)."
                      >
                        <div className="beRow">
                          <Input
                            value={toStr(st?.image)}
                            onChange={(e) => setStamp(idx, { image: e.target.value })}
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
                                if (f) uploadStampImg(idx, f);
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="beMiniBtn"
                            disabled={!st?.image}
                            onClick={() => setStamp(idx, { image: '' })}
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
          <div className="beHint">Карточек пока нет — нажми “+ Добавить”.</div>
        )}
      </Acc>

      {/* local styles (same vibe as wheel editor) */}
      <style>{`
        .be{ display:grid; gap:12px; }
        .beGrid2{ display:grid; gap:12px; grid-template-columns: 1fr 1fr; }
        .beField{ display:grid; gap:6px; }
        .beLab{ font-weight: 800; }
        .beHint{ font-size: 12px; opacity: .75; line-height: 1.35; }
        .beAccList{ display:grid; gap:10px; }
        .beAcc{ border-radius: 16px; border: 1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.6); overflow:hidden; }
        .beAcc__hdr{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; cursor:pointer; }
        .beAcc__left{ min-width:0; }
        .beAcc__title{ font-weight: 900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .beAcc__sub{ display:flex; align-items:center; gap:8px; margin-top:2px; flex-wrap:wrap; }
        .beAcc__right{ display:flex; align-items:center; gap:8px; }
        .beDot{ width:4px; height:4px; border-radius:999px; background: rgba(15,23,42,.35); }
        .beMut{ font-size:12px; opacity:.75; }
        .beAcc__body{ padding:12px; border-top:1px solid rgba(15,23,42,.10); background: rgba(255,255,255,.55); }
        .beMini{ border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); border-radius:10px; padding:6px 10px; cursor:pointer; }
        .beMini:disabled{ opacity:.5; cursor:not-allowed; }
        .beMiniBtn{ border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); border-radius:999px; padding:6px 10px; cursor:pointer; }
        .beMiniBtn:disabled{ opacity:.5; cursor:not-allowed; }
        .beDanger{ border:1px solid rgba(239,68,68,.35); background: rgba(239,68,68,.10); border-radius:10px; padding:6px 10px; cursor:pointer; }
        .beChevron{ border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); border-radius:10px; padding:6px 10px; cursor:pointer; }
        .beRow{ display:flex; align-items:center; gap:10px; }
        .beChk{ display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; border:1px solid rgba(15,23,42,.10); background: rgba(255,255,255,.6); }
        .beUploadBtn{ display:inline-flex; align-items:center; justify-content:center;
          border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65);
          border-radius:999px; padding:6px 12px; cursor:pointer; }
        .beSelect{ height: 40px; border-radius: 12px; padding: 0 10px; border: 1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.65); width:100%; }
        @media (max-width: 900px){
          .beGrid2{ grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
