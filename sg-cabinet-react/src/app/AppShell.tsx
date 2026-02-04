import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AppPicker } from '../components/AppPicker';
import { DateRangePicker } from '../components/DateRangePicker';
import { useCabinetStore } from '../lib/store';
import { ThemeToggle } from '../components/ThemeToggle';

function SideItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }){
  return (
    <NavLink to={to} className={({isActive}) => 'side__item' + (isActive ? ' is-active' : '')} title={label}>
      <span className="ico">{icon}</span>
      <span className="txt">{label}</span>
    </NavLink>
  );
}

export function AppShell(){
  const { appId } = useCabinetStore();
  const { data } = useQuery({ queryKey: ['apps.list'], queryFn: () => api.apps.list() });

  return (
    <div className="sg-shell">
      {/* LEFT MENU (как в panel.html) */}
      <aside className="side" id="side">
        <div className="side__top">
          <button className="side__logo" title="Sales Genius">
            <span className="logoMark">🛠</span>
          </button>
        </div>

        <nav className="side__nav">
          {/* твои новые названия */}
          <SideItem to="/overview"    icon="🏠" label="Overview" />
          <SideItem to="/live"        icon="🟢" label="Live" />
          <SideItem to="/customers"   icon="👥" label="Customers" />
          <SideItem to="/sales"       icon="🧾" label="Sales" />

          <div className="side__sep" />

          <SideItem to="/wheel"       icon="🎁" label="Wheel" />
          <SideItem to="/passport"    icon="🏁" label="Passport" />
          <SideItem to="/calendar"    icon="📅" label="Calendar" />

          <div className="side__sep" />

          <SideItem to="/profit"      icon="💹" label="Profit / ROI" />
          <SideItem to="/settings"    icon="⚙" label="Settings" />

          <div className="side__sep" />

          <SideItem to="/constructor" icon="🛠" label="Constructor" />
        </nav>

        <div className="side__bottom">
          {/* твой тумблер темы уже есть */}
          <ThemeToggle />
          <div className="side__foot">
            <div className="muted">App: <b>{appId || '—'}</b></div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="sg-main">
        <header className="sg-topbar">
          <AppPicker apps={data?.apps ?? []} />
          <DateRangePicker />
        </header>

        <main className="sg-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
