import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { useAppState } from '../app/appState';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { AppListItem } from '../lib/types';
import { Button, Card, Input, Pill } from './ui';

function ThemeToggle(){
  const [theme, setTheme] = React.useState(() => {
    return document.documentElement.dataset.theme || 'light';
  });
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try{ localStorage.setItem('sg_theme', next); }catch(_){ }
  };
  return <Button variant="ghost" onClick={toggle}>{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</Button>;
}

function DateRange(){
  const { range, setRange } = useAppState();
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Input type="date" value={range.from} onChange={e=>setRange({ from: e.target.value })} />
      <span style={{ color: 'var(--muted)', fontWeight: 900 }}>→</span>
      <Input type="date" value={range.to} onChange={e=>setRange({ to: e.target.value })} />
    </div>
  );
}

export default function Shell(){
  const { logout, me } = useAuth();
  const { appId, setAppId } = useAppState();

  const appsQ = useQuery({
    queryKey: ['apps'],
    queryFn: () => apiFetch<{ ok: true; apps: AppListItem[] }>('/api/apps'),
    staleTime: 15_000,
  });

  // choose first app automatically
  React.useEffect(() => {
    if (!appId && appsQ.data?.apps?.length) {
      setAppId(appsQ.data.apps[0].id);
    }
  }, [appId, appsQ.data?.apps, setAppId]);

  const apps = appsQ.data?.apps || [];

  return (
    <div className="sg-shell">
      <aside className="sg-sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 1000, letterSpacing: -0.2 }}>Sales Genius</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 800 }}>Cabinet</div>
          </div>
          <ThemeToggle />
        </div>

        <Card style={{ marginTop: 14, padding: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 900 }}>Проект</div>
          <select
            value={appId || ''}
            onChange={(e) => setAppId(e.target.value)}
            style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 14, border: '1px solid var(--border)', background: 'rgba(255,255,255,.75)', fontWeight: 900 }}
          >
            {apps.map(a => <option key={a.id} value={a.id}>{a.title} ({a.id})</option>)}
          </select>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Pill>{me?.user?.email || '—'}</Pill>
            <Button variant="ghost" onClick={() => logout()}>Выйти</Button>
          </div>
        </Card>

        <nav className="sg-nav">
          <NavLink to="/" className={({isActive})=>isActive? 'is-active': ''}>🏠 Overview</NavLink>
          <NavLink to="/live" className={({isActive})=>isActive? 'is-active': ''}>🟢 Live</NavLink>
          <NavLink to="/customers" className={({isActive})=>isActive? 'is-active': ''}>👥 Customers</NavLink>
          <NavLink to="/sales" className={({isActive})=>isActive? 'is-active': ''}>🧾 Sales</NavLink>
          <NavLink to="/wheel" className={({isActive})=>isActive? 'is-active': ''}>🎡 Wheel</NavLink>
          <NavLink to="/passport" className={({isActive})=>isActive? 'is-active': ''}>🏁 Passport</NavLink>
          <NavLink to="/calendar" className={({isActive})=>isActive? 'is-active': ''}>📅 Calendar</NavLink>
          <NavLink to="/profit" className={({isActive})=>isActive? 'is-active': ''}>💰 Profit / ROI</NavLink>
          <NavLink to="/settings" className={({isActive})=>isActive? 'is-active': ''}>⚙️ Settings</NavLink>

          <NavLink to="/constructor" className={({isActive})=>isActive? 'is-active': ''}>🛠️ Конструктор</NavLink>

        </nav>
      </aside>

      <main className="sg-main">
        <div className="sg-topbar">
          <div style={{ flex: 1 }} />
          <DateRange />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
