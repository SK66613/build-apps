import React from 'react';
import { PreviewFrame } from './preview/PreviewFrame';
import { PagesTree } from './ui/PagesTree';
import { BlocksPalette } from './ui/BlocksPalette';
import { Inspector } from './ui/Inspector';

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

function ConstructorLayout(){
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
    <div className="ctorX">
      <aside
        className={'ctorX__left' + (open ? ' is-open' : ' is-closed')}
        style={{ width: open ? leftW : 16 }}
      >
        <div className="ctorX__leftInner">
          <PagesTree />
          <BlocksPalette />
          <div className="ctorX__insWrap">
            <Inspector />
          </div>
        </div>

        {open && <div className="ctorX__resizeGrip" onMouseDown={onResizeMouseDown} />}

        <button
          className="ctorX__ear"
          type="button"
          onClick={()=>setOpen(!open)}
          title={open ? 'Свернуть' : 'Развернуть'}
        >
          <span>{open ? '❮' : '❯'}</span>
        </button>
      </aside>

      <section className="ctorX__preview">
        <PreviewFrame />
      </section>
    </div>
  );
}

export { ConstructorLayout };
export default ConstructorLayout;
