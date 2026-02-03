import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AppPicker } from '../components/AppPicker';
import { DateRangePicker } from '../components/DateRangePicker';
import { useCabinetStore } from '../lib/store';
import { ThemeToggle } from '../components/ThemeToggle';

export function AppShell(){
  const { appId } = useCabinetStore();
  const { data } = useQuery({ queryKey: ['apps.list'], queryFn: () => api.apps.list() });

  return (
    <div className="sg-shell">
      <aside className="sg-side">
        <div className="sg-brand">
          <div className="sg-brand__logo">SG</div>
          <div>
            <div className="sg-brand__title">Sales Genius</div>
            <div className="sg-brand__sub">Merchant dashboard</div>
          </div>
        </div>

        <nav className="sg-nav">
          <NavLink to="/overview" className={({isActive})=> isActive? 'sg-nav__item is-active':'sg-nav__item'}>Overview</NavLink>
          <NavLink to="/live" className={({isActive})=> isActive? 'sg-nav__item is-active':'sg-nav__item'}>Live</NavLink>
          <NavLink to="/customers" className={({isActive})=> isActive? 'sg-nav__item is-active':'sg-nav__item'}>Customers</NavLink>
          <NavLink to="/sales" className={({isActive})=> isActive? 'sg-nav__item is-active':'sg-nav__item'}>Sales</NavLink>
          <div className="sg-nav__sep" />
          <NavLink to="/wheel" className={({isActive})=> isActive? 'sg-nav__item is-active':'sg-nav__item'}>Wheel</NavLink>
          <NavLink to="/passport" className={({isActive})=> isActive? 'sg-nav__item is-active':'sg-nav__item'}>Passport</NavLink>
          <NavLink to="/calendar" className={({isActive})=> isActive? 'sg-nav__item is-active':'sg-nav__item'}>Calendar</NavLink>
          <div className="sg-nav__sep" />
          <NavLink to="/profit" className={({isActive})=> isActive? 'sg-nav__item is-active':'sg-nav__item'}>Profit / ROI</NavLink>
          <NavLink to="/settings" className={({isActive})=> isActive? 'sg-nav__item is-active':'sg-nav__item'}>Settings</NavLink>
          <div className="sg-nav__sep" />
          <NavLink to="/constructor" className={({isActive})=> isActive? 'sg-nav__item is-active':'sg-nav__item'}>Constructor</NavLink>
        </nav>

        <div className="sg-side__footer">
          <div className="sg-muted">App: <b>{appId || '—'}</b></div>
          <div className="sg-muted">API: same-origin (/api)</div>
        </div>
      </aside>

      <div className="sg-main">
        <header className="sg-top">
          <div className="sg-top__row">
            <AppPicker apps={data?.apps ?? []} />
            <DateRangePicker />
            <ThemeToggle />
          </div>
        </header>

        <main className="sg-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
