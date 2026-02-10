import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { useAppState } from '../app/appState';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { AppListItem } from '../lib/types';
import { Button, Input, Pill } from '../components/ui';
import { useI18n } from '../i18n';

/** ===== UI blocks (оставляем твою логику) ===== */
function ThemeToggle(){
  const { t } = useI18n();

  const [theme, setTheme] = React.useState(() => {
    return document.documentElement.dataset.theme || 'light';
  });

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try{ localStorage.setItem('sg_theme', next); }catch(_){ }
  };

  return (
    <Button variant="ghost" onClick={toggle} title={t('top.theme')}>
      {theme === 'dark' ? `🌙 ${t('common.dark')}` : `☀️ ${t('common.light')}`}
    </Button>
  );
}

function SideItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }){
  return (
    <NavLink
      to={to}
      end={to === '/'} // важно: index page
      className={({isActive}) => 'side__item' + (isActive ? ' is-active' : '')}
      title={label}
    >
      <span className="ico">{icon}</span>
      <span className="txt">{label}</span>
    </NavLink>
  );
}

export default function AppShell(){
  const { logout, me } = useAuth();
  const { appId, setAppId, range, setRange } = useAppState();
  const { t } = useI18n();

  const loc = useLocation();
  const isCtor = loc.pathname === '/constructor' || loc.pathname.startsWith('/constructor/');

  const appsQ = useQuery({
    queryKey: ['apps'],
    queryFn: () => apiFetch<{ ok: true; apps: AppListItem[] }>('/api/apps'),
    staleTime: 15_000,
  });

  // choose first app automatically (как было)
  React.useEffect(() => {
    if (!appId && appsQ.data?.apps?.length) {
      setAppId(appsQ.data.apps[0].id);
    }
  }, [appId, appsQ.data?.apps, setAppId]);

  const apps = appsQ.data?.apps || [];
  const email = me?.user?.email || '—';

  return (
    <div className="sg-shell">
      {/* ===== LEFT: mini sidebar like старый конструктор ===== */}
      <aside className="side">
        <div className="side__top">
          <button className="side__logo" title="Sales Genius">
            <span className="logoMark">🛠</span>
          </button>
        </div>

        {/* scroll only for menu */}
        <div className="side__scroll">
          <nav className="side__nav">
            <SideItem to="/"            icon="🏠" label={t('nav.overview')} />
            <SideItem to="/live"        icon="🟢" label={t('nav.live')} />
            <SideItem to="/customers"   icon="👥" label={t('nav.customers')} />
            <SideItem to="/sales"       icon="🧾" label={t('nav.sales')} />

            <div className="side__sep" />

            <SideItem to="/wheel"       icon="🎡" label={t('nav.wheel')} />
            <SideItem to="/passport"    icon="🏁" label={t('nav.passport')} />
            <SideItem to="/calendar"    icon="📅" label={t('nav.calendar')} />

            <div className="side__sep" />

            <SideItem to="/profit"      icon="💰" label={t('nav.profit')} />
            <SideItem to="/settings"    icon="⚙️" label={t('nav.settings')} />

            <div className="side__sep" />

            <SideItem to="/constructor" icon="🛠️" label={t('nav.constructor')} />
            <SideItem to="/game"        icon="🟢" label={t('nav.game')} />
            <SideItem to="/referrals"   icon="🟢" label={t('nav.referrals')} />
            <SideItem to="/broadcasts"  icon="🟢" label={t('nav.broadcasts')} />
          </nav>
        </div>
      </aside>

      {/* ===== RIGHT: content ===== */}
      <main className={'sg-main' + (isCtor ? ' is-ctor' : '')}>
        {!isCtor && (
          <header className="sg-topbar sg-topbar--v2">
            {/* LEFT: бренд + проект + ДАТЫ */}
            <div className="top__left">
              <div className="top__brand">
                <div className="top__brandTitle">{t('brand.name')}</div>
                <div className="top__brandSub">{t('brand.sub')}</div>
              </div>

              <div className="top__proj">
                <div className="top__label">{t('top.project')}</div>
                <select
                  value={appId || ''}
                  onChange={(e) => setAppId(e.target.value)}
                  className="top__select"
                  title={t('top.project')}
                >
                  {apps.map(a => (
                    <option key={a.id} value={a.id}>{a.title} ({a.id})</option>
                  ))}
                </select>
              </div>

              {/* Даты теперь слева */}
              <div className="top__dates">
                <Input type="date" value={range.from} onChange={e=>setRange({ from: e.target.value })} />
                <span className="top__arrow">→</span>
                <Input type="date" value={range.to} onChange={e=>setRange({ to: e.target.value })} />
              </div>
            </div>

            {/* RIGHT: тема + email + выйти */}
            <div className="top__right">
              <ThemeToggle />
              <Pill>{email}</Pill>
              <Button variant="ghost" onClick={() => logout()}>{t('common.logout')}</Button>
            </div>
          </header>
        )}

        <Outlet />
      </main>
    </div>
  );
}
