import React from 'react';
import { useConstructorStore } from '../state/constructorStore';
import { Button } from '../../components/ui';

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
  const { bp, selected, selectRoute, selectBlock, updateRoute } = useConstructorStore();
  const removeBlock = useConstructorStore(s=>s.removeBlock);
  const moveBlock = useConstructorStore(s=>s.moveBlock);
  const toggleHidden = useConstructorStore(s=>s.toggleBlockHidden);
  const duplicateBlock = useConstructorStore(s=>s.duplicateBlock);

  const curPath =
    selected?.kind === 'block' ? selected.path :
    selected?.kind === 'route' ? selected.path :
    bp.routes[0]?.path || '/';

  const route = bp.routes.find(r => r.path === curPath) || bp.routes[0];
  if (!route){
    return <div className="ctorEmpty">Нет страниц. Добавь страницу в “Страницы”.</div>;
  }

  // выбор страницы если selected пустой
  React.useEffect(()=>{
    if (!selected && route?.path) selectRoute(route.path);
  }, [selected, route?.path, selectRoute]);

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
                  {/* вверх/вниз */}
                  <IconBtn title="Выше" disabled={idx===0} onClick={()=>moveBlock(route.path, b.id, -1)}>↑</IconBtn>
                  <IconBtn title="Ниже" disabled={idx===route.blocks.length-1} onClick={()=>moveBlock(route.path, b.id, 1)}>↓</IconBtn>

                  {/* редактировать (пока заглушка: можно потом подключить реальный editor) */}
                  <IconBtn
                    title="Редактировать"
                    onClick={()=>{
                      // TODO: подключим реальный BlockEditor modal как в старом.
                      alert('Редактор блока: подключим следующим шагом (как в старом конструкторе).');
                    }}
                  >✎</IconBtn>

                  {/* показать/скрыть */}
                  <IconBtn title={isHidden ? 'Показать' : 'Скрыть'} onClick={()=>toggleHidden(route.path, b.id)}>
                    {isHidden ? '🙈' : '👁'}
                  </IconBtn>

                  {/* дублировать */}
                  <IconBtn title="Дублировать" onClick={()=>duplicateBlock(route.path, b.id)}>⧉</IconBtn>

                  {/* удалить */}
                  <IconBtn
                    title="Удалить"
                    onClick={()=>{
                      if (confirm('Удалить блок?')) removeBlock(route.path, b.id);
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
            // быстро: перекидываем пользователя к секции “Блоки” (палитра уже есть)
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
