import { useSyncExternalStore } from 'react';

type Range = { from: string; to: string; tz: string };

type State = {
  appId: string | null;
  range: Range;
  theme: 'light' | 'dark';
};

type Listener = () => void;

const today = () => new Date().toISOString().slice(0,10);

const initial: State = {
  appId: null,
  range: { from: today(), to: today(), tz: 'Europe/Berlin' },
  theme: (localStorage.getItem('sg_theme') === 'dark') ? 'dark' : 'light',
};

let state: State = {
  ...initial,
  appId: localStorage.getItem('sg_app_id') || null,
  range: (()=>{
    try{
      const raw = localStorage.getItem('sg_range');
      if(!raw) return initial.range;
      const r = JSON.parse(raw);
      if(r && r.from && r.to) return { from:String(r.from), to:String(r.to), tz: String(r.tz || 'Europe/Berlin') };
    }catch(_){ }
    return initial.range;
  })(),
};

const listeners = new Set<Listener>();

function emit(){
  for (const l of listeners) l();
}

export function setAppId(appId: string | null){
  state = { ...state, appId };
  if (appId) localStorage.setItem('sg_app_id', appId);
  else localStorage.removeItem('sg_app_id');
  emit();
}

export function setRange(range: Range){
  state = { ...state, range };
  localStorage.setItem('sg_range', JSON.stringify(range));
  emit();
}

export function setTheme(theme: State['theme']){
  state = { ...state, theme };
  localStorage.setItem('sg_theme', theme);
  document.documentElement.dataset.theme = theme;
  emit();
}

export function useCabinetStore(){
  return useSyncExternalStore(
    (cb)=>{ listeners.add(cb); return ()=>listeners.delete(cb); },
    ()=>state,
    ()=>state
  );
}
