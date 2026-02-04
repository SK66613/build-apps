import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import { useCabinetStore } from "../lib/store";

import { AppPicker } from "../components/AppPicker";
import { DateRangePicker } from "../components/DateRangePicker";
import { ThemeToggle } from "../components/ThemeToggle";

type SideItemProps = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

function SideItem({ to, label, icon }: SideItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => "side__item" + (isActive ? " is-active" : "")}
      title={label}
    >
      <span className="ico">{icon}</span>
      <span className="txt">{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { appId } = useCabinetStore();

  // apps list (для выбора проекта)
  const appsQ = useQuery({
    queryKey: ["apps.list"],
    queryFn: () => api.apps.list(),
  });

  // user me (для email)
  const meQ = useQuery({
    queryKey: ["auth.me"],
    queryFn: () => api.auth.me(),
  });

  const userEmail = (meQ.data as any)?.email || (meQ.data as any)?.user?.email || "";

  async function logout() {
    try {
      await api.auth.logout();
    } catch (_) {}
    // самый простой вариант: перезагрузка (если у тебя так работает сессия)
    window.location.href = "/";
  }

  return (
    <div className="sg-shell">
      {/* LEFT NAV */}
      <aside className="side">
        <div className="side__top">
          <button className="side__logo" title="Sales Genius">
            <span className="logoMark">🛠</span>
          </button>
        </div>

        {/* SCROLL AREA */}
        <div className="side__scroll">
          <nav className="side__nav">
            <SideItem to="/overview" icon="🏠" label="Overview" />
            <SideItem to="/live" icon="🟢" label="Live" />
            <SideItem to="/customers" icon="👥" label="Customers" />
            <SideItem to="/sales" icon="🧾" label="Sales" />

            <div className="side__sep" />

            <SideItem to="/wheel" icon="🎡" label="Wheel" />
            <SideItem to="/passport" icon="🏁" label="Passport" />
            <SideItem to="/calendar" icon="📅" label="Calendar" />

            <div className="side__sep" />

            <SideItem to="/profit" icon="💹" label="Profit / ROI" />
            <SideItem to="/settings" icon="⚙️" label="Settings" />

            <div className="side__sep" />

            <SideItem to="/constructor" icon="🧩" label="Constructor" />
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

            <div className="sg-topbar__group">
              <div className="sg-topbar__label">Проект</div>
              <AppPicker apps={(appsQ.data as any)?.apps || []} />
            </div>

            <ThemeToggle />

            {userEmail ? <div className="sg-user">{userEmail}</div> : null}

            <button className="sg-btn sg-btn--ghost" onClick={logout}>
              Выйти
            </button>
          </div>

          <div className="sg-topbar__right">
            <DateRangePicker />
          </div>
        </header>

        <main className="sg-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
