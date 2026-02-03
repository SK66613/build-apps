import React from 'react';
import { useConstructorStore } from '../state/constructorStore';

function safeJsonParse(s: string){
  try{ return { ok: true, value: JSON.parse(s) }; }catch(e:any){ return { ok: false, error: e?.message || String(e) }; }
}

export function Inspector(){
  const bp = useConstructorStore(s=>s.blueprint);
  const selected = useConstructorStore(s=>s.selected);
  const updateThemeCss = useConstructorStore(s=>s.updateThemeCss);
  const updateBlockProps = useConstructorStore(s=>s.updateBlockProps);
  const deleteBlock = useConstructorStore(s=>s.deleteBlock);
  const selectBlock = useConstructorStore(s=>s.selectBlock);

  const selPath = selected?.kind ? (selected as any).path : '/';
  const route = bp.routes.find(r=>r.path===selPath) || bp.routes[0];
  const blocks = route?.blocks || [];

  const selBlock = selected?.kind==='block'
    ? blocks.find(b=>b.id===selected.id)
    : null;

  const [propsText, setPropsText] = React.useState('');
  const [propsErr, setPropsErr] = React.useState<string | null>(null);

  React.useEffect(()=>{
    if (selBlock){
      setPropsText(JSON.stringify(selBlock.props || {}, null, 2));
      setPropsErr(null);
    } else {
      setPropsText('');
      setPropsErr(null);
    }
  }, [selBlock?.id]);

  const onApplyProps = () => {
    if (!selBlock) return;
    const p = safeJsonParse(propsText);
    if (!p.ok){ setPropsErr(p.error); return; }
    updateBlockProps(route.path, selBlock.id, p.value);
    setPropsErr(null);
  };

  return (
    <div className="sg-card" style={{ height:'calc(100vh - 220px)', minHeight: 680, overflow:'auto' }}>
      <div style={{ fontWeight: 1000 }}>Inspector</div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 1000 }}>Блоки на странице: <span className="sg-muted">{route?.path || '—'}</span></div>
        <div style={{ marginTop: 10, display:'flex', flexDirection:'column', gap: 8 }}>
          {blocks.length === 0 && <div className="sg-muted">Пока нет блоков</div>}
          {blocks.map(b=>{
            const active = selected?.kind==='block' && selected.id===b.id;
            return (
              <div key={b.id} style={{ display:'flex', gap: 8, alignItems:'center', padding: 10, borderRadius: 14, border:'1px solid var(--border)', background: active ? 'rgba(34, 197, 94, 0.10)' : 'transparent' }}>
                <button className="sg-btn" style={{ flex: 1, justifyContent:'flex-start' }} onClick={()=>selectBlock(route.path, b.id)}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
                    <div style={{ fontWeight: 1000 }}>{b.key}</div>
                    <div className="sg-muted" style={{ fontSize: 12 }}>{b.id}</div>
                  </div>
                </button>
                <button className="sg-btn" onClick={()=>deleteBlock(route.path, b.id)}>Удалить</button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 1000 }}>Theme CSS</div>
        <textarea
          className="sg-input"
          style={{ marginTop: 8, minHeight: 160, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          value={String(bp.app?.theme?.css || '')}
          onChange={(e)=>updateThemeCss(e.target.value)}
          placeholder="CSS токены темы (как в старой студии)"
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 1000 }}>Props выбранного блока</div>
        {!selBlock && <div className="sg-muted" style={{ marginTop: 8 }}>Выбери блок слева или кликни его в превью</div>}

        {selBlock && (
          <>
            <textarea
              className="sg-input"
              style={{ marginTop: 8, minHeight: 220, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
              value={propsText}
              onChange={(e)=>setPropsText(e.target.value)}
            />
            {propsErr && <div className="sg-muted" style={{ marginTop: 8 }}>JSON ошибка: {propsErr}</div>}
            <div style={{ display:'flex', gap: 10, marginTop: 10 }}>
              <button className="sg-btn primary" onClick={onApplyProps}>Применить props</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
