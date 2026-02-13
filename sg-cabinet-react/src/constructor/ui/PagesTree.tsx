import React from 'react';
import { useConstructorStore } from '../state/constructorStore';
import { Button, Input } from '../../components/ui';
import { BlocksPalette } from './BlocksPalette';
import Modal from './Modal';
import { getEditorForKey } from '../editors/getEditor';

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
  return s || '/';
}

const GLYPHS: string[] = ['◌','●','■','▲','◆','★','♥','☻','✦','⚡','✚','☰'];

const PRESET_KINDS: Array<{ kind: any; label: string; glyph: string }> = [
  { kind: 'home',       label: 'Home',       glyph: '🏠' },
  { kind: 'play',       label: 'Play',       glyph: '▶️' },
  { kind: 'bonuses',    label: 'Bonuses',    glyph: '🎁' },
  { kind: 'tournament', label: 'Tournament', glyph: '🏆' },
  { kind: 'profile',    label: 'Profile',    glyph: '👤' },
  { kind: 'custom',     label: 'Custom',     glyph: '◌' },
];

function InlineModal({
  open,
  title,
  onClose,
  children,
  footer,
}:{
  open: boolean;
  title: React.ReactNode;
  onClose: ()=>void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}){
  if (!open) return null;
  return (
    <div className="ctorModal" onMouseDown={onClose}>
      <div className="ctorModal__panel" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="ctorModal__hdr">
          <div className="ctorModal__ttl">{title}</div>
          <Button variant="ghost" onClick={onClose}>Закрыть</Button>
        </div>
        <div className="ctorModal__body">{children}</div>
        {footer ? <div className="ctorModal__ftr">{footer}</div> : null}
      </div>
    </div>
  );
}

