import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './app/auth';
import { AppStateProvider } from './app/appState';
import { I18nProvider } from './i18n';          // ✅ ДОБАВЬ ЭТОТ ИМПОРТ
import Shell from './components/Shell';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Overview from './pages/Overview';
import Live from './pages/Live';
import Customers from './pages/Customers';
import Sales from './pages/Sales';
import Wheel from './pages/Wheel';
import Passport from './pages/Passport';
import Calendar from './pages/Calendar';
import Profit from './pages/Profit';
import Settings from './pages/Settings';
import Constructor from './pages/Constructor';
import Game from './pages/Game';
import Referrals from './pages/Referrals';
import Broadcasts from './pages/Broadcasts';

function Guarded({ children }: { children: React.ReactNode }){
  const { me, isLoading } = useAuth();
  if (isLoading) return <div style={{ padding: 18, fontWeight: 900 }}>Загрузка...</div>;
  if (!me?.authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App(){
  return (
    <I18nProvider>          {/* ✅ ВОТ ТУТ, САМОЕ ВНЕШНЕЕ */}
      <AuthProvider>
        <AppStateProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cabinet" element={<Guarded><Projects /></Guarded>} />

            <Route path="/" element={<Guarded><Shell /></Guarded>}>
              <Route index element={<Overview />} />
              <Route path="live" element={<Live />} />
              <Route path="customers" element={<Customers />} />
              <Route path="sales" element={<Sales />} />
              <Route path="wheel" element={<Wheel />} />
              <Route path="passport" element={<Passport />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="profit" element={<Profit />} />
              <Route path="settings" element={<Settings />} />
              <Route path="constructor" element={<Constructor />} />
              <Route path="game" element={<Game />} />
              <Route path="referrals" element={<Referrals />} />
              <Route path="broadcasts" element={<Broadcasts />} />
            </Route>

            <Route path="*" element={<Navigate to="/cabinet" replace />} />
          </Routes>
        </AppStateProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

