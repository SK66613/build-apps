import React from 'react';
import { formatISO, subDays } from 'date-fns';

type Range = { from: string; to: string; tz: string };

type AppState = {
  appId: string | null;
  setAppId: (id: string) => void;
  range: Range;
  setRange: (r: Partial<Range>) => void;
};

const AppStateContext = React.createContext<AppState | null>(null);

function isoDate(d: Date) {
  return formatISO(d, { representation: 'date' });
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [appId, _setAppId] = React.useState<string | null>(() => {
    try { return localStorage.getItem('sg_app_id'); } catch(_){ return null; }
  });

  const [range, _setRange] = React.useState<Range>(() => {
    const tz = 'Europe/Berlin';
    const to = isoDate(new Date());
    const from = isoDate(subDays(new Date(), 7));
    try {
      const raw = localStorage.getItem('sg_range');
      if (raw) {
        const p = JSON.parse(raw);
        return {
          from: String(p.from || from),
          to: String(p.to || to),
          tz: String(p.tz || tz),
        };
      }
    } catch(_){ }
    return { from, to, tz };
  });

  const setAppId = (id: string) => {
    _setAppId(id);
    try { localStorage.setItem('sg_app_id', id); } catch(_){ }
  };

  // Accept app id from the host cabinet (panel.html) via ?app_id=... or ?app=...
  React.useEffect(() => {
    try{
      const sp = new URLSearchParams(window.location.search || '');
      const q = String(sp.get('app_id') || sp.get('app') || '').trim();
      if (q && q !== appId) setAppId(q);
    }catch(_){ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRange = (r: Partial<Range>) => {
    _setRange(prev => {
      const next = { ...prev, ...r };
      try { localStorage.setItem('sg_range', JSON.stringify(next)); } catch(_){ }
      return next;
    });
  };

  return (
    <AppStateContext.Provider value={{ appId, setAppId, range, setRange }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(){
  const ctx = React.useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
