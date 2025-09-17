// frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './app';
import { DailyReportPage } from './pages/DailyReportPage';
import LoginPage from './pages/LoginPage';
import './index.css';
import { APP_CONFIG } from './types';

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem(APP_CONFIG.storage.token) : null;
  const sessDate = typeof window !== 'undefined' ? localStorage.getItem(APP_CONFIG.storage.sessionDate) : null;
  const today = new Date().toISOString().slice(0,10);
  if (!token) return <Navigate to="/login" replace />;
  if (sessDate && sessDate !== today) {
    // Session expired by date turnover, force re-auth
    localStorage.removeItem(APP_CONFIG.storage.token);
    localStorage.removeItem(APP_CONFIG.storage.role);
    return <Navigate to="/login" replace />;
  }
  return children;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><App /></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth><DailyReportPage /></RequireAuth>} />
    </Routes>
  </BrowserRouter>
);
