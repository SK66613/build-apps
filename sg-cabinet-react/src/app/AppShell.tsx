import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../app/auth';

// если у тебя в appState есть хук — подключи и покажи проект/даты
// import { useAppState } from '../app/appState';

function SideItem({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }){
  return (
    <NavLink
      to={to}
      className={({isActive}) => 'side__item' + (isActive ? ' is-active' : '')}
      title={label}
      end={to === '/'} // чтобы Overview активировался только на корне
    >
      <span className="ico">{icon}</span>
      <span className="txt">{label}</span>
    </NavLink>
  );
}

export default function Shell(){
  const { me, logout } = useAuth();

  // Если у тебя есть app state — раскомментируй и подставь свои поля:
  // const { appId, apps, setAppId, dateFrom, dateTo, setDateRange } = useAppState();

  const email = (me as any)?.email || (me as any)?.user?.email || '';

  return (
    <div className="sg-shell">
      {/* LEFT NAV */}
      <aside className="side">
        <div className="side__top">
          <button className="side__logo" title="Sales Genius">
            <span className="logoMark">🛠</span>
          </button>
        </div>

        <div className="side__scroll">
          <nav className="side__nav">
            <SideItem to="/"          icon="🏠" label="Overview" />
            <SideItem to="/live"      icon="🟢" label="Live" />
            <SideItem to="/customers" icon="👥" label="Customers" />
            <SideItem to="/sales"     icon="🧾" label="Sales" />

            <div className="side__sep" />

            <SideItem to="/wheel"     icon="🎡" label="Wheel" />
            <SideItem to="/passport"  icon="🏁" label="Passport" />
            <SideItem to="/calendar"  icon="📅" label="Calendar" />

            <div className="side__sep" />

            <SideItem to="/profit"    icon="💹" label="Profit / ROI" />
            <SideItem to="/settings"  icon="⚙️" label="Settings" />

            <div className="side__sep" />

            <SideItem to="/constructor" icon="🧩" label="Конструктор" />
          </nav>
        </div>
      </aside>

      {/* MAIN */}
      <div className="sg-main">
        <header className="sg-topbar">
          <div className="sg-topbar__left">
            <div className="sg-brand">
              <div className="sg-brand__title">Sales Genius</div>
              <div className="sg-brand__sub">Cabinet</div>
            </div>

            {/* ===== сюда переносим Проект / Тема / Email / Выйти ===== */}

            {/* Проект: подключи свой AppPicker/Select из твоих компонентов */}
            {/* пример: */}
            {/* <div className="sg-topbar__group">
              <div className="sg-topbar__label">Проект</div>
              <select className="sg-input" style={{ width: 220 }} value={appId||''} onChange={(e)=>setAppId(e.target.value)}>
                {(apps||[]).map(a=> <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </div> */}

            {/* Тема: у тебя уже есть кнопка Light, если она компонент — вставь сюда */}
            {/* <ThemeToggle /> */}
            <button
              className="sg-btn sg-btn--ghost"
              onClick={()=>{
                const cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
                const next = cur === 'dark' ? 'light' : 'dark';
                document.documentElement.dataset.theme = next;
                try{ localStorage.setItem('sg_theme', next); }catch(_){}
              }}
              title="Theme"
            >
              ☀️ {document.documentElement.dataset.theme === 'dark' ? 'Dark' : 'Light'}
            </button>

            {email ? <div className="sg-user">{email}</div> : null}

            <button className="sg-btn sg-btn--ghost" onClick={()=>logout?.()}>
              Выйти
            </button>
          </div>

          <div className="sg-topbar__right">
            {/* Даты: если у тебя есть DateRangePicker компонент — вставь сюда */}
            {/* <DateRangePicker /> */}
          </div>
        </header>

        <main className="sg-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
