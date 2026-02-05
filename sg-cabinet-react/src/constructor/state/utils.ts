import type { Blueprint } from './types';

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export function uid(prefix = 'b') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

// sg-cabinet-react/src/constructor/state/utils.ts
import type { Blueprint, RoutePath } from './types';
import { ensureThemeTokens, themeTokensToCss } from '../design/theme';

export function makeDefaultBlueprint(): Blueprint {
  const tokens = ensureThemeTokens(undefined);

  return {
    v: 1,
    app: {
      title: 'Mini App',
      themeTokens: tokens,
      theme: { css: themeTokensToCss(tokens) },
    },
    nav: {
      routes: [
        { path: '/', title: 'Главная', icon: 'custom', icon_g: '◌', icon_img: '', kind: 'custom' },
      ],
    },
    routes: [
      { path: '/', blocks: [] },
    ],
  };
}

export function ensureRoute(bp: Blueprint, path: RoutePath) {
  let r = bp.routes.find((x) => x.path === path);
  if (!r) {
    r = { path, blocks: [] };
    bp.routes.push(r);
  }
  return r;
}
