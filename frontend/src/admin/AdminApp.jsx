import { Navigate, Route, Routes } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';
import AdminLogin from './AdminLogin.jsx';
import AdminLayout from './AdminLayout.jsx';
import UsersPage from './pages/Users.jsx';
import TradesPage from './pages/Trades.jsx';
import WithdrawalsPage from './pages/Withdrawals.jsx';
import NotificationsPage from './pages/Notifications.jsx';
import AnalyticsPage from './pages/Analytics.jsx';

function AdminApp() {
  const { token } = useAdmin();

  if (!token) {
    return <AdminLogin />;
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="trades" element={<TradesPage />} />
        <Route path="withdrawals" element={<WithdrawalsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>
    </Routes>
  );
}

export default AdminApp;
