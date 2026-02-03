import React from 'react';
import { useConstructorStore } from '../state/constructorStore';

export function PagesTree(){
  const nav = useConstructorStore(s=>s.blueprint.nav.routes);
  const selected = useConstructorStore(s=>s.selected);
  const selectRoute = useConstructorStore(s=>s.selectRoute);
  const addRoute = useConstructorStore(s=>s.addRoute);
  const rename = useConstructorStore(s=>s.renameRouteTitle);

  return (
    <div className="sg-card" style={{ minHeight: 0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap: 10 }}>
        <div style={{ fontWeight: 1000 }}>Страницы</div>
        <button className="sg-btn" onClick={()=>addRoute()}>+ Страница</button>
      </div>

      <div style={{ marginTop: 10, display:'flex', flexDirection:'column', gap: 10, maxHeight: 300, overflow:'auto' }}>
        {nav.map(r=>{
          const active = selected?.kind === 'route' && selected.path === r.path;
          return (
            <div key={r.path} style={{ border:'1px solid var(--border)', borderRadius: 14, padding: 10, background: active ? 'rgba(34, 211, 238, 0.12)' : 'transparent' }}>
              <button
                onClick={()=>selectRoute(r.path)}
                style={{ width:'100%', textAlign:'left', background:'transparent', border:0, padding:0, cursor:'pointer' }}
              >
                <div style={{ fontWeight: 1000 }}>{r.title}</div>
                <div className="sg-muted" style={{ fontSize: 12 }}>{r.path}</div>
              </button>

              <input
                className="sg-input"
                style={{ marginTop: 8 }}
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
