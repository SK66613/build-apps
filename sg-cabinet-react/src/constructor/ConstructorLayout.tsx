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

  return (
    <div
      className={'ctorX ' + (open ? 'is-open' : 'is-closed')}
      style={
        {
          // ширина панели как CSS var
          ['--ctor-left-w' as any]: `${leftW}px`,
        } as React.CSSProperties
      }
    >
      <aside className="ctorX__drawer">
        <div className="ctorX__drawerInner">
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
          aria-label={open ? 'Свернуть панель' : 'Открыть панель'}
        />
      </aside>

      <section className="ctorX__preview">
        <PreviewFrame />
      </section>
    </div>
  );
}

export { ConstructorLayout };
export default ConstructorLayout;
