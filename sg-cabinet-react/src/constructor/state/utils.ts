import type { Blueprint } from './types';

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export function uid(prefix = 'b') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function makeDefaultBlueprint(): Blueprint {
  return {
    app: {
      title: 'Mini App',
      theme: {
        css: '',
      },
    },
    nav: {
      type: 'tabs',
      position: 'bottom',
      routes: [
        {
          path: '/',
          title: 'Главная',
          icon: 'home',
          icon_g: '●',
          icon_img: '',
          kind: 'home',
        },
      ],
    },
    routes: [
      {
        path: '/',
        blocks: [],
      },
    ],
  };
}
