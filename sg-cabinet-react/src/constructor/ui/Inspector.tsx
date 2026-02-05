import React from 'react';
import { useConstructorStore } from '../state/constructorStore';
import { Button } from '../../components/ui';
import Modal from './Modal';
import { getEditorForKey } from '../editors/getEditor';

function IconBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string; children: React.ReactNode }){
  const { title, children, className, ...rest } = props;
  return (
    <button
      type="button"
      title={title}
      className={'ctorIconBtn ' + (className || '')}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Inspector(){
  const blueprint = useConstructorStore(s=>s.blueprint);
  const selected  = useConstructorStore(s=>s.selected);

  const selectRoute = useConstructorStore(s=>s.selectRoute);
  const selectBlock = useConstructorStore(s=>s.selectBlock);

  // экшены блоков (названия могут отличаться — но у тебя уже есть эти)
  const moveBlock = useConstructorStore(s=>(s as any).moveBlock);
  const toggleHidden = useConstructorStore(s=>(s as any).toggleBlockHidden);
  const duplicateBlock = useConstructorStore(s=>(s as any).duplicateBlock);
  const deleteBlock = useConstructorStore(s=>(s as any).deleteBlock || (s as any).removeBlock);
  const updateBlockProps = useConstructorStore(s=>(s as any).updateBlockProps || (s as any).updateBlock);

  const [edit, setEdit] = React.useState<{ path:string; id:string } | null>(null);

  const curPath =
    selected?.kind === 'block' ? selected.path :
    selected?.kind === 'route' ? selected.path :
    blueprint.routes[0]?.path || '/';

  const route = blueprint.routes.find(r => r.path === curPath) || blueprint.routes[0];
  if (!route){
    return <div className="ctorEmpty">Нет страниц. Добавь страницу в “Страницы”.</div>;
  }

  React.useEffect(()=>{
    if (!selected && route?.path) selectRoute(route.path);
  }, [selected, route?.path, selectRoute]);

  const editingBlock =
    edit ? route.blocks.find(b => b.id === edit.id) : null;

  const EditorCmp = editingBlock ? getEditorForKey(editingBlock.key) : null;

  return (
    <div className="ctorInspector">
      <div className="ctorInspector__hdr">
        <div className="ctorInspector__title">Блоки на странице: <b>{route.path}</b></div>
        <div className="ctorInspector__small">({route.blocks.length})</div>
      </div>

      <div className="ctorInspector__list">
        {route.blocks.map((b, idx) => {
          const isSel = selected?.kind === 'block' && selected.path === route.path && selected.id === b.id;
          const isHidden = !!b.hidden;

          return (
            <div
              key={b.id}
              className={'layerRow' + (isSel ? ' is-active' : '') + (isHidden ? ' is-hidden' : '')}
              onClick={()=>selectBlock(route.path, b.id)}
            >
              <div className="layerRow__main">
                <div className="layerRow__name">
                  <div className="layerRow__title">{b.props?.title || b.key}</div>
                  <div className="layerRow__sub">{b.key}</div>
                </div>

                <div className="layerRow__actions" onClick={(e)=>e.stopPropagation()}>
                  <IconBtn title="Выше" disabled={idx===0} onClick={()=>moveBlock(route.path, b.id, -1)}>↑</IconBtn>
                  <IconBtn title="Ниже" disabled={idx===route.blocks.length-1} onClick={()=>moveBlock(route.path, b.id, 1)}>↓</IconBtn>

                  {/* ✅ РЕДАКТОР (карандаш) */}
                  <IconBtn title="Редактировать" onClick={()=>setEdit({ path: route.path, id: b.id })}>✏️</IconBtn>


                  <IconBtn title={isHidden ? 'Показать' : 'Скрыть'} onClick={()=>toggleHidden(route.path, b.id)}>
                    {isHidden ? '🙈' : '👁'}
                  </IconBtn>

                  <IconBtn title="Дублировать" onClick={()=>duplicateBlock(route.path, b.id)}>⧉</IconBtn>

                  <IconBtn
                    title="Удалить"
                    onClick={()=>{
                      if (confirm('Удалить блок?')) deleteBlock(route.path, b.id);
                    }}
                  >🗑</IconBtn>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ctorInspector__footer">
        <Button onClick={()=>alert('Дальше сделаем “Библиотека блоков” модалкой как в старом.')}>
          Добавить блок
        </Button>
      </div>

      {/* ===== Modal editor ===== */}
      <Modal
        open={!!edit && !!editingBlock}
        title={<span>Редактор блока</span>}
        subtitle={editingBlock ? <span style={{color:'rgba(100,116,139,.9)'}}>{editingBlock.key}</span> : null}
        onClose={()=>setEdit(null)}
        footer={
          editingBlock ? (
            <>
              <Button
                variant="ghost"
                onClick={()=>{
                  if (confirm('Удалить блок?')){
                    deleteBlock(route.path, editingBlock.id);
                    setEdit(null);
                  }
                }}
              >
                Удалить блок
              </Button>
              <div style={{flex:1}} />
              <Button onClick={()=>setEdit(null)}>Готово</Button>
            </>
          ) : null
        }
      >
        {editingBlock && EditorCmp ? (
          <EditorCmp
            value={editingBlock.props || {}}
            onChange={(nextProps:any)=>{
              updateBlockProps(route.path, editingBlock.id, nextProps);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

export default Inspector;

