import React from 'react';
import { useConstructorStore } from '../state/constructorStore';

export function PagesTree(){
  const nav = useConstructorStore(s=>s.blueprint.nav.routes);
  const selected = useConstructorStore(s=>s.selected);
  const selectRoute = useConstructorStore(s=>s.selectRoute);
  const addRoute = useConstructorStore(s=>s.addRoute);
  const rename = useConstructorStore(s=>s.renameRouteTitle);

    return (
    <div className="sg-card ctor-card" style={{ flex: 1 }}>
      <div className="ctor-panel__head">
        <div className="ctor-panel__title">Страницы</div>
        <button className="sg-btn" onClick={()=>addRoute()}>+ Страница</button>
      </div>

      <div className="ctor-list" style={{ maxHeight: 360 }}>
        {nav.map(r=>{
          const active = selected?.kind === 'route' && selected.path === r.path;
          return (
            <div key={r.path} className={"ctor-item " + (active ? "ctor-item--active" : "")}>
              <button className="ctor-item__btn" onClick={()=>selectRoute(r.path)}>
                <div className="ctor-item__name">{r.title}</div>
                <div className="ctor-item__meta">{r.path}</div>
              </button>

              <input
                className="ctor-input--sm"
                value={r.title}
                onChange={(e)=>rename(r.path, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

}
