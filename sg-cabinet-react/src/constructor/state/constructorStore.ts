import { create } from 'zustand';
import type { Blueprint, Selected, SaveState, RoutePage, BlockInst } from './types';
import { clone, uid, makeDefaultBlueprint } from './utils';
import { ensureThemeTokens, themeTokensToCss, type ThemeTokens } from '../design/theme';

type State = {
  appId: string | null;
  blueprint: Blueprint;
  selected: Selected;
  dirty: boolean;
  saveState: SaveState;

  setAppId(appId: string | null): void;
  setBlueprint(bp: Blueprint): void;
  setSaveState(st: SaveState): void;
  markSaved(): void;

  selectRoute(path: string): void;
  selectBlock(path: string, id: string): void;

  addRoute(path?: string, title?: string): void;
  renameRouteTitle(path: string, title: string): void;

  addBlock(path: string, key: string): void;
  updateBlockProps(path: string, id: string, props: any): void;
  deleteBlock(path: string, id: string): void;

  // ✅ ДОБАВЛЕНО (как в старом конструкторе)
  moveBlock(path: string, id: string, dir: -1 | 1): void;
  toggleBlockHidden(path: string, id: string): void;
  duplicateBlock(path: string, id: string): void;

  // дизайн
  updateThemeTokens(patch: ThemeTokens): void;
  updateThemeCss(css: string): void;
};

function ensureRoute(bp: Blueprint, path: string): RoutePage {
  let r = bp.routes.find((x) => x.path === path);
  if (!r) {
    r = { path, blocks: [] };
    bp.routes.push(r);
  }
  if (!Array.isArray(r.blocks)) r.blocks = [] as any;
  return r;
}

export const useConstructorStore = create<State>((set, get) => ({
  appId: null,
  blueprint: makeDefaultBlueprint(),
  selected: { kind: 'route', path: '/' },
  dirty: false,
  saveState: 'idle',

  setAppId(appId) {
    set({ appId });
  },

  setBlueprint(bp) {
    const clean = clone(bp || ({} as any));
    if (!clean.nav || !Array.isArray(clean.nav.routes)) {
      (clean as any).nav = makeDefaultBlueprint().nav;
    }
    if (!Array.isArray(clean.routes)) (clean as any).routes = makeDefaultBlueprint().routes;
    if (!clean.app) (clean as any).app = makeDefaultBlueprint().app;
    set({ blueprint: clean, dirty: false, saveState: 'idle' });
  },

  setSaveState(st) {
    set({ saveState: st });
  },

  markSaved() {
    set({ dirty: false, saveState: 'saved' });
  },

  selectRoute(path) {
    set({ selected: { kind: 'route', path } });
  },

  selectBlock(path, id) {
    set({ selected: { kind: 'block', path, id } });
  },

  addRoute(path, title) {
    const st = get();
    const bp = clone(st.blueprint);

    const p = path || `/page-${bp.nav.routes.length + 1}`;
    if (bp.nav.routes.some((r) => r.path === p)) return;

    bp.nav.routes.push({
      path: p,
      title: title || 'Новая',
      icon: 'custom',
      icon_g: '◌',
      icon_img: '',
      kind: 'custom',
    });

    ensureRoute(bp, p);

    set({ blueprint: bp, dirty: true, saveState: 'idle', selected: { kind: 'route', path: p } });
  },

  renameRouteTitle(path, title) {
    const st = get();
    const bp = clone(st.blueprint);
    const nr = bp.nav.routes.find((x) => x.path === path);
    if (!nr) return;
    nr.title = title;
    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  addBlock(path, key) {
    const st = get();
    const bp = clone(st.blueprint);
    const r = ensureRoute(bp, path);

    const b: BlockInst = { id: uid('b'), key, props: {}, hidden: false };
    r.blocks.push(b);

    set({ blueprint: bp, dirty: true, saveState: 'idle', selected: { kind: 'block', path, id: b.id } });
  },

  updateBlockProps(path, id, props) {
    const st = get();
    const bp = clone(st.blueprint);
    const r = ensureRoute(bp, path);
    const b = r.blocks.find((x) => x.id === id);
    if (!b) return;
    b.props = props;
    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  deleteBlock(path, id) {
    const st = get();
    const bp = clone(st.blueprint);
    const r = ensureRoute(bp, path);
    r.blocks = r.blocks.filter((b) => b.id !== id);
    set({ blueprint: bp, dirty: true, saveState: 'idle', selected: { kind: 'route', path } });
  },

  // ✅ move up/down
  moveBlock(path, id, dir) {
    const st = get();
    const bp = clone(st.blueprint);
    const r = ensureRoute(bp, path);
    const i = r.blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= r.blocks.length) return;
    const tmp = r.blocks[i];
    r.blocks[i] = r.blocks[j];
    r.blocks[j] = tmp;
    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  // ✅ hide/show
  toggleBlockHidden(path, id) {
    const st = get();
    const bp = clone(st.blueprint);
    const r = ensureRoute(bp, path);
    const b = r.blocks.find((x) => x.id === id);
    if (!b) return;
    b.hidden = !b.hidden;
    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  // ✅ duplicate
  duplicateBlock(path, id) {
    const st = get();
    const bp = clone(st.blueprint);
    const r = ensureRoute(bp, path);
    const i = r.blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const src = r.blocks[i];
    const copy: BlockInst = {
      id: uid('b'),
      key: src.key,
      props: clone(src.props || {}),
      hidden: !!src.hidden,
    };
    r.blocks.splice(i + 1, 0, copy);
    set({ blueprint: bp, dirty: true, saveState: 'idle', selected: { kind: 'block', path, id: copy.id } });
  },

  // ✅ дизайн токены
  updateThemeTokens(patch: ThemeTokens) {
    const st = get();
    const bp = clone(st.blueprint);

    bp.app = bp.app || {};
    const cur = ensureThemeTokens(bp.app.themeTokens || {});
    const next = ensureThemeTokens({ ...cur, ...(patch || {}) });

    bp.app.themeTokens = next;

    bp.app.theme = bp.app.theme || {};
    bp.app.theme.css = themeTokensToCss(next);

    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  updateThemeCss(css) {
    const st = get();
    const bp = clone(st.blueprint);
    bp.app = bp.app || {};
    bp.app.theme = bp.app.theme || {};
    bp.app.theme.css = String(css || '');
    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },
}));
