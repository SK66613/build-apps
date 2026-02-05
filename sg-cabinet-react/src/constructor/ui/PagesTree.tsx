import React from 'react';
import { useConstructorStore } from '../state/constructorStore';
import { Button, Input } from '../../components/ui';

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

function normalizePathInput(v: string){
  let s = String(v || '').trim();
  if (!s || s === '/') return '/';
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\s+/g, '-');
  s = s.replace(/[^/a-zA-Z0-9_-]/g, '');
  return s;
}

function slugLabel(path: string){
  if (path === '/') return '/';
  return path;
}

type IconPick =
  | { type: 'kind'; kind: 'home'|'play'|'profile'|'bonuses'|'tournament'|'custom' }
  | { type: 'glyph'; glyph: string }
  | { type: 'none' };

const PRESET_KINDS: Array<{ kind: IconPick & {type:'kind'}; label: string; glyph: string }> = [
  { kind: {type:'kind', kind:'home'},       label: 'Home',      glyph: '🏠' },
  { kind: {type:'kind', kind:'play'},       label: 'Play',      glyph: '▶️' },
  { kind: {type:'kind', kind:'bonuses'},    label: 'Bonuses',   glyph: '🎁' },
  { kind: {type:'kind', kind:'tournament'}, label: 'Tournament',glyph: '🏆' },
  { kind: {type:'kind', kind:'profile'},    label: 'Profile',   glyph: '👤' },
  { kind: {type:'kind', kind:'custom'},     label: 'Custom',    glyph: '◌' },
];

const GLYPHS: string[] = ['◌','●','■','▲','◆','★','♥','☻','✦','⚡','✚','☰'];

