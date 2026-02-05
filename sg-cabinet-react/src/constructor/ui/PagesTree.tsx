import React from 'react';
import { useConstructorStore } from '../state/constructorStore';
import { Button, Input } from '../../components/ui';

function iconBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string; children: React.ReactNode }){
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

const ICONS: Array<{ id: string; label: string; glyph: string }> = [
  { id:'home',    label:'Дом',     glyph:'●' },
  { id:'gamepad', label:'Игра',    glyph:'▲' },
  { id:'cup',     label:'Кубок',   glyph:'★' },
  { id:'gift',    label:'Подарок', glyph:'◆' },
  { id:'user',    label:'Профиль', glyph:'☺' },
  { id:'heart',   label:'Сердце',  glyph:'♥' },
  { id:'star',    label:'Звезда',  glyph:'★' },
  { id:'cart',    label:'Корзина', glyph:'▦' },
  { id:'custom',  label:'Свой…',   glyph:'◌' },
];

function slugFromPath(path: string){
  if (path === '/') return '/';
  return path.replace(/^\//,'');
}

export function PagesTree(){
  const bp = useConstructorStore(s=>s.bp);
  const selected = useConstructorStore(s=>s.selected);
  const selectRoute = useConstructorStore(s=>s.selectRoute);

  const addRoute = useConstructorStore(s=>s.addRoute);
  const renameNavRoute = useConstructorStore(s=>s.renameNavRoute);
  const toggleNavHidden = useConstructorStore(s=>s.toggleNavHidden);
  const setNavIcon = useConstructorStore(s=>s.setNavIcon);
  const removeNavRoute = useConstructorStore(s=>s.removeNavRoute);

  const routes = bp.nav?.routes || [];

  const activePath =
    selected?.kind === 'route' ? selected.path :
    selected?.kind === 'block' ? selected.path :
    routes[0]?.path || '/';

  // ===== modal state (rename / icon)
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [iconOpen, setIconOpen] = React.useState(false);
  const [curPath, setCurPath] = React.useState<string>('/');

  const curNav = routes.find(r=>r.path===curPath);

  const [tmpTitle, setTmpTitle] = React.useState('');
  const [tmpSlug, setTmpSlug] = React.useState('');

  React.useEffect(()=>{
    if (!renameOpen) return;
    const r = routes.find(x=>x.path===curPath);
    setTmpTitle(r?.title || '');
    setTmpSlug(slugFromPath(r?.path || '/'));
  }, [renameOpen, curPath, routes]);

  return (
    <div className="pagesTree">
      <div className="pagesTree__list">
        {routes.map(r=>{
          const isActive = r.path === activePath;
          const isHidden = !!r.hidden;
          const slug = slugFromPath(r.path);

          return (
            <div
              key={r.path}
              className={'pageRow' + (isActive ? ' is-active' : '') + (isHidden ? ' is-hidden' : '')}
              onClick={()=>selectRoute(r.path)}
            >
              <div className="pageRow__dot" />

              <div className="pageRow__meta">
                <div className="pageRow__title">{r.title}</div>
                <div className="pageRow__slug">{slug === '/' ? '/' : `/${slug}`}</div>
              </div>

              <div className="pageRow__actions" onClick={(e)=>e.stopPropagation()}>
                <iconBtn
                  title={isHidden ? 'Показать вкладку' : 'Скрыть вкладку'}
                  onClick={()=>toggleNavHidden(r.path)}
                >
                  {isHidden ? '🙈' : '👁'}
                </iconBtn>

                <iconBtn
                  title="Иконка вкладки"
                  onClick={()=>{
                    setCurPath(r.path);
                    setIconOpen(true);
                  }}
                >
                  ico
                </iconBtn>

                <iconBtn
                  title="Редактировать"
                  onClick={()=>{
                    setCurPath(r.path);
                    setRenameOpen(true);
                  }}
                >
                  ✎
                </iconBtn>

                {r.path !== '/' && (
                  <iconBtn
                    title="Удалить страницу"
                    onClick={()=>{
                      if (confirm('Удалить страницу?')) removeNavRoute(r.path);
                    }}
                  >
                    ✕
                  </iconBtn>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pagesTree__footer">
        <Button
          onClick={()=>{
            // создаём /page-2 /page-3 ...
            const base = '/page-';
            let i = 2;
            while(routes.some(r=>r.path === `${base}${i}`)) i++;
            addRoute({
              path: `${base}${i}`,
              title: 'Новая',
              blocks: [],
              icon: 'custom',
            });
          }}
        >
          Добавить страницу
        </Button>
      </div>

      {/* ===== Rename modal ===== */}
      {renameOpen && curNav && (
        <div className="ctorModal" onMouseDown={()=>setRenameOpen(false)}>
          <div className="ctorModal__panel" onMouseDown={(e)=>e.stopPropagation()}>
            <div className="ctorModal__hdr">
              <div className="ctorModal__ttl">Название страницы <span className="ctorModal__muted">{curNav.path}</span></div>
              <Button variant="ghost" onClick={()=>setRenameOpen(false)}>Закрыть</Button>
            </div>

            <div className="ctorForm">
              <div className="ctorField">
                <div className="ctorLabel">Новое название</div>
                <Input value={tmpTitle} onChange={e=>setTmpTitle(e.target.value)} placeholder="Например, Главная" />
              </div>

              <div className="ctorField">
                <div className="ctorLabel">Slug (путь)</div>
                <Input value={tmpSlug} onChange={e=>setTmpSlug(e.target.value)} placeholder="/" />
                <div className="ctorHelp">Пример: <b>home</b> → путь будет <b>/home</b>. Для корня оставь <b>/</b>.</div>
              </div>
            </div>

            <div className="ctorModal__ftr">
              <Button variant="ghost" onClick={()=>setRenameOpen(false)}>Отмена</Button>
              <Button
                onClick={()=>{
                  const nextPath = (tmpSlug.trim() === '/' || tmpSlug.trim() === '') ? '/' : '/' + tmpSlug.trim().replace(/^\//,'');
                  renameNavRoute(curNav.path, { title: tmpTitle, nextPath });
                  setRenameOpen(false);
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Icon modal ===== */}
      {iconOpen && curNav && (
        <div className="ctorModal" onMouseDown={()=>setIconOpen(false)}>
          <div className="ctorModal__panel" onMouseDown={(e)=>e.stopPropagation()}>
            <div className="ctorModal__hdr">
              <div className="ctorModal__ttl">Иконка вкладки <span className="ctorModal__muted">{curNav.path}</span></div>
              <Button variant="ghost" onClick={()=>setIconOpen(false)}>Закрыть</Button>
            </div>

            <div className="iconGrid">
              {ICONS.map(ic=>(
                <button
                  key={ic.id}
                  type="button"
                  className={'iconCard' + ((curNav.icon||'')===ic.id ? ' is-active' : '')}
                  onClick={()=>{
                    setNavIcon(curNav.path, ic.id);
                    setIconOpen(false);
                  }}
                >
                  <div className="iconCard__glyph">{ic.glyph}</div>
                  <div className="iconCard__txt">
                    <div className="iconCard__lbl">{ic.label}</div>
                    <div className="iconCard__id">{ic.id}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="ctorModal__ftr">
              <Button variant="ghost" onClick={()=>setIconOpen(false)}>Отмена</Button>
              <Button
                onClick={()=>{
                  setNavIcon(curNav.path, undefined);
                  setIconOpen(false);
                }}
              >
                Убрать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PagesTree;
