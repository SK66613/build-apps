import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../app/auth";

// Если у тебя есть готовые компоненты — подключи:
// import ProjectPicker from "./ProjectPicker";
// import DateRangePicker from "./DateRangePicker";
// import ThemeToggle from "./ThemeToggle";

function SideItem({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }){
  return (
    <NavLink
      to={to}
      className={({isActive}) => "side__item" + (isActive ? " is-active" : "")}
      title={label}
      end={to === "/"} // Overview active только на корне
    >
      <span className="ico">{icon}</span>
      <span className="txt">{label}</span>
    </NavLink>
  );
}

export default function AppShell(){
  const { me, logout } = useAuth();
  const email = (me as any)?.email || (me as any)?.user?.email || "";

  // локальный тумблер темы (если у тебя уже есть ThemeToggle — убери этот кусок)
  const curTheme = (document.documentElement.dataset.theme === "dark") ? "Dark" : "Light";
  const toggleTheme = ()=>{
    const cur = (document.documentElement.dataset.theme === "dark") ? "dark" : "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try{ localStorage.setItem("sg_theme", next); }catch(_){}
  };

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

            {/* ====== Project Picker (сюда) ======
                Вставь свой компонент выбора проекта (из старого Shell) */}
            {/* <ProjectPicker /> */}

            {/* ====== Theme Toggle (сюда) ====== */}
            {/* Если у тебя уже есть ThemeToggle — используй его */}
            <button className="sg-btn sg-btn--ghost" onClick={toggleTheme} title="Theme">
              ☀️ {curTheme}
            </button>

            {/* ====== Email (сюда) ====== */}
            {email ? <div className="sg-user">{email}</div> : null}

            {/* ====== Logout (сюда) ====== */}
            <button className="sg-btn sg-btn--ghost" onClick={() => logout?.()}>
              Выйти
            </button>
          </div>

          <div className="sg-topbar__right">
            {/* ====== DateRangePicker (сюда) ====== */}
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
