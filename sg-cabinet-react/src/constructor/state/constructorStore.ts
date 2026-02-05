import { create } from 'zustand';
import type { Blueprint, RouteNode, BlockInst } from './types';

function uid(prefix='b_'){
  return prefix + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function findRoute(bp: Blueprint, path: string){
  return bp.routes.find(r => r.path === path);
}

export const useConstructorStore = create<{
  bp: Blueprint;
  selected: { kind:'route'; path:string } | { kind:'block'; path:string; id:string } | null;

  setBP: (bp: Blueprint)=>void;

  selectRoute: (path: string)=>void;
  selectBlock: (path: string, id: string)=>void;

  addRoute: (route: RouteNode)=>void;
  updateRoute: (path: string, patch: Partial<RouteNode>)=>void;

  addBlock: (path: string, inst: BlockInst)=>void;
  updateBlock: (path: string, id: string, patch: Partial<BlockInst>)=>void;

  removeBlock: (path: string, id: string)=>void;
  moveBlock: (path: string, id: string, dir: -1|1)=>void;
  toggleBlockHidden: (path: string, id: string)=>void;
  duplicateBlock: (path: string, id: string)=>void;
}>((set, get) => ({
  bp: { routes: [] },
  selected: null,

  setBP: (bp)=>set({ bp }),

  selectRoute: (path)=>set({ selected: { kind:'route', path } }),
  selectBlock: (path, id)=>set({ selected: { kind:'block', path, id } }),

  addRoute: (route)=>{
    const bp = clone(get().bp);
    bp.routes.push({ path: route.path, title: route.title || route.path, blocks: route.blocks || [] });
    set({ bp, selected: { kind:'route', path: route.path } });
  },

  updateRoute: (path, patch)=>{
    const bp = clone(get().bp);
    const r = findRoute(bp, path);
    if (!r) return;
    Object.assign(r, patch);
    set({ bp });
  },

  addBlock: (path, inst)=>{
    const bp = clone(get().bp);
    const r = findRoute(bp, path);
    if (!r) return;
    const bi: BlockInst = {
      id: inst.id || uid('b_'),
      key: inst.key,
      props: inst.props || {},
      hidden: !!inst.hidden,
    };
    r.blocks.push(bi);
    set({ bp, selected: { kind:'block', path, id: bi.id } });
  },

  updateBlock: (path, id, patch)=>{
    const bp = clone(get().bp);
    const r = findRoute(bp, path);
    if (!r) return;
    const b = r.blocks.find(x => x.id === id);
    if (!b) return;
    Object.assign(b, patch);
    set({ bp });
  },

  removeBlock: (path, id)=>{
    const bp = clone(get().bp);
    const r = findRoute(bp, path);
    if (!r) return;
    r.blocks = r.blocks.filter(b => b.id !== id);
    const sel = get().selected;
    const nextSel =
      (sel && sel.kind === 'block' && sel.path === path && sel.id === id)
        ? { kind:'route' as const, path }
        : sel;
    set({ bp, selected: nextSel });
  },

  moveBlock: (path, id, dir)=>{
    const bp = clone(get().bp);
    const r = findRoute(bp, path);
    if (!r) return;
    const i = r.blocks.findIndex(b => b.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= r.blocks.length) return;
    const tmp = r.blocks[i];
    r.blocks[i] = r.blocks[j];
    r.blocks[j] = tmp;
    set({ bp });
  },

  toggleBlockHidden: (path, id)=>{
    const bp = clone(get().bp);
    const r = findRoute(bp, path);
    if (!r) return;
    const b = r.blocks.find(x => x.id === id);
    if (!b) return;
    b.hidden = !b.hidden;
    set({ bp });
  },

  duplicateBlock: (path, id)=>{
    const bp = clone(get().bp);
    const r = findRoute(bp, path);
    if (!r) return;
    const i = r.blocks.findIndex(b => b.id === id);
    if (i < 0) return;
    const src = r.blocks[i];
    const copy: BlockInst = {
      id: uid('b_'),
      key: src.key,
      props: clone(src.props || {}),
      hidden: !!src.hidden,
    };
    r.blocks.splice(i + 1, 0, copy);
    set({ bp, selected: { kind:'block', path, id: copy.id } });
  },
}));
