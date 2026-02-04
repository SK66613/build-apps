import React from 'react';
import { TopBar } from './ui/TopBar';
import { PagesTree } from './ui/PagesTree';
import { BlocksPalette } from './ui/BlocksPalette';
import { Inspector } from './ui/Inspector';
import { PreviewFrame } from './preview/PreviewFrame';

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

export function ConstructorLayout(){
  const [open, setOpen] = useLS<boolean>('ctor_drawer_open', true);
  const [leftW, setLeftW] = useLS<number>('ctor_left_w', 420);

  const onResizeMouseDown = (e: React.MouseEvent)=>{
    e.preventDefault();
    if (!open) return;

    const startX = e.clientX;
    const startW = leftW;

    const onMove = (ev: MouseEvent)=>{
      const dx = ev.clientX - startX;
      const next = Math.max(320, Math.min(560, startW + dx));
      setLeftW(next);
    };
    const onUp = ()=>{
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="ctor">
      <TopBar />

      <div className="ctor__body ctor__body--ear">
        {/* LEFT DRAWER */}
        <aside
          className={'ctor__left ctor__left--ear' + (open ? ' is-open' : ' is-closed')}
          style={{ width: open ? leftW : 16 }}
        >
          {/* CONTENT */}
          <div className="ctor__leftInner">
            <PagesTree />
            <BlocksPalette />
          </div>

          {/* RESIZE GRIP */}
          {open && <div className="ctor__resizeGrip" onMouseDown={onResizeMouseDown} />}

          {/* EAR BUTTON (как в старом) */}
          <button
            className="ctor__ear"
            type="button"
            onClick={()=>setOpen(!open)}
            aria-label="Свернуть/развернуть панель"
            title={open ? 'Свернуть' : 'Развернуть'}
          >
            <span className="ctor__earIco">{open ? '⮜' : '⮞'}</span>
          </button>
        </aside>

        {/* CENTER PREVIEW */}
        <div className="ctor__center">
          <PreviewFrame />
        </div>

        {/* RIGHT INSPECTOR */}
        <div className="ctor__right">
          <Inspector />
        </div>
      </div>
    </div>
  );
}
