export type NavRoute = {
  path: string;
  title: string;
  icon?: string;
  icon_g?: string;
  icon_img?: string;
  kind?: string;
};

export type BlockInst = {
  id: string;
  key: string; // registry key (e.g. 'styles_passport_one')
  props?: any;
};

export type RoutePage = {
  path: string;
  blocks: BlockInst[];
};

/**
 * Blueprint shape is aligned to the battle-tested templates.js renderer
 * from miniapp_sections_fixed2.
 */
export type Blueprint = {
  app: {
    name?: string;
    title?: string;
    theme?: { css?: string };
  };
  nav: {
    type: 'tabs';
    position?: 'bottom' | 'top';
    routes: NavRoute[];
  };
  routes: RoutePage[];
};

export type Selected =
  | { kind: 'route'; path: string }
  | { kind: 'block'; path: string; id: string }
  | null;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