function LayersList({
  path,
  onRequestAddBlock,
  onRequestEditBlock,
}:{
  path: string;
  onRequestAddBlock: ()=>void;
  onRequestEditBlock: (id: string)=>void;
}){
  const blueprint = useConstructorStore(s=>s.blueprint);
  const selected  = useConstructorStore(s=>s.selected);
  const selectBlock = useConstructorStore(s=>s.selectBlock);

  const deleteBlock = useConstructorStore(s=>(s as any).deleteBlock || (s as any).removeBlock);
  const moveBlock = useConstructorStore(s=>(s as any).moveBlock);
  const toggleHidden = useConstructorStore(s=>(s as any).toggleBlockHidden);
  const duplicateBlock = useConstructorStore(s=>(s as any).duplicateBlock);

  const route = blueprint.routes.find(r=>r.path===path);
  if (!route) return <div className="ctorEmpty">Нет данных страницы.</div>;

  return (
    <div className="ctorLayers">
      <div className="ctorLayers__head">
        <div className="ctorLayers__title">Блоки</div>
        <div className="ctorLayers__count">({route.blocks.length})</div>
      </div>

      <div className="ctorLayers__list">
        {route.blocks.map((b, idx)=>{
          const isSel =
            selected?.kind === 'block' &&
            selected.path === path &&
            selected.id === b.id;

          const isHidden = !!(b as any).hidden;

          return (
            <div
              key={b.id}
              className={'layerRow' + (isSel ? ' is-active' : '') + (isHidden ? ' is-hidden' : '')}
              onClick={()=>selectBlock(path, b.id)}
            >
              <div className="layerRow__main">
                <div className="layerRow__name">
                  <div className="layerRow__title">{(b as any).props?.title || b.key}</div>
                  <div className="layerRow__sub">{b.key}</div>
                </div>

                <div className="layerRow__actions" onClick={(e)=>e.stopPropagation()}>
                  <IconBtn title="Выше" disabled={idx===0} onClick={()=>moveBlock(path, b.id, -1)}>↑</IconBtn>
                  <IconBtn title="Ниже" disabled={idx===route.blocks.length-1} onClick={()=>moveBlock(path, b.id, 1)}>↓</IconBtn>

                  {/* ✅ карандашик */}
                  <IconBtn title="Редактировать" onClick={()=>onRequestEditBlock(b.id)}>✎</IconBtn>

                  <IconBtn title={isHidden ? 'Показать' : 'Скрыть'} onClick={()=>toggleHidden(path, b.id)}>
                    {isHidden ? '🙈' : '👁'}
                  </IconBtn>

                  <IconBtn title="Дублировать" onClick={()=>duplicateBlock(path, b.id)}>⧉</IconBtn>

                  <IconBtn
                    title="Удалить"
                    onClick={()=>{
                      if (confirm('Удалить блок?')) deleteBlock(path, b.id);
                    }}
                  >
                    🗑
                  </IconBtn>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

export function PagesTree(){
  const nav = useConstructorStore(s=>s.blueprint.nav.routes);
  const blueprint = useConstructorStore(s=>s.blueprint);

  const selected = useConstructorStore(s=>s.selected);
  const selectRoute = useConstructorStore(s=>s.selectRoute);

  const addRoute = useConstructorStore(s=>s.addRoute);

  const toggleHidden = (useConstructorStore as any)(s=>s.toggleRouteHidden);
  const setRouteIcon = (useConstructorStore as any)(s=>s.setRouteIcon);
  const renameRoute = (useConstructorStore as any)(s=>s.renameRoute);
  const deleteRoute = (useConstructorStore as any)(s=>s.deleteRoute);

  const updateBlockProps = useConstructorStore(s=>(s as any).updateBlockProps || (s as any).updateBlock);
  const deleteBlock = useConstructorStore(s=>(s as any).deleteBlock || (s as any).removeBlock);

  const activePath =
    selected?.kind === 'route' ? selected.path :
    selected?.kind === 'block' ? selected.path :
    nav[0]?.path || '/';

  // open accordion state like old
  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>({});

  React.useEffect(()=>{
    // если ничего не открыто — открыть активную
    setOpenMap((m)=>{
      if (m[activePath] !== undefined) return m;
      return { ...m, [activePath]: true };
    });
  }, [activePath]);

  // modals
  const [editOpen, setEditOpen] = React.useState(false);
  const [iconOpen, setIconOpen] = React.useState(false);
  const [libOpen, setLibOpen] = React.useState(false);
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

  // block editor modal state
  const [blockEdit, setBlockEdit] = React.useState<{ path:string; id:string } | null>(null);
  const editingRoute = blockEdit ? blueprint.routes.find(r=>r.path===blockEdit.path) : null;
  const editingBlock = blockEdit && editingRoute ? (editingRoute as any).blocks?.find((b:any)=>b.id===blockEdit.id) : null;
  const EditorCmp = editingBlock ? getEditorForKey(editingBlock.key) : null;

  const applyIconImg = async (file: File)=>{
    const toDataUrl = (f: File) => new Promise<string>((res, rej)=>{
      const rd = new FileReader();
      rd.onload = ()=>res(String(rd.result || ''));
      rd.onerror = ()=>rej(new Error('file read error'));
      rd.readAsDataURL(f);
    });
    const url = await toDataUrl(file);
    if (typeof setRouteIcon === 'function' && cur) {
      setRouteIcon(cur.path, { kind:'custom', icon:'custom', icon_g:'', icon_img: url });
    }
    setIconOpen(false);
  };

  return (
    <div className="pagesTree">
      <div className="ctor-panel__head">
        
        <button className="ctorPillBtn" type="button" onClick={()=>addRoute()}>
  + Страница
</button>
      </div>

      <div className="pagesTree__list">
        {nav.map(r=>{
          const isActive = activePath === r.path;
          const isHidden = !!(r as any).hidden;

          const glyph =
            ((r as any).icon_img && String((r as any).icon_img).trim()) ? '🖼' :
            ((r as any).icon_g && String((r as any).icon_g).trim()) ? (r as any).icon_g :
            ((r as any).kind ? PRESET_KINDS.find(k=>k.kind===(r as any).kind)?.glyph : '') ||
            '◌';

          const isOpen = !!openMap[r.path];

          return (
            <div key={r.path} className={'pageAcc' + (isActive ? ' is-active' : '') + (isHidden ? ' is-hidden' : '')}>
              {/* HEADER */}
              <div
                className="pageAcc__hdr"
                onClick={()=>{
                  selectRoute(r.path);
                  setOpenMap(m => ({ ...m, [r.path]: !m[r.path] }));
                }}
              >
                <div className="pageAcc__left">
                  <div className="pageRow__ico">{glyph}</div>
                  <div className="pageRow__meta">
                    <div className="pageRow__title">{(r as any).title}</div>
                    <div className="pageRow__slug">{r.path}</div>
                  </div>
                </div>

                <div className="pageAcc__right" onClick={(e)=>e.stopPropagation()}>
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

                  <IconBtn
                    title={isOpen ? 'Свернуть' : 'Развернуть'}
                    onClick={()=>{
                      setOpenMap(m => ({ ...m, [r.path]: !m[r.path] }));
                    }}
                  >
                    {isOpen ? '▴' : '▾'}
                  </IconBtn>
                </div>
              </div>

              {/* BODY */}
              {isOpen && (
                <div className="pageAcc__body">
                  <LayersList
                    path={r.path}
                    onRequestAddBlock={()=>{
                      setCurPath(r.path);
                      setLibOpen(true);
                    }}
                    onRequestEditBlock={(id)=>{
                      setBlockEdit({ path: r.path, id });
                    }}
                  />

                  {/* нижняя кнопка, как в старом — под блоками */}
<div className="pageAcc__addUnder">
  <button className="ctorPillBtn"
    type="button"
    onClick={()=>{
      setCurPath(r.path);
      setLibOpen(true);
    }}
  >
    + Блок
  </button>
</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== Modal: edit title + slug ===== */}
      <InlineModal
        open={editOpen}
        title={<>Редактировать страницу <span className="ctorModal__muted">{cur?.path}</span></>}
        onClose={()=>setEditOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={()=>setEditOpen(false)}>Отмена</Button>
            <Button
              onClick={()=>{
                if (!cur) return;
                const nextPath = normalizePathInput(tmpPath);
                const title = String(tmpTitle || '').trim();
                if (typeof renameRoute === 'function') renameRoute(cur.path, { title, nextPath });
                setEditOpen(false);
              }}
            >
              Сохранить
            </Button>
          </>
        }
      >
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
      </InlineModal>

      {/* ===== Modal: icon picker (kind / glyph / image upload) ===== */}
      <InlineModal
        open={iconOpen}
        title={<>Иконка вкладки <span className="ctorModal__muted">{cur?.path}</span></>}
        onClose={()=>setIconOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={()=>setIconOpen(false)}>Отмена</Button>
            <Button
              onClick={()=>{
                if (cur && typeof setRouteIcon === 'function') {
                  setRouteIcon(cur.path, { kind:'custom', icon:'custom', icon_g:'◌', icon_img:'' });
                }
                setIconOpen(false);
              }}
            >
              Сбросить
            </Button>
          </>
        }
      >
        <div className="iconPicker">
          <div className="iconPicker__sec">
            <div className="iconPicker__ttl">Пресеты (kind)</div>
            <div className="iconPicker__grid">
              {PRESET_KINDS.map(item=>(
                <button
                  key={item.kind}
                  type="button"
                  className={'iconPick' + ((cur as any)?.kind === item.kind ? ' is-active' : '')}
                  onClick={()=>{
                    if (!cur) return;
                    if (typeof setRouteIcon === 'function') {
                      setRouteIcon(cur.path, { kind: item.kind, icon: 'custom', icon_g: '', icon_img: '' });
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
                  className={'iconPick' + ((cur as any)?.icon_g === g ? ' is-active' : '')}
                  onClick={()=>{
                    if (!cur) return;
                    if (typeof setRouteIcon === 'function') {
                      setRouteIcon(cur.path, { kind:'custom', icon:'custom', icon_g: g, icon_img: '' });
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

          <div className="iconPicker__sec">
            <div className="iconPicker__ttl">Своя картинка (icon_img)</div>
            <div className="iconUpload">
              <input
                type="file"
                accept="image/*"
                onChange={(e)=>{
                  const f = e.target.files?.[0];
                  if (f) applyIconImg(f);
                  e.currentTarget.value = '';
                }}
              />
              <div className="ctorHelp">
                Сейчас сохраняем как <b>data:</b> (внутри blueprint). Позже можем сделать загрузку на CDN и хранить URL.
              </div>
            </div>
          </div>
        </div>
      </InlineModal>

      {/* ===== Modal: Blocks library (BlocksPalette) ===== */}
      <InlineModal
        open={libOpen}
        title={<>Библиотека блоков <span className="ctorModal__muted">{curPath}</span></>}
        onClose={()=>setLibOpen(false)}
        footer={<Button variant="ghost" onClick={()=>setLibOpen(false)}>Закрыть</Button>}
      >
        <div className="ctorLib">
          <BlocksPalette />
          <div className="ctorHelp" style={{ marginTop: 10 }}>
            Если блок добавляется не в ту страницу — скажи, я поправлю BlocksPalette, чтобы он добавлял в <b>{curPath}</b>.
          </div>
        </div>
      </InlineModal>

      {/* ===== Modal: Block editor (✎) ===== */}
      <Modal
        open={!!blockEdit && !!editingBlock}
        title={<>Редактор блока <span className="ctorModal__muted">{editingBlock?.key}</span></>}
        subtitle={editingBlock ? <span style={{color:'rgba(100,116,139,.9)'}}>{editingBlock.key}</span> : null}
        onClose={()=>setBlockEdit(null)}
        footer={
          editingBlock ? (
            <>
              <Button
                variant="ghost"
                onClick={()=>{
                  if (confirm('Удалить блок?')) {
                    if (editingRoute?.path) deleteBlock(editingRoute.path, editingBlock.id);
                    setBlockEdit(null);
                  }
                }}
              >
                Удалить блок
              </Button>
              <div style={{flex:1}} />
              <Button onClick={()=>setBlockEdit(null)}>Готово</Button>
            </>
          ) : null
        }
      >
        {editingBlock && EditorCmp ? (
          <EditorCmp
            value={editingBlock.props || {}}
            onChange={(nextProps:any)=>{
              if (editingRoute?.path) updateBlockProps(editingRoute.path, editingBlock.id, nextProps);
            }}
          />
        ) : (
          <div className="ctorEmpty">
            Для этого блока пока нет редактора (key: <b>{editingBlock?.key}</b>)
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PagesTree;
