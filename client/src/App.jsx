import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Home from './pages/Home';
import FinishLogin from './pages/FinishLogin';
import DashboardLayout from './layouts/DashboardLayout';
import OverviewTab from './components/dashboard/OverviewTab';
import AssociatesTab from './components/dashboard/AssociatesTab';
import SalesTab from './components/dashboard/SalesTab';
import ManagerTab from './components/dashboard/ManagerTab';
import SettingsTab from './components/dashboard/SettingsTab';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/" replace />;
}

function RequireManager({ children }) {
  const { user, loading, isManager } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return isManager ? children : <Navigate to="/dashboard/overview" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/finish-login" element={<FinishLogin />} />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route path="overview" element={<OverviewTab />} />
        <Route path="associates" element={<AssociatesTab />} />
        <Route path="sales" element={<SalesTab />} />
        <Route
          path="management"
          element={
            <RequireManager>
              <ManagerTab />
            </RequireManager>
          }
        />
        <Route path="settings" element={<SettingsTab />} />
        <Route index element={<Navigate to="overview" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}