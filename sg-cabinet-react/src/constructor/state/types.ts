// sg-cabinet-react/src/constructor/state/types.ts
export type RoutePath = string;

export type BlockInst = {
  id: string;
  key: string;
  props: any;
};

export type BlueprintRoute = {
  path: RoutePath;
  blocks: BlockInst[];
};

export type BlueprintNavRoute = {
  path: RoutePath;
  title: string;
  icon: string;
  icon_g?: string;
  icon_img?: string;
  kind?: 'custom'|'home'|'play'|'profile'|'bonuses'|'tournament';
};

export type Blueprint = {
  v: number;
  app: BlueprintApp;
  nav: {
    routes: BlueprintNavRoute[];
  };
  routes: BlueprintRoute[];
};

export type BlueprintApp = {
  id?: string;
  title?: string;

  // 1) текстовый CSS темы (iframe читает bp.app.theme.css)
  theme?: { css?: string };

  // 2) токены дизайна (как в старом конструкторе)
  themeTokens?: Record<string, string | number>;
};

export type Selected =
  | { kind: 'route'; path: RoutePath }
  | { kind: 'block'; path: RoutePath; id: string };

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
