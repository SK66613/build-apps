import React from 'react';
import { PagesTree } from './PagesTree';
import { BlocksPalette } from './BlocksPalette';
import { Inspector } from './Inspector';

type Mode = 'panel' | 'design';

function useLS<T>(key: string, init: T){
  const [v, setV] = React.useState<T>(() => {
    try{
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    }catch(_){
      return init;
    }
  });
  React.useEffect(()=>{
    try{ localStorage.setItem(key, JSON.stringify(v)); }catch(_){ }
  }, [key, v]);
  return [v, setV] as const;
}

/** простая “гармошка” без зависимостей */
function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}){
  return (
    <details className="ctorAcc" open={defaultOpen}>
      <summary className="ctorAcc__sum">
        <span className="ctorAcc__title">{title}</span>
        <span className="ctorAcc__chev">▾</span>
      </summary>
      <div className="ctorAcc__body">{children}</div>
    </details>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (m: Mode)=>void;
}){
  return (
    <div className="ctorSeg" role="tablist" aria-label="Constructor mode">
      <button
        type="button"
        className={'ctorSeg__btn' + (value==='design' ? ' is-active' : '')}
        onClick={()=>onChange('design')}
        role="tab"
        aria-selected={value==='design'}
      >
        Дизайн
      </button>
      <button
        type="button"
        className={'ctorSeg__btn' + (value==='panel' ? ' is-active' : '')}
        onClick={()=>onChange('panel')}
        role="tab"
        aria-selected={value==='panel'}
      >
        Панель
      </button>
    </div>
  );
}

export function ConstructorDrawer(){
  // как в старом: ctor_mode хранится
  const [mode, setMode] = useLS<Mode>('ctor_mode', 'panel');

  return (
    <div className="ctorDrawer">
      <div className="ctorDrawer__top">
        <Segmented value={mode} onChange={setMode} />
      </div>

      <div className="ctorDrawer__hint">
        Добавляй вкладки и страницы, редактируй блоки; превью обновляется сразу, сохраняется по кнопке.
      </div>

      {mode === 'panel' ? (
        <div className="ctorDrawer__stack">
          <Accordion title="Страницы" defaultOpen>
            <PagesTree />
          </Accordion>

          <Accordion title="Блоки" defaultOpen>
            <BlocksPalette />
          </Accordion>

          <Accordion title="Inspector" defaultOpen>
            <Inspector />
          </Accordion>
        </div>
      ) : (
        <div className="ctorDrawer__stack">
          {/* Тут пока структура 1:1 как в старом — наполнение подключим дальше */}
          <Accordion title="Темы" defaultOpen>
            <div className="ctorStub">
              Тут будет выбор пресетов/тем (как в старом конструкторе).
            </div>
          </Accordion>

          <Accordion title="Базовые стили" defaultOpen>
            <div className="ctorStub">
              Тут будут цвета: Background / Surface / Card / Border / Text / Muted…
            </div>
          </Accordion>

          <Accordion title="Брендирование">
            <div className="ctorStub">Лого/акцент/шрифты — подключим.</div>
          </Accordion>

          <Accordion title="Кнопки">
            <div className="ctorStub">Радиусы/цвета/типы кнопок — подключим.</div>
          </Accordion>

          <Accordion title="Навбар / Overlay">
            <div className="ctorStub">Настройки таббара/оверлеев — подключим.</div>
          </Accordion>

          <Accordion title="Радиусы">
            <div className="ctorStub">radius-card / radius-btn / radius-input — подключим.</div>
          </Accordion>

                    <Accordion title="Тени / Glow">
            <div className="ctorStub">Card shadow (0..1) / Focus glow (0..1) — подключим.</div>
          </Accordion>

                    <Accordion title="Прозрачность">
            <div className="ctorStub">Прозрачность применяется TG-safe через rgba(), без color-mix — подключим.</div>
          </Accordion>

                    <Accordion title="Шрифты">
            <div className="ctorStub">Заголовки / Текст (Body) / Кнопки / Меню (Tabbar) — подключим.</div>
          </Accordion>
        </div>
      )}
    </div>
  );
}

export default ConstructorDrawer;