export function PagesTree(){
  const nav = useConstructorStore(s=>s.blueprint.nav.routes);
  const selected = useConstructorStore(s=>s.selected);
  const selectRoute = useConstructorStore(s=>s.selectRoute);

  const addRoute = useConstructorStore(s=>s.addRoute);

  // новые экшены “страниц как в старом”
  const toggleHidden = useConstructorStore(s=> (s as any).toggleRouteHidden);
  const setRouteIcon = useConstructorStore(s=> (s as any).setRouteIcon);
  const renameRoute = useConstructorStore(s=> (s as any).renameRoute);
  const deleteRoute = useConstructorStore(s=> (s as any).deleteRoute);

  // ----- modal state
  const [editOpen, setEditOpen] = React.useState(false);
  const [iconOpen, setIconOpen] = React.useState(false);
  const [curPath, setCurPath] = React.useState<string>('/');

  const cur = nav.find(r=>r.path===curPath) || nav[0];

  const [tmpTitle, setTmpTitle] = React.useState('');
  const [tmpPath, setTmpPath] = React.useState('');

  React.useEffect(()=>{
    if (!editOpen) return;
    const r = nav.find(x=>x.path===curPath);
    setTmpTitle(r?.title || '');
    setTmpPath(r?.path || '/');
  }, [editOpen, curPath, nav]);

  const activePath =
    selected?.kind === 'route' ? selected.path :
    selected?.kind === 'block' ? selected.path :
    nav[0]?.path || '/';

  return (
    <div className="pagesTree">
      <div className="ctor-panel__head">
        <div className="ctor-panel__title">Страницы</div>
        <Button onClick={()=>addRoute()}>+ Страница</Button>
      </div>

      <div className="pagesTree__list">
        {nav.map(r=>{
          const active = activePath === r.path;
          const isHidden = !!(r as any).hidden;

          // что показать как “иконка”
          const glyph =
            (r.icon_img && r.icon_img.trim()) ? '🖼' :
            (r.icon_g && r.icon_g.trim()) ? r.icon_g :
            (r.kind ? PRESET_KINDS.find(k=>k.kind.kind===r.kind)?.glyph : '') ||
            '◌';

          return (
            <div
              key={r.path}
              className={'pageRow' + (active ? ' is-active' : '') + (isHidden ? ' is-hidden' : '')}
              onClick={()=>selectRoute(r.path)}
            >
              <div className="pageRow__ico">{glyph}</div>

              <div className="pageRow__meta">
                <div className="pageRow__title">{r.title}</div>
                <div className="pageRow__slug">{slugLabel(r.path)}</div>
              </div>

              <div className="pageRow__actions" onClick={(e)=>e.stopPropagation()}>
                <IconBtn
                  title={isHidden ? 'Показать вкладку' : 'Скрыть вкладку'}
                  onClick={()=>{
                    if (typeof toggleHidden === 'function') toggleHidden(r.path);
                  }}
                >
                  {isHidden ? '🙈' : '👁'}
                </IconBtn>

                <IconBtn
                  title="Иконка"
                  onClick={()=>{
                    setCurPath(r.path);
                    setIconOpen(true);
                  }}
                >
                  ico
                </IconBtn>

                <IconBtn
                  title="Редактировать"
                  onClick={()=>{
                    setCurPath(r.path);
                    setEditOpen(true);
                  }}
                >
                  ✎
                </IconBtn>

                {r.path !== '/' && (
                  <IconBtn
                    title="Удалить"
                    onClick={()=>{
                      if (confirm('Удалить страницу?')) {
                        if (typeof deleteRoute === 'function') deleteRoute(r.path);
                      }
                    }}
                  >
                    ✕
                  </IconBtn>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== Modal: edit title + slug ===== */}
      {editOpen && cur && (
        <div className="ctorModal" onMouseDown={()=>setEditOpen(false)}>
          <div className="ctorModal__panel" onMouseDown={(e)=>e.stopPropagation()}>
            <div className="ctorModal__hdr">
              <div className="ctorModal__ttl">
                Редактировать страницу <span className="ctorModal__muted">{cur.path}</span>
              </div>
              <Button variant="ghost" onClick={()=>setEditOpen(false)}>Закрыть</Button>
            </div>

            <div className="ctorForm">
              <div className="ctorField">
                <div className="ctorLabel">Название</div>
                <Input value={tmpTitle} onChange={(e)=>setTmpTitle(e.target.value)} />
              </div>

              <div className="ctorField">
                <div className="ctorLabel">Slug / path</div>
                <Input
                  value={tmpPath}
                  onChange={(e)=>setTmpPath(normalizePathInput(e.target.value))}
                  placeholder="/"
                />
                <div className="ctorHelp">
                  Пример: <b>/home</b>, <b>/bonus</b>. Для главной оставь <b>/</b>.
                </div>
              </div>
            </div>

            <div className="ctorModal__ftr">
              <Button variant="ghost" onClick={()=>setEditOpen(false)}>Отмена</Button>
              <Button
                onClick={()=>{
                  const nextPath = normalizePathInput(tmpPath);
                  const title = String(tmpTitle || '').trim();

                  if (typeof renameRoute === 'function') {
                    renameRoute(cur.path, { title, nextPath });
                  } else {
                    // fallback: если не добавил renameRoute — не ломаем, просто меняем title старым методом
                    const renameTitle = useConstructorStore.getState().renameRouteTitle;
                    renameTitle(cur.path, title);
                  }

                  setEditOpen(false);
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: icon picker (kind / glyph) ===== */}
      {iconOpen && cur && (
        <div className="ctorModal" onMouseDown={()=>setIconOpen(false)}>
          <div className="ctorModal__panel" onMouseDown={(e)=>e.stopPropagation()}>
            <div className="ctorModal__hdr">
              <div className="ctorModal__ttl">
                Иконка вкладки <span className="ctorModal__muted">{cur.path}</span>
              </div>
              <Button variant="ghost" onClick={()=>setIconOpen(false)}>Закрыть</Button>
            </div>

            <div className="iconPicker">
              <div className="iconPicker__sec">
                <div className="iconPicker__ttl">Пресеты (kind)</div>
                <div className="iconPicker__grid">
                  {PRESET_KINDS.map(item=>(
                    <button
                      key={item.kind.kind}
                      type="button"
                      className={'iconPick' + (cur.kind === item.kind.kind ? ' is-active' : '')}
                      onClick={()=>{
                        if (typeof setRouteIcon === 'function') {
                          setRouteIcon(cur.path, {
                            kind: item.kind.kind,
                            icon: 'custom',
                            icon_g: '',
                            icon_img: '',
                          });
                        }
                        setIconOpen(false);
                      }}
                    >
                      <div className="iconPick__glyph">{item.glyph}</div>
                      <div className="iconPick__lbl">{item.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="iconPicker__sec">
                <div className="iconPicker__ttl">Glyph (icon_g)</div>
                <div className="iconPicker__grid">
                  {GLYPHS.map(g=>(
                    <button
                      key={g}
                      type="button"
                      className={'iconPick' + (cur.icon_g === g ? ' is-active' : '')}
                      onClick={()=>{
                        if (typeof setRouteIcon === 'function') {
                          setRouteIcon(cur.path, {
                            kind: 'custom',
                            icon: 'custom',
                            icon_g: g,
                            icon_img: '',
                          });
                        }
                        setIconOpen(false);
                      }}
                    >
                      <div className="iconPick__glyph">{g}</div>
                      <div className="iconPick__lbl">glyph</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="ctorModal__ftr">
              <Button variant="ghost" onClick={()=>setIconOpen(false)}>Отмена</Button>
              <Button
                onClick={()=>{
                  if (typeof setRouteIcon === 'function') {
                    setRouteIcon(cur.path, { icon_g: '', icon_img: '', kind: 'custom', icon: 'custom' });
                  }
                  setIconOpen(false);
                }}
              >
                Сбросить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PagesTree;
