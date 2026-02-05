import React from 'react';
import { useConstructorStore } from '../state/constructorStore';
import { Button } from '../../components/ui';

function IconBtn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string; children: React.ReactNode }
){
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
  const blueprint = useConstructorStore(s => s.blueprint);
  const selected = useConstructorStore(s => s.selected);

  const selectRoute = useConstructorStore(s => s.selectRoute);
  const selectBlock = useConstructorStore(s => s.selectBlock);

  const deleteBlock = useConstructorStore(s => s.deleteBlock);
  const moveBlock = useConstructorStore(s => s.moveBlock);
  const toggleHidden = useConstructorStore(s => s.toggleBlockHidden);
  const duplicateBlock = useConstructorStore(s => s.duplicateBlock);

  const curPath =
    selected?.kind === 'block' ? selected.path :
    selected?.kind === 'route' ? selected.path :
    (blueprint.nav.routes[0]?.path || '/');

  const route = blueprint.routes.find(r => r.path === curPath);

  if (!route){
    return (
      <div className="ctorEmpty">
        Нет страницы <b>{curPath}</b> в blueprint.routes. Добавь страницу в “Страницы”.
      </div>
    );
  }

  // если вдруг selected слетел — восстановим
  React.useEffect(()=>{
    if (!selected && route?.path) selectRoute(route.path);
  }, [selected, route?.path, selectRoute]);

  return (
    <div className="ctorInspector">
      <div className="ctorInspector__hdr">
        <div className="ctorInspector__title">
          Блоки на странице: <b>{route.path}</b>
        </div>
        <div className="ctorInspector__small">({route.blocks.length})</div>
      </div>

      <div className="ctorInspector__list">
        {route.blocks.map((b, idx) => {
          const isSel =
            selected?.kind === 'block' &&
            selected.path === route.path &&
            selected.id === b.id;

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

                  <IconBtn
                    title="Редактировать"
                    onClick={()=>{
                      alert('Редактор блока подключим следующим шагом (как в старом конструкторе).');
                    }}
                  >✎</IconBtn>

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
        <Button
          onClick={()=>{
            alert('Нажми “Блоки” → выбери блок. (Модал “Библиотека блоков” сделаем следующим шагом.)');
          }}
        >
          Добавить блок
        </Button>
      </div>
    </div>
  );
}

export default Inspector;
