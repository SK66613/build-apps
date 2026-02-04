import React from 'react';
import { useConstructorStore } from '../state/constructorStore';

const PALETTE = [
  { key: 'bonus_wheel_one', title: 'Wheel' },
  { key: 'styles_passport_one', title: 'Passport' },
  { key: 'calendar_booking_one', title: 'Calendar' },
  { key: 'game_flappy_one', title: 'Flappy' },
  { key: 'shop_stars_product_one', title: 'Stars' },
  
];

export function BlocksPalette(){
  const selected = useConstructorStore(s=>s.selected);
  const nav = useConstructorStore(s=>s.blueprint.nav.routes);
  const addBlock = useConstructorStore(s=>s.addBlock);

  const path = selected?.kind === 'route'
    ? selected.path
    : selected?.kind === 'block'
      ? selected.path
      : (nav[0]?.path || '/');

    return (
    <div className="sg-card ctor-card">
      <div className="ctor-panel__title">Блоки</div>
      <div className="ctor-panel__sub">Добавить на: <b>{path}</b></div>

      <div className="ctor-grid">
        {PALETTE.map(b=> (
          <button
            key={b.key}
            className="sg-btn"
            style={{ justifyContent:'flex-start', textAlign:'left', padding: '12px 12px' }}
            onClick={()=>addBlock(path, b.key)}
          >
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap: 2 }}>
              <div style={{ fontWeight: 1000 }}>{b.title}</div>
              <div className="sg-muted" style={{ fontSize: 12 }}>{b.key}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

}
