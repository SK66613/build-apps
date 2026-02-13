import { create } from 'zustand';
import type { Blueprint, Selected, SaveState, RoutePage, BlockInst } from './types';
import { clone, uid, makeDefaultBlueprint } from './utils';
import { ensureThemeTokens, themeTokensToCss, type ThemeTokens } from '../design/theme';
import { apiFetch } from '../../lib/api';

type State = {
  appId: string | null;
  blueprint: Blueprint;
  selected: Selected;
  dirty: boolean;

  // states
  saveState: SaveState;
  publishState: SaveState;

  lastPublishedUrl?: string | null;

  // UI helper: prevent publish modal from re-opening after navigate
  clearLastPublishedUrl(): void;

  setAppId(appId: string | null): void;
  setBlueprint(bp: Blueprint): void;
  setSaveState(st: SaveState): void;
  markSaved(): void;

  // server
  saveNow(): Promise<void>;
  publishNow(): Promise<{ publicId?: string; publicUrl?: string } | any>;

  selectRoute(path: string): void;
  selectBlock(path: string, id: string): void;

  addRoute(path?: string, title?: string): void;
  renameRouteTitle(path: string, title: string): void;

  // ✅ СТРАНИЦЫ “как в старом”
  toggleRouteHidden(path: string): void;
  setRouteIcon(
    path: string,
    patch: Partial<{
      kind: string;
      icon: string;
      icon_g: string;
      icon_img: string;
    }>
  ): void;
  renameRoute(path: string, patch: Partial<{ title: string; nextPath: string }>): void;
  deleteRoute(path: string): void;

  addBlock(path: string, key: string): void;
  updateBlockProps(path: string, id: string, props: any): void;
  deleteBlock(path: string, id: string): void;

  // ✅ БЛОКИ (как в старом)
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

function ensureNav(bp: Blueprint) {
  if (!bp.nav || !Array.isArray(bp.nav.routes)) {
    (bp as any).nav = makeDefaultBlueprint().nav;
  }
  if (!Array.isArray(bp.routes)) (bp as any).routes = makeDefaultBlueprint().routes;
  if (!bp.app) (bp as any).app = makeDefaultBlueprint().app;

  // legacy-compatible blocks map (preview/runtime reads bp.blocks[id])
  if (!(bp as any).blocks || typeof (bp as any).blocks !== 'object') (bp as any).blocks = {};
}

function ensureBlockProps(bp: Blueprint, id: string, fallback: any = {}) {
  ensureNav(bp);
  const blocks: any = (bp as any).blocks;
  const k = String(id);
  if (!blocks[k] || typeof blocks[k] !== 'object') blocks[k] = clone(fallback || {});
  return blocks[k];
}

function normalizePath(p: string) {
  let s = String(p || '').trim();
  if (!s) s = '/';
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\s+/g, '-');
  s = s.replace(/[^/a-zA-Z0-9_-]/g, '');
  return s || '/';
}

