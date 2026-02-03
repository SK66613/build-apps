import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { LoginPage } from '../pages/LoginPage';
import { OverviewPage } from '../pages/OverviewPage';
import { LivePage } from '../pages/LivePage';
import { CustomersPage } from '../pages/CustomersPage';
import { SalesPage } from '../pages/SalesPage';
import { WheelPage } from '../pages/WheelPage';
import { PassportPage } from '../pages/PassportPage';
import { CalendarPage } from '../pages/CalendarPage';
import { ProfitPage } from '../pages/ProfitPage';
import { SettingsPage } from '../pages/SettingsPage';
import { RequireAuth } from './RequireAuth';




export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="live" element={<LivePage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="wheel" element={<WheelPage />} />
        <Route path="passport" element={<PassportPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="profit" element={<ProfitPage />} />
        <Route path="settings" element={<SettingsPage />} />

        

      </Route>

      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
