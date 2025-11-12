import { Route, Routes, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Markets from './pages/Markets.jsx';
import Trades from './pages/Trades.jsx';
import Withdraw from './pages/Withdraw.jsx';
import Support from './pages/Support.jsx';
import { LanguageProvider } from './lib/i18n.js';
import AdminApp from './admin/AdminApp.jsx';
import { AdminProvider } from './admin/AdminContext.jsx';

function App() {
  return (
    <LanguageProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="markets" element={<Markets />} />
          <Route path="trades" element={<Trades />} />
          <Route path="withdraw" element={<Withdraw />} />
          <Route path="support" element={<Support />} />
        </Route>
        <Route
          path="/admin/*"
          element={
            <AdminProvider>
              <AdminApp />
            </AdminProvider>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LanguageProvider>
  );
}

export default App;