export const useConstructorStore = create<State>((set, get) => ({
  appId: null,
  blueprint: makeDefaultBlueprint(),
  selected: { kind: 'route', path: '/' },
  dirty: false,

  saveState: 'idle',
  publishState: 'idle',

  lastPublishedUrl: null,

  clearLastPublishedUrl() {
    set({ lastPublishedUrl: null });
  },

  setAppId(appId) {
    set({ appId });
  },

  setBlueprint(bp) {
    const clean = clone(bp || ({} as any));
    ensureNav(clean);
    set({
      blueprint: clean,
      dirty: false,
      saveState: 'idle',
      publishState: 'idle',
    });
  },

  setSaveState(st) {
    set({ saveState: st });
  },

  markSaved() {
    set({ dirty: false, saveState: 'saved' });
  },

  async saveNow() {
    const st = get();
    if (!st.appId) throw new Error('APP_NOT_SELECTED');

    set({ saveState: 'saving' });
    try {
      await apiFetch<any>(`/api/app/${encodeURIComponent(st.appId)}/config`, {
        method: 'PUT',
        body: JSON.stringify({ config: st.blueprint }),
      });
      set({ dirty: false, saveState: 'saved' });
    } catch (e) {
      set({ saveState: 'error' });
      throw e;
    }
  },

  async publishNow() {
    const st = get();
    if (!st.appId) throw new Error('APP_NOT_SELECTED');

    // publish uses saved draft; if dirty -> save first
    if (st.dirty) {
      await get().saveNow();
    }

    set({ publishState: 'saving' });
    try {
      const res = await apiFetch<any>(`/api/app/${encodeURIComponent(st.appId)}/publish`, {
        method: 'POST',
      });

      const url = res?.publicUrl || null;

      set({
        publishState: 'saved',
        lastPublishedUrl: url,
      });

      return res;
    } catch (e) {
      set({ publishState: 'error' });
      throw e;
    }
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
    ensureNav(bp);

    const p = normalizePath(path || `/page-${bp.nav.routes.length + 1}`);
    if (bp.nav.routes.some((r) => r.path === p)) return;

    bp.nav.routes.push({
      path: p,
      title: title || 'Новая',
      icon: 'custom',
      icon_g: '◌',
      icon_img: '',
      kind: 'custom',
    } as any);

    ensureRoute(bp, p);

    set({
      blueprint: bp,
      dirty: true,
      saveState: 'idle',
      selected: { kind: 'route', path: p },
    });
  },

  renameRouteTitle(path, title) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

    const nr = bp.nav.routes.find((x) => x.path === path);
    if (!nr) return;

    nr.title = String(title || '').trim() || nr.title;
    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  toggleRouteHidden(path) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

    const nr: any = bp.nav.routes.find((x) => x.path === path);
    if (!nr) return;

    nr.hidden = !nr.hidden;
    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  setRouteIcon(path, patch) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

    const nr: any = bp.nav.routes.find((x) => x.path === path);
    if (!nr) return;

    if (patch.kind !== undefined) nr.kind = patch.kind as any;
    if (patch.icon !== undefined) nr.icon = patch.icon as any;
    if (patch.icon_g !== undefined) nr.icon_g = patch.icon_g as any;
    if (patch.icon_img !== undefined) nr.icon_img = patch.icon_img as any;

    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  renameRoute(path, patch) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

    const nr: any = bp.nav.routes.find((x) => x.path === path);
    if (!nr) return;

    if (patch.title !== undefined) {
      const t = String(patch.title || '').trim();
      if (t) nr.title = t;
    }

    if (patch.nextPath !== undefined) {
      const nextPath = normalizePath(patch.nextPath);
      if (nextPath !== path) {
        const occupied = bp.nav.routes.some((x) => x.path === nextPath);
        if (!occupied) {
          nr.path = nextPath;

          const rr = bp.routes.find((x) => x.path === path);
          if (rr) rr.path = nextPath;

          const sel = st.selected;
          let nextSelected: Selected = sel;
          if (sel.kind === 'route' && sel.path === path) {
            nextSelected = { kind: 'route', path: nextPath };
          } else if (sel.kind === 'block' && sel.path === path) {
            nextSelected = { kind: 'block', path: nextPath, id: sel.id };
          }

          set({
            blueprint: bp,
            dirty: true,
            saveState: 'idle',
            selected: nextSelected,
          });
          return;
        }
      }
    }

    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  deleteRoute(path) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

    if (path === '/') return;

    bp.nav.routes = bp.nav.routes.filter((r) => r.path !== path);
    bp.routes = bp.routes.filter((r) => r.path !== path);

    const sel = st.selected;
    if (sel.path === path) {
      const fallback = bp.nav.routes[0]?.path || '/';
      set({
        blueprint: bp,
        dirty: true,
        saveState: 'idle',
        selected: { kind: 'route', path: fallback },
      });
      return;
    }

    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  addBlock(path, key) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

    const r = ensureRoute(bp, path);

    const b: BlockInst = { id: uid('b'), key, props: {}, hidden: false };
    r.blocks.push(b);

    // legacy-compatible props store (used by preview/runtime)
    (bp as any).blocks[String(b.id)] = clone(b.props || {});

    set({
      blueprint: bp,
      dirty: true,
      saveState: 'idle',
      selected: { kind: 'block', path, id: b.id },
    });
  },

  updateBlockProps(path, id, props) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

    const r = ensureRoute(bp, path);
    const b = r.blocks.find((x) => x.id === id);
    if (!b) return;

    b.props = props;

    // keep bp.blocks in sync for preview/runtime
    (bp as any).blocks[String(id)] = clone(props || {});

    // preserve hidden flag if needed
    if (b.hidden) (bp as any).blocks[String(id)].__hidden = true;

    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  deleteBlock(path, id) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

    const r = ensureRoute(bp, path);
    r.blocks = r.blocks.filter((b) => b.id !== id);

    try {
      delete (bp as any).blocks[String(id)];
    } catch (_e) {}

    set({
      blueprint: bp,
      dirty: true,
      saveState: 'idle',
      selected: { kind: 'route', path },
    });
  },

  moveBlock(path, id, dir) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

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

  toggleBlockHidden(path, id) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

    const r = ensureRoute(bp, path);
    const b = r.blocks.find((x) => x.id === id);
    if (!b) return;

    b.hidden = !b.hidden;

    // preview/runtime uses __hidden flag inside bp.blocks[id]
    const p = ensureBlockProps(bp, id, b.props || {});
    p.__hidden = !!b.hidden;

    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },

  duplicateBlock(path, id) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

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

    (bp as any).blocks[String(copy.id)] = clone(copy.props || {});
    if (copy.hidden) {
      (bp as any).blocks[String(copy.id)].__hidden = true;
    }

    r.blocks.splice(i + 1, 0, copy);
    set({
      blueprint: bp,
      dirty: true,
      saveState: 'idle',
      selected: { kind: 'block', path, id: copy.id },
    });
  },

  updateThemeTokens(patch: ThemeTokens) {
    const st = get();
    const bp = clone(st.blueprint);
    ensureNav(bp);

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
    ensureNav(bp);

    bp.app = bp.app || {};
    bp.app.theme = bp.app.theme || {};
    bp.app.theme.css = String(css || '');

    set({ blueprint: bp, dirty: true, saveState: 'idle' });
  },
}));
